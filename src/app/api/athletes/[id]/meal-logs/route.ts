import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth"

export const runtime = "nodejs"

const parseId = (raw: string): number | null => {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

type NormalizedNutritionFact = {
  name: string
  amount?: number
  unit?: string
  percentDailyValue?: number
  display?: string
}

type NormalizedMealLog = {
  id: number
  dateTime: Date
  mealType: string
  calories: number
  proteinGrams: number
  notes: string | null
  completed: boolean
  nutritionFacts: NormalizedNutritionFact[]
}

const toNutritionFactsResponse = (
  value: Prisma.JsonValue | null
): NormalizedNutritionFact[] => {
  if (!Array.isArray(value)) return []
  const facts: NormalizedNutritionFact[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const name = typeof record.name === "string" ? record.name.trim() : ""
    if (!name) continue
    const fact: NormalizedNutritionFact = { name }
    if (typeof record.amount === "number" && Number.isFinite(record.amount)) {
      fact.amount = record.amount
    }
    if (typeof record.unit === "string" && record.unit.trim()) {
      fact.unit = record.unit.trim()
    }
    if (
      typeof record.percentDailyValue === "number" &&
      Number.isFinite(record.percentDailyValue)
    ) {
      fact.percentDailyValue = record.percentDailyValue
    }
    if (typeof record.display === "string" && record.display.trim()) {
      fact.display = record.display.trim()
    }
    facts.push(fact)
  }
  return facts
}

const toResponse = (log: {
  id: number
  userId: number
  dateTime: Date
  mealType: string
  calories: number
  proteinGrams: number
  notes: string | null
  completed: boolean
  nutritionFacts: Prisma.JsonValue
}) => ({
  id: log.id,
  dateTime: log.dateTime.toISOString(),
  mealType: log.mealType,
  calories: log.calories,
  proteinG: log.proteinGrams,
  notes: log.notes ?? "",
  completed: log.completed,
  nutritionFacts: toNutritionFactsResponse(log.nutritionFacts),
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

const normalizeNutritionFact = (value: unknown): NormalizedNutritionFact | null => {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const name = typeof record.name === "string" ? record.name.trim() : ""
  if (!name) return null
  const fact: NormalizedNutritionFact = { name }
  const amount = toNumber(record.amount)
  if (amount != null) fact.amount = amount
  if (typeof record.unit === "string" && record.unit.trim()) fact.unit = record.unit.trim()
  const pdv = toNumber(record.percentDailyValue)
  if (pdv != null) fact.percentDailyValue = pdv
  if (typeof record.display === "string" && record.display.trim()) {
    fact.display = record.display.trim()
  }
  return fact
}

const normalizeMealLogs = (
  value: unknown
): { ok: true; logs: NormalizedMealLog[] } | { ok: false; error: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, error: "mealLogs must be an array." }
  }

  if (value.length > 200) {
    return { ok: false, error: "Too many meal logs provided." }
  }

  const logs: NormalizedMealLog[] = []
  const seenIds = new Set<number>()

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid meal log entry." }
    }

    const record = item as Record<string, unknown>

    const idNumber = toNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) {
      return { ok: false, error: "Meal log id must be a positive integer." }
    }
    const id = idNumber
    if (seenIds.has(id)) {
      return { ok: false, error: "Duplicate meal log id detected." }
    }
    seenIds.add(id)

    if (typeof record.dateTime !== "string" || !record.dateTime.trim()) {
      return { ok: false, error: "Meal log dateTime is required." }
    }
    const date = new Date(record.dateTime)
    if (Number.isNaN(date.getTime())) {
      return { ok: false, error: "Meal log dateTime is invalid." }
    }

    if (typeof record.mealType !== "string" || !record.mealType.trim()) {
      return { ok: false, error: "Meal log mealType is required." }
    }
    const mealType = record.mealType.trim()

    const caloriesNumber = toNumber(record.calories)
    const calories = caloriesNumber != null ? Math.round(caloriesNumber) : 0

    const proteinNumber = toNumber(record.proteinG ?? record.proteinGrams)
    const proteinGrams = proteinNumber != null ? proteinNumber : 0

    const completed = Boolean(record.completed)

    const notes =
      typeof record.notes === "string" && record.notes.trim() ? record.notes.trim() : null

    const factsRaw = Array.isArray(record.nutritionFacts)
      ? record.nutritionFacts
      : []
    const facts: NormalizedNutritionFact[] = []
    for (const fact of factsRaw) {
      const normalizedFact = normalizeNutritionFact(fact)
      if (normalizedFact) {
        facts.push(normalizedFact)
      }
    }

    logs.push({
      id,
      dateTime: date,
      mealType,
      calories,
      proteinGrams,
      notes,
      completed,
      nutritionFacts: facts,
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

  const logs = await prisma.mealLog.findMany({
    where: { userId: athleteId },
    orderBy: { dateTime: "asc" },
  })

  return NextResponse.json({ mealLogs: logs.map(toResponse) })
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

  const payload = body as { mealLogs?: unknown }

  if (!Object.prototype.hasOwnProperty.call(payload, "mealLogs")) {
    return NextResponse.json({ error: "mealLogs is required." }, { status: 400 })
  }

  const normalized = normalizeMealLogs(payload.mealLogs)
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.mealLog.findMany({
        where: { userId: athleteId },
        select: { id: true },
      })

      const incomingIds = new Set(normalized.logs.map((log) => log.id))
      const idsToDelete = existing
        .map((entry) => entry.id)
        .filter((entryId) => !incomingIds.has(entryId))

      if (idsToDelete.length > 0) {
        await tx.mealLog.deleteMany({
          where: {
            userId: athleteId,
            id: { in: idsToDelete },
          },
        })
      }

      for (const log of normalized.logs) {
        await tx.mealLog.upsert({
          where: {
            userId_id: {
              userId: athleteId,
              id: log.id,
            },
          },
          update: {
            dateTime: log.dateTime,
            mealType: log.mealType,
            calories: log.calories,
            proteinGrams: log.proteinGrams,
            notes: log.notes,
            completed: log.completed,
            nutritionFacts: log.nutritionFacts,
          },
          create: {
            userId: athleteId,
            id: log.id,
            dateTime: log.dateTime,
            mealType: log.mealType,
            calories: log.calories,
            proteinGrams: log.proteinGrams,
            notes: log.notes,
            completed: log.completed,
            nutritionFacts: log.nutritionFacts,
          },
        })
      }

      if (normalized.logs.length === 0) {
        await tx.mealLog.deleteMany({ where: { userId: athleteId } })
      }
    })

    const updated = await prisma.mealLog.findMany({
      where: { userId: athleteId },
      orderBy: { dateTime: "asc" },
    })

    return NextResponse.json({ mealLogs: updated.map(toResponse) })
  } catch (error) {
    console.error("Failed to persist meal logs", error)
    return NextResponse.json({ error: "Unable to save meal logs." }, { status: 500 })
  }
}
