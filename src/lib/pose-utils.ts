export type NormalizedLandmark = {
  x: number
  y: number
  z: number
  visibility?: number
}

type LandmarkTuple = [number, number]

const LANDMARK_INDICES = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
}

const DEGREE = 180 / Math.PI

const MIN_VISIBILITY = 0.3

const hasVisibility = (landmark: NormalizedLandmark | undefined) => {
  if (!landmark) return false
  if (typeof landmark.visibility !== "number") return true
  return landmark.visibility >= MIN_VISIBILITY
}

const isValid = (landmarks: NormalizedLandmark[], indices: number[]) =>
  indices.every((index) => hasVisibility(landmarks[index]))

const calculateAngle = (
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark,
) => {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const dot = ab.x * cb.x + ab.y * cb.y
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2)
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2)
  if (magAB === 0 || magCB === 0) return null
  const cosine = dot / (magAB * magCB)
  const clamped = Math.min(1, Math.max(-1, cosine))
  return Math.acos(clamped) * DEGREE
}

const midpoint = (a: NormalizedLandmark, b: NormalizedLandmark) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

export interface PoseMetricAccumulator {
  minKneeAngle: number
  maxHipAngle: number
  torsoLeanSum: number
  stanceSymmetrySum: number
  frames: number
}

export interface PoseAnalysis {
  minKneeAngle: number | null
  maxHipAngle: number | null
  avgTorsoLean: number | null
  stanceSymmetry: number | null
  frameCount: number
}

export const createPoseAccumulator = (): PoseMetricAccumulator => ({
  minKneeAngle: Number.POSITIVE_INFINITY,
  maxHipAngle: 0,
  torsoLeanSum: 0,
  stanceSymmetrySum: 0,
  frames: 0,
})

export const accumulatePoseMetrics = (
  accumulator: PoseMetricAccumulator,
  landmarks: NormalizedLandmark[],
) => {
  if (!landmarks || landmarks.length === 0) return

  let validFrame = false

  const leftKneeIndices = [
    LANDMARK_INDICES.LEFT_HIP,
    LANDMARK_INDICES.LEFT_KNEE,
    LANDMARK_INDICES.LEFT_ANKLE,
  ]
  const rightKneeIndices = [
    LANDMARK_INDICES.RIGHT_HIP,
    LANDMARK_INDICES.RIGHT_KNEE,
    LANDMARK_INDICES.RIGHT_ANKLE,
  ]

  const kneeAngles: number[] = []
  if (isValid(landmarks, leftKneeIndices)) {
    const angle = calculateAngle(
      landmarks[LANDMARK_INDICES.LEFT_HIP],
      landmarks[LANDMARK_INDICES.LEFT_KNEE],
      landmarks[LANDMARK_INDICES.LEFT_ANKLE],
    )
    if (typeof angle === "number") {
      kneeAngles.push(angle)
      validFrame = true
    }
  }

  if (isValid(landmarks, rightKneeIndices)) {
    const angle = calculateAngle(
      landmarks[LANDMARK_INDICES.RIGHT_HIP],
      landmarks[LANDMARK_INDICES.RIGHT_KNEE],
      landmarks[LANDMARK_INDICES.RIGHT_ANKLE],
    )
    if (typeof angle === "number") {
      kneeAngles.push(angle)
      validFrame = true
    }
  }

  if (kneeAngles.length > 0) {
    const minKneeAngle = Math.min(...kneeAngles)
    accumulator.minKneeAngle = Math.min(accumulator.minKneeAngle, minKneeAngle)
  }

  const hipAngles: number[] = []
  const leftHipIndices = [
    LANDMARK_INDICES.LEFT_SHOULDER,
    LANDMARK_INDICES.LEFT_HIP,
    LANDMARK_INDICES.LEFT_KNEE,
  ]
  const rightHipIndices = [
    LANDMARK_INDICES.RIGHT_SHOULDER,
    LANDMARK_INDICES.RIGHT_HIP,
    LANDMARK_INDICES.RIGHT_KNEE,
  ]

  if (isValid(landmarks, leftHipIndices)) {
    const angle = calculateAngle(
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER],
      landmarks[LANDMARK_INDICES.LEFT_HIP],
      landmarks[LANDMARK_INDICES.LEFT_KNEE],
    )
    if (typeof angle === "number") {
      hipAngles.push(angle)
      validFrame = true
    }
  }

  if (isValid(landmarks, rightHipIndices)) {
    const angle = calculateAngle(
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER],
      landmarks[LANDMARK_INDICES.RIGHT_HIP],
      landmarks[LANDMARK_INDICES.RIGHT_KNEE],
    )
    if (typeof angle === "number") {
      hipAngles.push(angle)
      validFrame = true
    }
  }

  if (hipAngles.length > 0) {
    const maxHipAngle = Math.max(...hipAngles)
    accumulator.maxHipAngle = Math.max(accumulator.maxHipAngle, maxHipAngle)
  }

  if (
    isValid(landmarks, [
      LANDMARK_INDICES.LEFT_SHOULDER,
      LANDMARK_INDICES.RIGHT_SHOULDER,
      LANDMARK_INDICES.LEFT_HIP,
      LANDMARK_INDICES.RIGHT_HIP,
    ])
  ) {
    const leftShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER]
    const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER]
    const leftHip = landmarks[LANDMARK_INDICES.LEFT_HIP]
    const rightHip = landmarks[LANDMARK_INDICES.RIGHT_HIP]

    const shouldersMid = midpoint(leftShoulder, rightShoulder)
    const hipsMid = midpoint(leftHip, rightHip)
    const torso = { x: shouldersMid.x - hipsMid.x, y: shouldersMid.y - hipsMid.y }

    const leanRadians = Math.atan2(torso.x, -torso.y)
    const leanDegrees = Math.abs(leanRadians * DEGREE)
    accumulator.torsoLeanSum += leanDegrees
    validFrame = true
  }

  if (
    isValid(landmarks, [
      LANDMARK_INDICES.LEFT_ANKLE,
      LANDMARK_INDICES.RIGHT_ANKLE,
      LANDMARK_INDICES.LEFT_HIP,
      LANDMARK_INDICES.RIGHT_HIP,
    ])
  ) {
    const leftAnkle = landmarks[LANDMARK_INDICES.LEFT_ANKLE]
    const rightAnkle = landmarks[LANDMARK_INDICES.RIGHT_ANKLE]
    const leftHip = landmarks[LANDMARK_INDICES.LEFT_HIP]
    const rightHip = landmarks[LANDMARK_INDICES.RIGHT_HIP]

    const leftDistance = Math.abs(leftAnkle.x - leftHip.x)
    const rightDistance = Math.abs(rightAnkle.x - rightHip.x)
    const stanceDiff = Math.abs(leftDistance - rightDistance)
    accumulator.stanceSymmetrySum += stanceDiff
    validFrame = true
  }

  if (validFrame) {
    accumulator.frames += 1
  }
}

export const finalizePoseMetrics = (
  accumulator: PoseMetricAccumulator,
): PoseAnalysis => ({
  minKneeAngle:
    accumulator.minKneeAngle === Number.POSITIVE_INFINITY
      ? null
      : accumulator.minKneeAngle,
  maxHipAngle: accumulator.maxHipAngle === 0 ? null : accumulator.maxHipAngle,
  avgTorsoLean:
    accumulator.frames === 0 ? null : accumulator.torsoLeanSum / accumulator.frames,
  stanceSymmetry:
    accumulator.frames === 0
      ? null
      : accumulator.stanceSymmetrySum / accumulator.frames,
  frameCount: accumulator.frames,
})

export const REFERENCE_CONNECTIONS: LandmarkTuple[] = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [15, 21],
  [16, 22],
]

export type PoseMetricKey = keyof Omit<PoseAnalysis, "frameCount">

export const formatDegrees = (value: number | null, fractionDigits = 1) =>
  typeof value === "number" ? `${value.toFixed(fractionDigits)}°` : "—"

export const formatRatio = (value: number | null, fractionDigits = 3) =>
  typeof value === "number" ? value.toFixed(fractionDigits) : "—"
