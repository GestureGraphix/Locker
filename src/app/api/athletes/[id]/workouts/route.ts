import { NextRequest, NextResponse } from "next/server"

import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth"

export const runtime = "nodejs"

const parseId = (raw: string): number | null => {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

type NormalizedWorkout = {
  id: number
  title: string
  focus: string
  dueDate: Date
  status: "Scheduled" | "Completed"
  intensity: string
  assignedBy: string | null
}

const toResponse = (workout: {
  id: number
  userId: number
  title: string
  focus: string
  dueDate: Date
  status: string
  intensity: string
  assignedBy: string | null
}) => ({
  id: workout.id,
  title: workout.title,
  focus: workout.focus,
  dueDate: workout.dueDate.toISOString().split("T")[0],
  status: workout.status === "Completed" ? "Completed" : "Scheduled",
  intensity: workout.intensity,
  ...(workout.assignedBy ? { assignedBy: workout.assignedBy } : {}),
})

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const normalizeWorkouts = (
  value: unknown
): { ok: true; workouts: NormalizedWorkout[] } | { ok: false; error: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, error: "workouts must be an array." }
  }

  if (value.length > 200) {
    return { ok: false, error: "Too many workouts provided." }
  }

  const workouts: NormalizedWorkout[] = []
  const seenIds = new Set<number>()

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid workout entry." }
    }

    const record = item as Record<string, unknown>

    const idNumber = toNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) {
      return { ok: false, error: "Workout id must be a positive integer." }
    }
    if (seenIds.has(idNumber)) {
      return { ok: false, error: "Duplicate workout id detected." }
    }
    seenIds.add(idNumber)

    if (typeof record.title !== "string" || !record.title.trim()) {
      return { ok: false, error: "Workout title is required." }
    }
    const title = record.title.trim()

    if (typeof record.focus !== "string" || !record.focus.trim()) {
      return { ok: false, error: "Workout focus is required." }
    }
    const focus = record.focus.trim()

    if (typeof record.dueDate !== "string" || !record.dueDate.trim()) {
      return { ok: false, error: "Workout dueDate is required." }
    }
    const dueDateRaw = record.dueDate.trim()
    const dueDate = new Date(
      dueDateRaw.includes("T") ? dueDateRaw : `${dueDateRaw}T00:00:00.000Z`
    )
    if (Number.isNaN(dueDate.getTime())) {
      return { ok: false, error: "Workout dueDate is invalid." }
    }

    if (typeof record.status !== "string" || !record.status.trim()) {
      return { ok: false, error: "Workout status is required." }
    }
    const statusNormalized = record.status.trim().toLowerCase()
    let status: NormalizedWorkout["status"]
    if (statusNormalized === "completed") {
      status = "Completed"
    } else if (statusNormalized === "scheduled") {
      status = "Scheduled"
    } else {
      return { ok: false, error: "Workout status is invalid." }
    }

    if (typeof record.intensity !== "string" || !record.intensity.trim()) {
      return { ok: false, error: "Workout intensity is required." }
    }
    const intensity = record.intensity.trim()

    const assignedBy =
      typeof record.assignedBy === "string" && record.assignedBy.trim()
        ? record.assignedBy.trim()
        : null

    workouts.push({
      id: idNumber,
      title,
      focus,
      dueDate,
      status,
      intensity,
      assignedBy,
    })
  }

  return { ok: true, workouts }
}

async function ensureAuthorized(athleteId: number) {
  const user = await getSessionUser()
  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    }
  }

  if (String(user.role) === "ATHLETE" && user.id !== athleteId) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    }
  }

  return { ok: true as const, user }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const athleteId = parseId(id)
  if (!athleteId) {
    return NextResponse.json({ error: "Invalid athlete id." }, { status: 400 })
  }

  const auth = await ensureAuthorized(athleteId)
  if (!auth.ok) return auth.res

  const workouts = await prisma.workoutLog.findMany({
    where: { userId: athleteId },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  })

  return NextResponse.json({ workouts: workouts.map(toResponse) })
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const athleteId = parseId(id)
  if (!athleteId) {
    return NextResponse.json({ error: "Invalid athlete id." }, { status: 400 })
  }

  const auth = await ensureAuthorized(athleteId)
  if (!auth.ok) return auth.res

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const payload = body as { workouts?: unknown }

  if (!Object.prototype.hasOwnProperty.call(payload, "workouts")) {
    return NextResponse.json({ error: "workouts is required." }, { status: 400 })
  }

  const normalized = normalizeWorkouts(payload.workouts)
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.workoutLog.findMany({
        where: { userId: athleteId },
        select: { id: true },
      })

      const incomingIds = new Set(normalized.workouts.map((workout) => workout.id))
      const idsToDelete = existing
        .map((entry) => entry.id)
        .filter((entryId) => !incomingIds.has(entryId))

      if (idsToDelete.length > 0) {
        await tx.workoutLog.deleteMany({
          where: {
            userId: athleteId,
            id: { in: idsToDelete },
          },
        })
      }

      for (const workout of normalized.workouts) {
        await tx.workoutLog.upsert({
          where: {
            userId_id: {
              userId: athleteId,
              id: workout.id,
            },
          },
          update: {
            title: workout.title,
            focus: workout.focus,
            dueDate: workout.dueDate,
            status: workout.status,
            intensity: workout.intensity,
            assignedBy: workout.assignedBy,
          },
          create: {
            userId: athleteId,
            id: workout.id,
            title: workout.title,
            focus: workout.focus,
            dueDate: workout.dueDate,
            status: workout.status,
            intensity: workout.intensity,
            assignedBy: workout.assignedBy,
          },
        })
      }

      if (normalized.workouts.length === 0) {
        await tx.workoutLog.deleteMany({ where: { userId: athleteId } })
      }
    })

    const updated = await prisma.workoutLog.findMany({
      where: { userId: athleteId },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    })

    return NextResponse.json({ workouts: updated.map(toResponse) })
  } catch (error) {
    console.error("Failed to persist workouts", error)
    return NextResponse.json({ error: "Unable to save workouts." }, { status: 500 })
  }
}
