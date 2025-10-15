"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Loader2, PlayCircle, Video } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  NormalizedLandmark,
  PoseAnalysis,
  PoseMetricKey,
  REFERENCE_CONNECTIONS,
  accumulatePoseMetrics,
  createPoseAccumulator,
  finalizePoseMetrics,
  formatDegrees,
  formatRatio,
} from "@/lib/pose-utils"
import { ExampleMetricRange, ExerciseExample, exerciseExamples } from "@/data/exercise-examples"

const CDN_VISION_BUNDLE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs"
const CDN_VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
const CDN_POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/lite/pose_landmarker_lite.task"

const LOCAL_VISION_BUNDLE_PATH = "/mediapipe/vision_bundle.mjs"
const LOCAL_WASM_PATH = "/mediapipe/wasm"
const LOCAL_MODEL_PATH = "/mediapipe/pose_landmarker_lite.task"

const VISION_MODULE_SOURCES = [LOCAL_VISION_BUNDLE_PATH, CDN_VISION_BUNDLE_URL] as const
const VISION_WASM_PATHS = [LOCAL_WASM_PATH, CDN_VISION_WASM_URL] as const
const POSE_MODEL_PATHS = [LOCAL_MODEL_PATH, CDN_POSE_MODEL_URL] as const

const DEFAULT_MODEL_ERROR =
  "Unable to load the MediaPipe pose model. Check your connection and try again."

const loadVisionModule = async (): Promise<VisionModule> => {
  let lastError: unknown = null

  for (const source of VISION_MODULE_SOURCES) {
    try {
      return (await import(/* webpackIgnore: true */ source)) as VisionModule
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error("Failed to load the MediaPipe vision bundle.")
}

const resolveVisionFileset = async (visionModule: VisionModule) => {
  let lastError: unknown = null

  for (const path of VISION_WASM_PATHS) {
    try {
      return await visionModule.FilesetResolver.forVisionTasks(path)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error("Failed to load MediaPipe WASM assets.")
}

const createPoseLandmarkerInstance = async (
  visionModule: VisionModule,
  fileset: unknown,
): Promise<PoseLandmarkerInstance> => {
  let lastError: unknown = null

  for (const modelPath of POSE_MODEL_PATHS) {
    try {
      return await visionModule.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: modelPath,
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.5,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error("Failed to initialize the MediaPipe pose landmarker.")
}

const getModelLoadErrorMessage = (error: unknown) => {
  if (typeof window !== "undefined" && !window.navigator.onLine) {
    return "You're offline. Reconnect to the internet and try loading the pose model again."
  }

  if (error instanceof Error && /404|not found|failed to fetch|network/i.test(error.message)) {
    return "We couldn't download the MediaPipe pose files. Confirm the assets are available (public/mediapipe or CDN) and try again."
  }

  return DEFAULT_MODEL_ERROR
}

interface PoseLandmarkerInstance {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { landmarks?: NormalizedLandmark[][] }
  close: () => void
}

interface DrawingUtilsInstance {
  drawLandmarks: (landmarks: NormalizedLandmark[], options?: Record<string, unknown>) => void
  drawConnectors: (
    landmarks: NormalizedLandmark[],
    connections: Array<[number, number]>,
    options?: Record<string, unknown>,
  ) => void
}

interface VisionModule {
  FilesetResolver: {
    forVisionTasks: (path: string) => Promise<unknown>
  }
  PoseLandmarker: {
    createFromOptions: (vision: unknown, options: Record<string, unknown>) => Promise<PoseLandmarkerInstance>
    POSE_CONNECTIONS: Array<[number, number]>
  }
  DrawingUtils: new (ctx: CanvasRenderingContext2D) => DrawingUtilsInstance
}

type PoseComparisonStatus = "match" | "deviation" | "missing"

interface PoseComparison {
  metric: ExampleMetricRange
  value: number | null
  status: PoseComparisonStatus
  delta: number | null
}

const formatMetricValue = (metric: ExampleMetricRange, value: number | null) => {
  if (metric.unit === "ratio") {
    return formatRatio(value)
  }
  return formatDegrees(value)
}

const describeDelta = (metric: ExampleMetricRange, delta: number | null) => {
  if (delta === null || delta === 0) return "On target"
  const direction = delta > 0 ? "higher" : "lower"
  const magnitude = metric.unit === "ratio" ? Math.abs(delta).toFixed(3) : `${Math.abs(delta).toFixed(1)}°`
  return `${magnitude} ${direction} than the reference window`
}

const drawReferenceSkeleton = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[],
) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.lineWidth = 4
  ctx.strokeStyle = "rgba(30, 64, 175, 0.9)"
  ctx.fillStyle = "rgba(59, 130, 246, 0.95)"

  const scaleX = canvas.width
  const scaleY = canvas.height

  REFERENCE_CONNECTIONS.forEach(([start, end]) => {
    const a = landmarks[start]
    const b = landmarks[end]
    if (!a || !b) return
    ctx.beginPath()
    ctx.moveTo(a.x * scaleX, a.y * scaleY)
    ctx.lineTo(b.x * scaleX, b.y * scaleY)
    ctx.stroke()
  })

  landmarks.forEach((landmark) => {
    if (!landmark) return
    ctx.beginPath()
    ctx.arc(landmark.x * scaleX, landmark.y * scaleY, 5, 0, Math.PI * 2)
    ctx.fill()
  })
}

const usePoseComparisons = (analysis: PoseAnalysis | null, exercise: ExerciseExample | null) =>
  useMemo<PoseComparison[]>(() => {
    if (!analysis || !exercise) return []

    return exercise.metrics.map((metric) => {
      const key = metric.key as PoseMetricKey
      const value = analysis[key]
      if (value === null || typeof value === "undefined") {
        return { metric, value: null, status: "missing", delta: null }
      }

      const within = value >= metric.min && value <= metric.max
      let delta = 0
      if (!within) {
        if (value < metric.min) {
          delta = value - metric.min
        } else if (value > metric.max) {
          delta = value - metric.max
        }
      }

      return {
        metric,
        value,
        status: within ? "match" : "deviation",
        delta: within ? 0 : delta,
      }
    })
  }, [analysis, exercise])

export function VideoAnalyzer() {
  const [selectedExerciseId, setSelectedExerciseId] = useState(exerciseExamples[0]?.id ?? "")
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<PoseAnalysis | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const exampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const poseLandmarkerRef = useRef<PoseLandmarkerInstance | null>(null)
  const visionModuleRef = useRef<VisionModule | null>(null)
  const animationFrameRef = useRef<number>()
  const sampleTimestampRef = useRef<number>(0)
  const exampleAnimationRef = useRef<number>()

  const selectedExercise = useMemo(
    () => exerciseExamples.find((example) => example.id === selectedExerciseId) ?? null,
    [selectedExerciseId],
  )

  const comparisons = usePoseComparisons(analysis, selectedExercise)
  const comparisonScore = useMemo(() => {
    if (!comparisons.length) return null
    const usable = comparisons.filter((comparison) => comparison.value !== null)
    if (!usable.length) return null
    const matches = usable.filter((comparison) => comparison.status === "match").length
    return Math.round((matches / usable.length) * 100)
  }, [comparisons])

  const cleanupAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = undefined
    }
  }, [])

  const loadPoseLandmarker = useCallback(
    async (forceReload = false) => {
      if (typeof window === "undefined") return false
      if (isModelLoading) return false
      if (poseLandmarkerRef.current && !forceReload) return true

      if (forceReload && poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close()
        poseLandmarkerRef.current = null
      }

      if (forceReload) {
        visionModuleRef.current = null
      }

      setIsModelLoading(true)
      setModelError(null)

      try {
        const visionModule = await loadVisionModule()
        const fileset = await resolveVisionFileset(visionModule)
        const landmarker = await createPoseLandmarkerInstance(visionModule, fileset)

        visionModuleRef.current = visionModule
        poseLandmarkerRef.current = landmarker
        return true
      } catch (error) {
        console.error(error)
        poseLandmarkerRef.current = null
        visionModuleRef.current = null
        setModelError(getModelLoadErrorMessage(error))
        return false
      } finally {
        setIsModelLoading(false)
      }
    },
    [isModelLoading],
  )

  useEffect(() => {
    void loadPoseLandmarker()
    return () => {
      cleanupAnimation()
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close()
        poseLandmarkerRef.current = null
      }
      if (uploadedVideoUrl) {
        URL.revokeObjectURL(uploadedVideoUrl)
      }
      if (exampleAnimationRef.current) {
        window.clearInterval(exampleAnimationRef.current)
      }
    }
  }, [cleanupAnimation, loadPoseLandmarker, uploadedVideoUrl])

  useEffect(() => {
    const video = videoRef.current
    const canvas = overlayRef.current
    if (!video || !canvas) return

    const handleMetadata = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }

    video.addEventListener("loadedmetadata", handleMetadata)
    return () => {
      video.removeEventListener("loadedmetadata", handleMetadata)
    }
  }, [])

  useEffect(() => {
    const canvas = exampleCanvasRef.current
    if (!canvas || !selectedExercise) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = 480
    canvas.height = 270

    if (exampleAnimationRef.current) {
      window.clearInterval(exampleAnimationRef.current)
    }

    let frameIndex = 0
    const frames = selectedExercise.referenceFrames
    const tick = () => {
      const frame = frames[frameIndex]
      if (frame) {
        drawReferenceSkeleton(ctx, canvas, frame)
      }
      frameIndex = (frameIndex + 1) % frames.length
    }

    tick()
    exampleAnimationRef.current = window.setInterval(tick, 350)

    return () => {
      if (exampleAnimationRef.current) {
        window.clearInterval(exampleAnimationRef.current)
        exampleAnimationRef.current = undefined
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [selectedExercise])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("video/")) {
      setUploadError("Please select a video file (mp4, mov, webm, etc.).")
      setUploadedVideoUrl(null)
      setAnalysis(null)
      return
    }

    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl)
    }

    const url = URL.createObjectURL(file)
    setUploadedVideoUrl(url)
    setUploadError(null)
    setAnalysis(null)
  }

  const resetVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
    cleanupAnimation()
  }, [cleanupAnimation])

  const finalizeAnalysis = useCallback(
    (accumulator = createPoseAccumulator()) => {
      const summary = finalizePoseMetrics(accumulator)
      setAnalysis(summary.frameCount > 0 ? summary : null)
      setIsProcessing(false)
    },
    [],
  )

  const processVideo = useCallback(() => {
    const landmarker = poseLandmarkerRef.current
    const visionModule = visionModuleRef.current
    const video = videoRef.current
    const canvas = overlayRef.current

    if (!landmarker || !visionModule || !video || !canvas) {
      setModelError((previous) =>
        previous ?? "Pose model is not ready yet. Wait for the model to finish loading and try again.",
      )
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setModelError("Unable to read drawing context for overlay.")
      return
    }

    const accumulator = createPoseAccumulator()
    const drawingUtils = new visionModule.DrawingUtils(ctx)
    sampleTimestampRef.current = 0
    setIsProcessing(true)
    setAnalysis(null)

    const handleFrame = () => {
      if (!video || video.paused || video.ended) {
        finalizeAnalysis(accumulator)
        return
      }

      const now = performance.now()
      if (now - sampleTimestampRef.current < 80) {
        animationFrameRef.current = requestAnimationFrame(handleFrame)
        return
      }

      sampleTimestampRef.current = now
      const result = landmarker.detectForVideo(video, now)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (result.landmarks && result.landmarks.length > 0) {
        const pose = result.landmarks[0]
        drawingUtils.drawConnectors(pose, visionModule.PoseLandmarker.POSE_CONNECTIONS, {
          lineWidth: 3,
          color: "rgba(79, 70, 229, 0.85)",
        })
        drawingUtils.drawLandmarks(pose, {
          radius: 4,
          fillColor: "rgba(59, 130, 246, 0.9)",
        })
        accumulatePoseMetrics(accumulator, pose)
      }

      animationFrameRef.current = requestAnimationFrame(handleFrame)
    }

    const handleEnded = () => {
      finalizeAnalysis(accumulator)
    }

    const handlePause = () => {
      if (!video.ended) {
        finalizeAnalysis(accumulator)
      }
    }

    video.addEventListener("ended", handleEnded, { once: true })
    video.addEventListener("pause", handlePause, { once: true })

    const startPlayback = async () => {
      try {
        await video.play()
        animationFrameRef.current = requestAnimationFrame(handleFrame)
      } catch (error) {
        console.error(error)
        setModelError("Unable to start video playback. Try a different file format.")
        finalizeAnalysis(accumulator)
      }
    }

    video.currentTime = 0
    startPlayback()
  }, [finalizeAnalysis])

  const handleAnalyze = useCallback(async () => {
    if (!uploadedVideoUrl) {
      setUploadError("Upload a training video before running the analyzer.")
      return
    }

    let ready = true
    if (!poseLandmarkerRef.current) {
      ready = await loadPoseLandmarker()
    }

    if (!ready || !poseLandmarkerRef.current) {
      return
    }

    resetVideo()
    processVideo()
  }, [loadPoseLandmarker, processVideo, resetVideo, uploadedVideoUrl])

  useEffect(() => () => cleanupAnimation(), [cleanupAnimation])

  const handleReset = () => {
    resetVideo()
    setAnalysis(null)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl)
      setUploadedVideoUrl(null)
    }
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-b from-background to-primary/5">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Technique Analyzer</CardTitle>
            <CardDescription>
              Upload a training clip to overlay MediaPipe pose tracking and compare key technique metrics
              against a reference example.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary">
            Experimental
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Exercise focus</label>
            <select
              className="w-full rounded-lg border bg-background p-2 text-sm"
              value={selectedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
            >
              {exerciseExamples.map((example) => (
                <option key={example.id} value={example.id}>
                  {example.name}
                </option>
              ))}
            </select>
            {selectedExercise && (
              <p className="text-xs text-muted-foreground">{selectedExercise.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Upload your session</label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Videos are processed on-device in your browser and never leave this session.
            </p>
            {uploadError && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Video className="h-4 w-4" /> Reference cues
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {selectedExercise?.cues.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={isProcessing || isModelLoading}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Analyze technique
                </>
              )}
            </Button>
            {modelError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div className="space-y-2">
                  <span className="block">{modelError}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs text-destructive"
                    onClick={() => void loadPoseLandmarker(true)}
                    disabled={isModelLoading}
                  >
                    {isModelLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Retrying…
                      </span>
                    ) : (
                      "Retry model load"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-xl border bg-background">
              <video ref={videoRef} controls className="h-full w-full object-contain" playsInline />
              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {comparisonScore !== null && (
                <Badge className="bg-primary text-primary-foreground">
                  Technique score: {comparisonScore}% within target
                </Badge>
              )}
              {analysis?.frameCount && (
                <span className="text-xs text-muted-foreground">
                  {analysis.frameCount} frames analyzed
                </span>
              )}
              {uploadedVideoUrl && !isProcessing && (
                <Button variant="ghost" size="sm" onClick={handleAnalyze} className="h-7 px-3 text-xs">
                  Re-run analysis
                </Button>
              )}
              {uploadedVideoUrl && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-3 text-xs">
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-xl border bg-background">
              <canvas ref={exampleCanvasRef} className="h-full w-full" />
              <div className="absolute bottom-3 left-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground">
                Reference example
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Metric comparison</h3>
              <div className="grid gap-3">
                {comparisons.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Upload a video and run the analyzer to see how your movement stacks up against the reference model.
                  </p>
                )}
                {comparisons.map((comparison) => {
                  const withinRange = comparison.status === "match"
                  const badgeVariant = withinRange ? "default" : "outline"
                  const badgeClass = withinRange
                    ? "bg-emerald-500 text-emerald-50"
                    : comparison.status === "missing"
                      ? "border-border text-muted-foreground"
                      : "border-amber-500 text-amber-500"

                  return (
                    <div
                      key={comparison.metric.key}
                      className="rounded-lg border border-border/60 bg-background p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{comparison.metric.label}</p>
                          <p className="text-xs text-muted-foreground">{comparison.metric.description}</p>
                        </div>
                        <Badge variant={badgeVariant} className={badgeClass}>
                          {comparison.status === "missing"
                            ? "No data"
                            : withinRange
                              ? "On target"
                              : "Needs attention"}
                        </Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-foreground">Your metric</span>
                          <span className="text-foreground font-medium">
                            {formatMetricValue(comparison.metric, comparison.value)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Reference window</span>
                          <span>
                            {formatMetricValue(comparison.metric, comparison.metric.min)} —
                            {" "}
                            {formatMetricValue(comparison.metric, comparison.metric.max)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Difference</span>
                          <span>{describeDelta(comparison.metric, comparison.delta)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
