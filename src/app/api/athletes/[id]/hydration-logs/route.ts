import { NextRequest, NextResponse } from "next/server"

import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth"

export const runtime = "nodejs"

const parseId = (raw: string): number | null => {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

type NormalizedHydrationLog = {
  id: number
  date: Date
  ounces: number
  source: string
  time: string
}

const toResponse = (log: {
  id: number
  userId: number
  date: Date
  ounces: number
  source: string
  time: string
}) => ({
  id: log.id,
  date: log.date.toISOString().split("T")[0],
  ounces: log.ounces,
  source: log.source,
  time: log.time,
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

const normalizeHydrationLogs = (
  value: unknown
): { ok: true; logs: NormalizedHydrationLog[] } | { ok: false; error: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, error: "hydrationLogs must be an array." }
  }

  if (value.length > 200) {
    return { ok: false, error: "Too many hydration logs provided." }
  }

  const logs: NormalizedHydrationLog[] = []
  const seenIds = new Set<number>()

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid hydration log entry." }
    }

    const record = item as Record<string, unknown>

    const idNumber = toNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) {
      return { ok: false, error: "Hydration log id must be a positive integer." }
    }
    if (seenIds.has(idNumber)) {
      return { ok: false, error: "Duplicate hydration log id detected." }
    }
    seenIds.add(idNumber)

    if (typeof record.date !== "string" || !record.date.trim()) {
      return { ok: false, error: "Hydration log date is required." }
    }
    const dateValue = record.date.trim()
    const date = new Date(`${dateValue}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime())) {
      return { ok: false, error: "Hydration log date is invalid." }
    }

    const ouncesNumber = toNumber(record.ounces)
    if (ouncesNumber == null || ouncesNumber < 0) {
      return {
        ok: false,
        error: "Hydration log ounces must be a non-negative number.",
      }
    }
    const ounces = Math.round(ouncesNumber)

    if (typeof record.source !== "string" || !record.source.trim()) {
      return { ok: false, error: "Hydration log source is required." }
    }
    const source = record.source.trim()

    if (typeof record.time !== "string" || !record.time.trim()) {
      return { ok: false, error: "Hydration log time is required." }
    }
    const time = record.time.trim()

    logs.push({
      id: idNumber,
      date,
      ounces,
      source,
      time,
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

  const logs = await prisma.hydrationLog.findMany({
    where: { userId: athleteId },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  })

  return NextResponse.json({ hydrationLogs: logs.map(toResponse) })
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

  const payload = body as { hydrationLogs?: unknown }

  if (!Object.prototype.hasOwnProperty.call(payload, "hydrationLogs")) {
    return NextResponse.json({ error: "hydrationLogs is required." }, { status: 400 })
  }

  const normalized = normalizeHydrationLogs(payload.hydrationLogs)
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.hydrationLog.findMany({
        where: { userId: athleteId },
        select: { id: true },
      })

      const incomingIds = new Set(normalized.logs.map((log) => log.id))
      const idsToDelete = existing
        .map((entry) => entry.id)
        .filter((entryId) => !incomingIds.has(entryId))

      if (idsToDelete.length > 0) {
        await tx.hydrationLog.deleteMany({
          where: {
            userId: athleteId,
            id: { in: idsToDelete },
          },
        })
      }

      for (const log of normalized.logs) {
        await tx.hydrationLog.upsert({
          where: {
            userId_id: {
              userId: athleteId,
              id: log.id,
            },
          },
          update: {
            date: log.date,
            ounces: log.ounces,
            source: log.source,
            time: log.time,
          },
          create: {
            userId: athleteId,
            id: log.id,
            date: log.date,
            ounces: log.ounces,
            source: log.source,
            time: log.time,
          },
        })
      }

      if (normalized.logs.length === 0) {
        await tx.hydrationLog.deleteMany({ where: { userId: athleteId } })
      }
    })

    const updated = await prisma.hydrationLog.findMany({
      where: { userId: athleteId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    })

    return NextResponse.json({ hydrationLogs: updated.map(toResponse) })
  } catch (error) {
    console.error("Failed to persist hydration logs", error)
    return NextResponse.json({ error: "Unable to save hydration logs." }, { status: 500 })
  }
}
