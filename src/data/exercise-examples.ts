import { NormalizedLandmark, PoseMetricKey } from "@/lib/pose-utils"

export interface ExampleMetricRange {
  key: PoseMetricKey
  label: string
  description: string
  unit: "degrees" | "ratio"
  min: number
  max: number
}

export interface ExerciseExample {
  id: string
  name: string
  description: string
  cues: string[]
  metrics: ExampleMetricRange[]
  referenceFrames: NormalizedLandmark[][]
}

const createEmptyPose = (): NormalizedLandmark[] =>
  Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))

const createSquatFrame = (depth: number): NormalizedLandmark[] => {
  const frame = createEmptyPose()

  const headY = 0.18 + depth * 0.04
  const shoulderY = 0.3 + depth * 0.05
  const hipY = 0.5 + depth * 0.12
  const kneeY = 0.68 + depth * 0.15
  const ankleY = 0.9

  const hipShift = depth * 0.03
  const kneeShift = depth * 0.04
  const torsoForward = depth * 0.015

  frame[0] = { x: 0.5, y: headY, z: 0 }
  frame[1] = { x: 0.5, y: headY + 0.02, z: 0 }
  frame[2] = { x: 0.5, y: headY + 0.04, z: 0 }
  frame[3] = { x: 0.5, y: headY + 0.06, z: 0 }

  frame[11] = { x: 0.46 + torsoForward, y: shoulderY, z: 0 }
  frame[12] = { x: 0.54 + torsoForward, y: shoulderY, z: 0 }

  frame[13] = { x: 0.42 + torsoForward * 1.3, y: shoulderY + 0.07, z: 0 }
  frame[14] = { x: 0.58 + torsoForward * 1.3, y: shoulderY + 0.07, z: 0 }
  frame[15] = { x: 0.4 + torsoForward * 1.6, y: shoulderY + 0.12, z: 0 }
  frame[16] = { x: 0.6 + torsoForward * 1.6, y: shoulderY + 0.12, z: 0 }

  frame[23] = { x: 0.46 - hipShift, y: hipY, z: 0 }
  frame[24] = { x: 0.54 + hipShift, y: hipY, z: 0 }

  frame[25] = { x: 0.46 + kneeShift, y: kneeY, z: 0 }
  frame[26] = { x: 0.54 - kneeShift, y: kneeY, z: 0 }

  frame[27] = { x: 0.45, y: ankleY, z: 0 }
  frame[28] = { x: 0.55, y: ankleY, z: 0 }

  frame[19] = { x: 0.44, y: shoulderY + 0.04, z: 0 }
  frame[20] = { x: 0.56, y: shoulderY + 0.04, z: 0 }

  return frame
}

const squatReferenceFrames = [0, 0.25, 0.5, 0.75, 1].map(createSquatFrame)

export const exerciseExamples: ExerciseExample[] = [
  {
    id: "bodyweight-squat",
    name: "Bodyweight Squat",
    description: "Benchmark squat pattern focusing on depth, knee tracking, and posture.",
    cues: [
      "Sit the hips back first to load the posterior chain.",
      "Keep the chest lifted and ribs stacked over the pelvis.",
      "Drive the knees out so they follow the line of the toes.",
    ],
    metrics: [
      {
        key: "minKneeAngle",
        label: "Bottom knee flexion",
        description: "Target parallel or slightly below parallel depth.",
        unit: "degrees",
        min: 80,
        max: 95,
      },
      {
        key: "maxHipAngle",
        label: "Hip extension at finish",
        description: "Full hip extension shows a strong lockout at the top.",
        unit: "degrees",
        min: 165,
        max: 180,
      },
      {
        key: "avgTorsoLean",
        label: "Average torso lean",
        description: "Maintain a neutral spine with controlled forward lean.",
        unit: "degrees",
        min: 5,
        max: 20,
      },
      {
        key: "stanceSymmetry",
        label: "Stance symmetry",
        description: "Aim for even loading between left and right sides.",
        unit: "ratio",
        min: 0,
        max: 0.05,
      },
    ],
    referenceFrames: squatReferenceFrames,
  },
]

export const getExerciseExample = (id: string) =>
  exerciseExamples.find((example) => example.id === id)
