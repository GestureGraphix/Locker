import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NUTRITION_GOAL_KEYS = [
  "hydrationOuncesPerDay",
  "caloriesPerDay",
  "proteinGramsPerDay",
  "carbsGramsPerDay",
  "fatsGramsPerDay",
] as const

type NutritionGoalKey = (typeof NUTRITION_GOAL_KEYS)[number]
type NutritionGoalsUpdate = Partial<Record<NutritionGoalKey, number>>

type NormalizedUpdate = {
  user: {
    name?: string | null
    email?: string
  }
  profile: {
    sport?: string | null
    level?: string | null
    team?: string | null
    position?: string | null
    coachEmail?: string | null
    heightCm?: number | null
    weightKg?: number | null
    allergies?: string[]
    tags?: string[]
    phone?: string | null
    location?: string | null
    university?: string | null
    graduationYear?: string | null
    notes?: string | null
    nutritionGoals?: NutritionGoalsUpdate | null
  }
}

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const sanitizeOptionalString = (
  record: Record<string, unknown>,
  key: string,
  { lowercase }: { lowercase?: boolean } = {}
): { present: false } | { present: true; value: string | null } | { present: true; error: string } => {
  if (!hasOwn(record, key)) return { present: false }
  const raw = record[key]
  if (raw == null) return { present: true, value: null }
  if (typeof raw !== "string") {
    return { present: true, error: `Invalid ${key}.` }
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return { present: true, value: null }
  }
  return { present: true, value: lowercase ? trimmed.toLowerCase() : trimmed }
}

const sanitizeEmail = (
  record: Record<string, unknown>,
  key: string
): { present: false } | { present: true; value: string } | { present: true; error: string } => {
  if (!hasOwn(record, key)) return { present: false }
  const raw = record[key]
  if (typeof raw !== "string" || !raw.trim()) {
    return { present: true, error: "Email is required." }
  }
  const normalized = raw.trim().toLowerCase()
  if (!EMAIL_REGEX.test(normalized)) {
    return { present: true, error: "Invalid email address." }
  }
  return { present: true, value: normalized }
}

const sanitizeNumber = (
  record: Record<string, unknown>,
  key: string
): { present: false } | { present: true; value: number | null } | { present: true; error: string } => {
  if (!hasOwn(record, key)) return { present: false }
  const raw = record[key]
  if (raw == null) {
    return { present: true, value: null }
  }
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    return { present: true, error: `Invalid ${key}.` }
  }
  return { present: true, value: raw }
}

const sanitizeStringArray = (
  record: Record<string, unknown>,
  key: string,
  { lowercase }: { lowercase?: boolean } = {}
): { present: false } | { present: true; value: string[] } | { present: true; error: string } => {
  if (!hasOwn(record, key)) return { present: false }
  const raw = record[key]
  if (raw == null) {
    return { present: true, value: [] }
  }
  if (!Array.isArray(raw)) {
    return { present: true, error: `Invalid ${key}.` }
  }
  const normalized = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => (lowercase ? item.toLowerCase() : item))

  return { present: true, value: Array.from(new Set(normalized)) }
}

const sanitizeNutritionGoals = (
  record: Record<string, unknown>,
  key: string
):
  | { present: false }
  | { present: true; value: NutritionGoalsUpdate | null }
  | { present: true; error: string } => {
  if (!hasOwn(record, key)) return { present: false }
  const raw = record[key]
  if (raw == null) {
    return { present: true, value: null }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { present: true, error: "Invalid nutrition goals." }
  }
  const goalsInput = raw as Record<string, unknown>
  const normalized: NutritionGoalsUpdate = {}
  for (const goalKey of NUTRITION_GOAL_KEYS) {
    if (!hasOwn(goalsInput, goalKey)) continue
    const value = goalsInput[goalKey]
    if (value == null) continue
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return { present: true, error: `Invalid value for ${goalKey}.` }
    }
    normalized[goalKey] = value
  }
  return { present: true, value: normalized }
}

const normalizeUpdatePayload = (payload: unknown):
  | { ok: true; value: NormalizedUpdate }
  | { ok: false; error: string } => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid request payload." }
  }

  const record = payload as Record<string, unknown>
  const normalized: NormalizedUpdate = { user: {}, profile: {} }

  const nameResult = sanitizeOptionalString(record, "name")
  if (nameResult.present) {
    if ("error" in nameResult) return { ok: false, error: nameResult.error }
    normalized.user.name = nameResult.value
  }

  const emailResult = sanitizeEmail(record, "email")
  if (emailResult.present) {
    if ("error" in emailResult) return { ok: false, error: emailResult.error }
    normalized.user.email = emailResult.value
  }

  const stringFields: Array<{ key: keyof NormalizedUpdate["profile"]; source: string; lowercase?: boolean }> = [
    { key: "sport", source: "sport" },
    { key: "level", source: "level" },
    { key: "team", source: "team" },
    { key: "position", source: "position" },
    { key: "coachEmail", source: "coachEmail", lowercase: true },
    { key: "phone", source: "phone" },
    { key: "location", source: "location" },
    { key: "university", source: "university" },
    { key: "graduationYear", source: "graduationYear" },
    { key: "notes", source: "notes" },
  ]

  for (const field of stringFields) {
    const result = sanitizeOptionalString(record, field.source, { lowercase: field.lowercase })
    if (!result.present) continue
    if ("error" in result) return { ok: false, error: result.error }
    normalized.profile[field.key] = result.value ?? null
  }

  const heightResult = sanitizeNumber(record, "heightCm")
  if (heightResult.present) {
    if ("error" in heightResult) return { ok: false, error: heightResult.error }
    normalized.profile.heightCm = heightResult.value ?? null
  }

  const weightResult = sanitizeNumber(record, "weightKg")
  if (weightResult.present) {
    if ("error" in weightResult) return { ok: false, error: weightResult.error }
    normalized.profile.weightKg = weightResult.value ?? null
  }

  const allergiesResult = sanitizeStringArray(record, "allergies")
  if (allergiesResult.present) {
    if ("error" in allergiesResult) return { ok: false, error: allergiesResult.error }
    normalized.profile.allergies = allergiesResult.value
  }

  const tagsResult = sanitizeStringArray(record, "tags", { lowercase: true })
  if (tagsResult.present) {
    if ("error" in tagsResult) return { ok: false, error: tagsResult.error }
    normalized.profile.tags = tagsResult.value
  }

  const goalsResult = sanitizeNutritionGoals(record, "nutritionGoals")
  if (goalsResult.present) {
    if ("error" in goalsResult) return { ok: false, error: goalsResult.error }
    normalized.profile.nutritionGoals = goalsResult.value ?? null
  }

  const hasUserUpdates = Object.keys(normalized.user).length > 0
  const hasProfileUpdates = Object.keys(normalized.profile).length > 0

  if (!hasUserUpdates && !hasProfileUpdates) {
    return { ok: false, error: "No valid fields provided." }
  }

  return { ok: true, value: normalized }
}

const parseNutritionGoalsFromDb = (
  value: Prisma.JsonValue | null
): NutritionGoalsUpdate | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const normalized: NutritionGoalsUpdate = {}
  let hasValue = false

  for (const key of NUTRITION_GOAL_KEYS) {
    const raw = record[key]
    if (typeof raw === "number" && Number.isFinite(raw)) {
      normalized[key] = raw
      hasValue = true
    }
  }

  return hasValue ? normalized : null
}

const toAthleteResponse = (
  profile: Awaited<ReturnType<typeof prisma.athleteProfile.findUnique>>
) => {
  if (!profile) return null
  return {
    id: profile.user.id,
    email: profile.user.email,
    name: profile.user.name,
    role: profile.user.role,
    profile: {
      id: profile.id,
      sport: profile.sport,
      level: profile.level,
      team: profile.team,
      position: profile.position,
      coachEmail: profile.coachEmail,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      allergies: profile.allergies,
      tags: profile.tags,
      phone: profile.phone,
      location: profile.location,
      university: profile.university,
      graduationYear: profile.graduationYear,
      notes: profile.notes,
      nutritionGoals: parseNutritionGoalsFromDb(profile.nutritionGoals),
    },
  }
}

const parseAthleteId = (value: string): number | null => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

const ensureAuthorized = async (athleteId: number) => {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) }
  }

  if (user.role === "ATHLETE" && user.id !== athleteId) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden." }, { status: 403 }) }
  }

  return { ok: true as const, user }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const athleteId = parseAthleteId(params.id)
  if (!athleteId) {
    return NextResponse.json({ error: "Invalid athlete id." }, { status: 400 })
  }

  const auth = await ensureAuthorized(athleteId)
  if (!auth.ok) {
    return auth.response
  }

  const profile = await prisma.athleteProfile.findUnique({
    where: { userId: athleteId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  })

  if (!profile) {
    return NextResponse.json({ error: "Athlete not found." }, { status: 404 })
  }

  return NextResponse.json({ athlete: toAthleteResponse(profile) })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const athleteId = parseAthleteId(params.id)
  if (!athleteId) {
    return NextResponse.json({ error: "Invalid athlete id." }, { status: 400 })
  }

  const auth = await ensureAuthorized(athleteId)
  if (!auth.ok) {
    return auth.response
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const normalized = normalizeUpdatePayload(payload)
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    const profile = await prisma.athleteProfile.update({
      where: { userId: athleteId },
      data: {
        sport: normalized.value.profile.sport,
        level: normalized.value.profile.level,
        team: normalized.value.profile.team,
        position: normalized.value.profile.position,
        coachEmail: normalized.value.profile.coachEmail,
        heightCm: normalized.value.profile.heightCm,
        weightKg: normalized.value.profile.weightKg,
        allergies: normalized.value.profile.allergies,
        tags: normalized.value.profile.tags,
        phone: normalized.value.profile.phone,
        location: normalized.value.profile.location,
        university: normalized.value.profile.university,
        graduationYear: normalized.value.profile.graduationYear,
        notes: normalized.value.profile.notes,
        nutritionGoals:
          normalized.value.profile.nutritionGoals === undefined
            ? undefined
            : normalized.value.profile.nutritionGoals === null
              ? Prisma.JsonNull
              : normalized.value.profile.nutritionGoals,
        user:
          Object.keys(normalized.value.user).length > 0
            ? {
                update: normalized.value.user,
              }
            : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    })

    return NextResponse.json({ athlete: toAthleteResponse(profile) })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Email already in use." }, { status: 409 })
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Athlete not found." }, { status: 404 })
      }
    }

    console.error("Failed to update athlete profile", error)
    return NextResponse.json({ error: "Unable to update athlete." }, { status: 500 })
  }
}
