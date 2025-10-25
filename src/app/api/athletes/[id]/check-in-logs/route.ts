import { NextRequest, NextResponse } from "next/server"

import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth"

export const runtime = "nodejs"

const parseId = (raw: string): number | null => {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

type NormalizedCheckInLog = {
  id: number
  date: Date
  createdAt: Date
  mentalState: number
  physicalState: number
  mentalNotes?: string
  physicalNotes?: string
}

const toResponse = (log: {
  id: number
  userId: number
  date: Date
  createdAt: Date
  mentalState: number
  physicalState: number
  mentalNotes: string | null
  physicalNotes: string | null
}) => ({
  id: log.id,
  date: log.date.toISOString().split("T")[0],
  createdAt: log.createdAt.toISOString(),
  mentalState: log.mentalState,
  physicalState: log.physicalState,
  mentalNotes: log.mentalNotes ?? undefined,
  physicalNotes: log.physicalNotes ?? undefined,
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

const normalizeCheckInLogs = (
  value: unknown
): { ok: true; logs: NormalizedCheckInLog[] } | { ok: false; error: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, error: "checkInLogs must be an array." }
  }

  if (value.length > 200) {
    return { ok: false, error: "Too many check-in logs provided." }
  }

  const logs: NormalizedCheckInLog[] = []
  const seenIds = new Set<number>()

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid check-in log entry." }
    }

    const record = item as Record<string, unknown>

    const idNumber = toNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) {
      return { ok: false, error: "Check-in log id must be a positive integer." }
    }
    if (seenIds.has(idNumber)) {
      return { ok: false, error: "Duplicate check-in log id detected." }
    }
    seenIds.add(idNumber)

    if (typeof record.date !== "string" || !record.date.trim()) {
      return { ok: false, error: "Check-in log date is required." }
    }
    const dateValue = record.date.trim()
    const date = new Date(`${dateValue}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime())) {
      return { ok: false, error: "Check-in log date is invalid." }
    }

    if (typeof record.createdAt !== "string" || !record.createdAt.trim()) {
      return { ok: false, error: "Check-in log createdAt is required." }
    }
    const createdAt = new Date(record.createdAt)
    if (Number.isNaN(createdAt.getTime())) {
      return { ok: false, error: "Check-in log createdAt is invalid." }
    }

    const mentalStateNumber = toNumber(record.mentalState)
    if (mentalStateNumber == null || !Number.isFinite(mentalStateNumber)) {
      return { ok: false, error: "Check-in log mentalState is required." }
    }
    const mentalState = Math.round(mentalStateNumber)
    if (mentalState < 1 || mentalState > 10) {
      return { ok: false, error: "Check-in log mentalState must be between 1 and 10." }
    }

    const physicalStateNumber = toNumber(record.physicalState)
    if (physicalStateNumber == null || !Number.isFinite(physicalStateNumber)) {
      return { ok: false, error: "Check-in log physicalState is required." }
    }
    const physicalState = Math.round(physicalStateNumber)
    if (physicalState < 1 || physicalState > 10) {
      return { ok: false, error: "Check-in log physicalState must be between 1 and 10." }
    }

    const mentalNotes =
      typeof record.mentalNotes === "string" && record.mentalNotes.trim()
        ? record.mentalNotes.trim()
        : undefined
    const physicalNotes =
      typeof record.physicalNotes === "string" && record.physicalNotes.trim()
        ? record.physicalNotes.trim()
        : undefined

    logs.push({
      id: idNumber,
      date,
      createdAt,
      mentalState,
      physicalState,
      mentalNotes,
      physicalNotes,
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

  const logs = await prisma.checkInLog.findMany({
    where: { userId: athleteId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  })

  return NextResponse.json({ checkInLogs: logs.map(toResponse) })
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

  const payload = body as { checkInLogs?: unknown }

  if (!Object.prototype.hasOwnProperty.call(payload, "checkInLogs")) {
    return NextResponse.json({ error: "checkInLogs is required." }, { status: 400 })
  }

  const normalized = normalizeCheckInLogs(payload.checkInLogs)
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.checkInLog.findMany({
        where: { userId: athleteId },
        select: { id: true },
      })

      const incomingIds = new Set(normalized.logs.map((log) => log.id))
      const idsToDelete = existing
        .map((entry) => entry.id)
        .filter((entryId) => !incomingIds.has(entryId))

      if (idsToDelete.length > 0) {
        await tx.checkInLog.deleteMany({
          where: {
            userId: athleteId,
            id: { in: idsToDelete },
          },
        })
      }

      for (const log of normalized.logs) {
        await tx.checkInLog.upsert({
          where: {
            userId_id: {
              userId: athleteId,
              id: log.id,
            },
          },
          update: {
            date: log.date,
            createdAt: log.createdAt,
            mentalState: log.mentalState,
            physicalState: log.physicalState,
            mentalNotes: log.mentalNotes ?? null,
            physicalNotes: log.physicalNotes ?? null,
          },
          create: {
            userId: athleteId,
            id: log.id,
            date: log.date,
            createdAt: log.createdAt,
            mentalState: log.mentalState,
            physicalState: log.physicalState,
            mentalNotes: log.mentalNotes ?? null,
            physicalNotes: log.physicalNotes ?? null,
          },
        })
      }

      if (normalized.logs.length === 0) {
        await tx.checkInLog.deleteMany({ where: { userId: athleteId } })
      }
    })

    const updated = await prisma.checkInLog.findMany({
      where: { userId: athleteId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    })

    return NextResponse.json({ checkInLogs: updated.map(toResponse) })
  } catch (error) {
    console.error("Failed to persist check-in logs", error)
    return NextResponse.json({ error: "Unable to save check-in logs." }, { status: 500 })
  }
}
