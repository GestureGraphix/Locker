import { NextRequest, NextResponse } from "next/server"

import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth"

export const runtime = "nodejs"

const parseId = (raw: string): number | null => {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

type NormalizedMobilityLog = {
  id: number
  exerciseId: number
  exerciseName: string
  date: Date
  durationMinutes: number
  notes: string | null
}

const toResponse = (log: {
  id: number
  userId: number
  exerciseId: number
  exerciseName: string
  date: Date
  durationMinutes: number
  notes: string | null
}) => ({
  id: log.id,
  exerciseId: log.exerciseId,
  exerciseName: log.exerciseName,
  date: log.date.toISOString().split("T")[0],
  durationMin: log.durationMinutes,
  ...(log.notes ? { notes: log.notes } : {}),
})

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

const toNonNegativeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }
  return null
}

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toDate = (value: unknown): Date | null => {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw) return null
  const iso = raw.includes("T") ? raw : `${raw}T00:00:00.000Z`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

const normalizeMobilityLogs = (
  value: unknown
): { ok: true; logs: NormalizedMobilityLog[] } | { ok: false; error: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, error: "mobilityLogs must be an array." }
  }

  if (value.length > 500) {
    return { ok: false, error: "Too many mobility logs provided." }
  }

  const logs: NormalizedMobilityLog[] = []
  const seenIds = new Set<number>()

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid mobility log entry." }
    }

    const record = item as Record<string, unknown>

    const id = toPositiveInteger(record.id)
    if (id == null) {
      return { ok: false, error: "Mobility log id must be a positive integer." }
    }
    if (seenIds.has(id)) {
      return { ok: false, error: "Duplicate mobility log id detected." }
    }
    seenIds.add(id)

    const exerciseId = toPositiveInteger(record.exerciseId)
    if (exerciseId == null) {
      return { ok: false, error: "Mobility log exerciseId must be a positive integer." }
    }

    const exerciseName = toTrimmedString(record.exerciseName)
    if (!exerciseName) {
      return { ok: false, error: "Mobility log exerciseName is required." }
    }

    const date = toDate(record.date)
    if (!date) {
      return { ok: false, error: "Mobility log date is invalid." }
    }

    const duration = toNonNegativeNumber(record.durationMin ?? record.durationMinutes)
    if (duration == null) {
      return { ok: false, error: "Mobility log durationMin must be a non-negative number." }
    }

    const notes = toTrimmedString(record.notes)

    logs.push({
      id,
      exerciseId,
      exerciseName,
      date,
      durationMinutes: Math.round(duration),
      notes,
    })
  }

  return { ok: true, logs }
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

  const logs = await prisma.mobilityLog.findMany({
    where: { userId: athleteId },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  })

  return NextResponse.json({ mobilityLogs: logs.map(toResponse) })
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

  const payload = body as { mobilityLogs?: unknown }

  if (!Object.prototype.hasOwnProperty.call(payload, "mobilityLogs")) {
    return NextResponse.json({ error: "mobilityLogs is required." }, { status: 400 })
  }

  const normalized = normalizeMobilityLogs(payload.mobilityLogs)
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.mobilityLog.findMany({
        where: { userId: athleteId },
        select: { id: true },
      })

      const incomingIds = new Set(normalized.logs.map((log) => log.id))
      const idsToDelete = existing
        .map((entry) => entry.id)
        .filter((entryId) => !incomingIds.has(entryId))

      if (idsToDelete.length > 0) {
        await tx.mobilityLog.deleteMany({
          where: {
            userId: athleteId,
            id: { in: idsToDelete },
          },
        })
      }

      for (const log of normalized.logs) {
        await tx.mobilityLog.upsert({
          where: {
            userId_id: {
              userId: athleteId,
              id: log.id,
            },
          },
          update: {
            exerciseId: log.exerciseId,
            exerciseName: log.exerciseName,
            date: log.date,
            durationMinutes: log.durationMinutes,
            notes: log.notes,
          },
          create: {
            userId: athleteId,
            id: log.id,
            exerciseId: log.exerciseId,
            exerciseName: log.exerciseName,
            date: log.date,
            durationMinutes: log.durationMinutes,
            notes: log.notes,
          },
        })
      }

      if (normalized.logs.length === 0) {
        await tx.mobilityLog.deleteMany({ where: { userId: athleteId } })
      }
    })

    const updated = await prisma.mobilityLog.findMany({
      where: { userId: athleteId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    })

    return NextResponse.json({ mobilityLogs: updated.map(toResponse) })
  } catch (error) {
    console.error("Failed to persist mobility logs", error)
    return NextResponse.json({ error: "Unable to save mobility logs." }, { status: 500 })
  }
}
