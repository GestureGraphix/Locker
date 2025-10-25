import { NextRequest, NextResponse } from "next/server"

import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth"

export const runtime = "nodejs"

const parseId = (raw: string): number | null => {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

type NormalizedMobilityExercise = {
  id: number
  group: string
  name: string
  youtubeUrl: string | null
  prescription: string | null
  thumbnail: string | null
}

const toResponse = (exercise: {
  id: number
  userId: number
  group: string
  name: string
  youtubeUrl: string | null
  prescription: string | null
  thumbnail: string | null
}) => ({
  id: exercise.id,
  group: exercise.group,
  name: exercise.name,
  ...(exercise.youtubeUrl ? { youtubeUrl: exercise.youtubeUrl } : {}),
  ...(exercise.prescription ? { prescription: exercise.prescription } : {}),
  ...(exercise.thumbnail ? { thumbnail: exercise.thumbnail } : {}),
})

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toPositiveInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

const normalizeMobilityExercises = (
  value: unknown
): { ok: true; exercises: NormalizedMobilityExercise[] } | { ok: false; error: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, error: "mobilityExercises must be an array." }
  }

  if (value.length > 200) {
    return { ok: false, error: "Too many mobility exercises provided." }
  }

  const exercises: NormalizedMobilityExercise[] = []
  const seenIds = new Set<number>()

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid mobility exercise entry." }
    }

    const record = item as Record<string, unknown>

    const id = toPositiveInteger(record.id)
    if (id == null) {
      return { ok: false, error: "Mobility exercise id must be a positive integer." }
    }
    if (seenIds.has(id)) {
      return { ok: false, error: "Duplicate mobility exercise id detected." }
    }
    seenIds.add(id)

    const group = toStringOrNull(record.group)
    if (!group) {
      return { ok: false, error: "Mobility exercise group is required." }
    }

    const name = toStringOrNull(record.name)
    if (!name) {
      return { ok: false, error: "Mobility exercise name is required." }
    }

    const youtubeUrl = toStringOrNull(record.youtubeUrl)
    const prescription = toStringOrNull(record.prescription)
    const thumbnail = toStringOrNull(record.thumbnail)

    exercises.push({
      id,
      group,
      name,
      youtubeUrl,
      prescription,
      thumbnail,
    })
  }

  return { ok: true, exercises }
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

  const exercises = await prisma.mobilityExercise.findMany({
    where: { userId: athleteId },
    orderBy: [{ id: "asc" }],
  })

  return NextResponse.json({ mobilityExercises: exercises.map(toResponse) })
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

  const payload = body as { mobilityExercises?: unknown }

  if (!Object.prototype.hasOwnProperty.call(payload, "mobilityExercises")) {
    return NextResponse.json({ error: "mobilityExercises is required." }, { status: 400 })
  }

  const normalized = normalizeMobilityExercises(payload.mobilityExercises)
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.mobilityExercise.findMany({
        where: { userId: athleteId },
        select: { id: true },
      })

      const incomingIds = new Set(normalized.exercises.map((exercise) => exercise.id))
      const idsToDelete = existing
        .map((entry) => entry.id)
        .filter((entryId) => !incomingIds.has(entryId))

      if (idsToDelete.length > 0) {
        await tx.mobilityExercise.deleteMany({
          where: {
            userId: athleteId,
            id: { in: idsToDelete },
          },
        })
      }

      for (const exercise of normalized.exercises) {
        await tx.mobilityExercise.upsert({
          where: {
            userId_id: {
              userId: athleteId,
              id: exercise.id,
            },
          },
          update: {
            group: exercise.group,
            name: exercise.name,
            youtubeUrl: exercise.youtubeUrl,
            prescription: exercise.prescription,
            thumbnail: exercise.thumbnail,
          },
          create: {
            userId: athleteId,
            id: exercise.id,
            group: exercise.group,
            name: exercise.name,
            youtubeUrl: exercise.youtubeUrl,
            prescription: exercise.prescription,
            thumbnail: exercise.thumbnail,
          },
        })
      }

      if (normalized.exercises.length === 0) {
        await tx.mobilityExercise.deleteMany({ where: { userId: athleteId } })
      }
    })

    const updated = await prisma.mobilityExercise.findMany({
      where: { userId: athleteId },
      orderBy: [{ id: "asc" }],
    })

    return NextResponse.json({ mobilityExercises: updated.map(toResponse) })
  } catch (error) {
    console.error("Failed to persist mobility exercises", error)
    return NextResponse.json({ error: "Unable to save mobility exercises." }, { status: 500 })
  }
}
