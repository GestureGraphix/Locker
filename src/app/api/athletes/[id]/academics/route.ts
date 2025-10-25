import { NextRequest, NextResponse } from "next/server"

import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth"

export const runtime = "nodejs"

const parseId = (raw: string): number | null => {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

const COURSE_SOURCE_VALUES = new Set(["manual", "ics"])
const ACADEMIC_ITEM_TYPES = new Set([
  "assignment",
  "exam",
  "reading",
  "essay",
  "calendar",
])

const normalizeCourse = (
  value: unknown,
):
  | {
      ok: true
      course: {
        id: number
        name: string
        code: string
        professor: string
        schedule?: string
        source?: string
      }
    }
  | { ok: false } => {
  if (!value || typeof value !== "object") return { ok: false }
  const record = value as Record<string, unknown>
  const id = Number(record.id)
  if (!Number.isInteger(id) || id <= 0) return { ok: false }
  const name = typeof record.name === "string" ? record.name.trim() : ""
  const code = typeof record.code === "string" ? record.code.trim() : ""
  const professor = typeof record.professor === "string" ? record.professor.trim() : ""
  if (!name || !code) return { ok: false }
  const schedule =
    typeof record.schedule === "string" && record.schedule.trim()
      ? record.schedule.trim()
      : undefined
  const source =
    typeof record.source === "string" && COURSE_SOURCE_VALUES.has(record.source)
      ? record.source
      : undefined
  return {
    ok: true,
    course: {
      id,
      name,
      code,
      professor,
      ...(schedule ? { schedule } : {}),
      ...(source ? { source } : {}),
    },
  }
}

const normalizeCourses = (
  value: unknown,
):
  | { ok: true; courses: ReturnType<typeof normalizeCourse>["course"][] }
  | { ok: false; error: string } => {
  if (value === undefined) {
    return { ok: true, courses: [] }
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: "courses must be an array." }
  }
  if (value.length > 200) {
    return { ok: false, error: "Too many courses provided." }
  }
  const courses: ReturnType<typeof normalizeCourse>["course"][] = []
  const seen = new Set<number>()
  for (const item of value) {
    const normalized = normalizeCourse(item)
    if (!normalized.ok) {
      return { ok: false, error: "Invalid course entry." }
    }
    if (seen.has(normalized.course.id)) {
      return { ok: false, error: "Duplicate course id detected." }
    }
    seen.add(normalized.course.id)
    courses.push(normalized.course)
  }
  return { ok: true, courses }
}

const normalizeAcademicItem = (
  value: unknown,
):
  | {
      ok: true
      item: {
        id: number
        courseId?: number
        course: string
        type: string
        title: string
        dueAt: string
        notes?: string
        completed: boolean
        source: string
        externalId?: string
      }
    }
  | { ok: false } => {
  if (!value || typeof value !== "object") return { ok: false }
  const record = value as Record<string, unknown>
  const id = Number(record.id)
  if (!Number.isInteger(id) || id <= 0) return { ok: false }
  const course = typeof record.course === "string" ? record.course.trim() : ""
  const title = typeof record.title === "string" ? record.title.trim() : ""
  const dueAt = typeof record.dueAt === "string" ? record.dueAt : ""
  if (!course || !title || !dueAt) return { ok: false }
  const type = typeof record.type === "string" ? record.type.trim() : ""
  if (!ACADEMIC_ITEM_TYPES.has(type)) return { ok: false }
  const courseId =
    typeof record.courseId === "number" && Number.isInteger(record.courseId) && record.courseId > 0
      ? record.courseId
      : undefined
  const notes =
    typeof record.notes === "string" && record.notes.trim() ? record.notes.trim() : undefined
  const source =
    typeof record.source === "string" && COURSE_SOURCE_VALUES.has(record.source)
      ? record.source
      : "manual"
  const externalId =
    typeof record.externalId === "string" && record.externalId.trim()
      ? record.externalId.trim()
      : undefined
  return {
    ok: true,
    item: {
      id,
      courseId,
      course,
      type,
      title,
      dueAt,
      ...(notes ? { notes } : {}),
      completed: record.completed === true,
      source,
      ...(externalId ? { externalId } : {}),
    },
  }
}

const normalizeAcademicItems = (
  value: unknown,
):
  | { ok: true; academicItems: ReturnType<typeof normalizeAcademicItem>["item"][] }
  | { ok: false; error: string } => {
  if (value === undefined) {
    return { ok: true, academicItems: [] }
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: "academicItems must be an array." }
  }
  if (value.length > 500) {
    return { ok: false, error: "Too many academic items provided." }
  }
  const items: ReturnType<typeof normalizeAcademicItem>["item"][] = []
  const seen = new Set<number>()
  for (const entry of value) {
    const normalized = normalizeAcademicItem(entry)
    if (!normalized.ok) {
      return { ok: false, error: "Invalid academic item entry." }
    }
    if (seen.has(normalized.item.id)) {
      return { ok: false, error: "Duplicate academic item id detected." }
    }
    seen.add(normalized.item.id)
    items.push(normalized.item)
  }
  return { ok: true, academicItems: items }
}

async function ensureAuthorized(athleteId: number) {
  const user = await getSessionUser()
  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    }
  }
  if (user.id !== athleteId) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    }
  }
  return { ok: true as const }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const athleteId = parseId(id)
  if (!athleteId) {
    return NextResponse.json({ error: "Invalid athlete id." }, { status: 400 })
  }

  const auth = await ensureAuthorized(athleteId)
  if (!auth.ok) return auth.res

  const record = await prisma.academics.findUnique({
    where: { userId: athleteId },
    select: { payload: true },
  })

  if (!record) {
    return NextResponse.json({ courses: [], academicItems: [] })
  }

  let courses: unknown = []
  let academicItems: unknown = []
  if (record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)) {
    const payload = record.payload as Record<string, unknown>
    courses = payload.courses
    academicItems = payload.academicItems
  }

  const normalizedCourses = normalizeCourses(courses)
  const normalizedItems = normalizeAcademicItems(academicItems)

  if (!normalizedCourses.ok || !normalizedItems.ok) {
    return NextResponse.json({ courses: [], academicItems: [] })
  }

  return NextResponse.json({
    courses: normalizedCourses.courses,
    academicItems: normalizedItems.academicItems,
  })
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
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

  const payload = body as { courses?: unknown; academicItems?: unknown }

  if (
    !Object.prototype.hasOwnProperty.call(payload, "courses") &&
    !Object.prototype.hasOwnProperty.call(payload, "academicItems")
  ) {
    return NextResponse.json(
      { error: "courses or academicItems is required." },
      { status: 400 },
    )
  }

  const normalizedCourses = normalizeCourses(payload.courses)
  if (!normalizedCourses.ok) {
    return NextResponse.json({ error: normalizedCourses.error }, { status: 400 })
  }

  const normalizedItems = normalizeAcademicItems(payload.academicItems)
  if (!normalizedItems.ok) {
    return NextResponse.json({ error: normalizedItems.error }, { status: 400 })
  }

  try {
    await prisma.academics.upsert({
      where: { userId: athleteId },
      update: {
        payload: {
          courses: normalizedCourses.courses,
          academicItems: normalizedItems.academicItems,
        },
      },
      create: {
        userId: athleteId,
        payload: {
          courses: normalizedCourses.courses,
          academicItems: normalizedItems.academicItems,
        },
      },
    })

    return NextResponse.json({
      courses: normalizedCourses.courses,
      academicItems: normalizedItems.academicItems,
    })
  } catch (error) {
    console.error("Failed to persist academics", error)
    return NextResponse.json({ error: "Unable to save academics." }, { status: 500 })
  }
}
