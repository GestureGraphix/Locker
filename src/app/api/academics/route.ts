import { NextRequest, NextResponse } from "next/server"
import { AcademicItemType as PrismaAcademicItemType, Prisma } from "@prisma/client"

import { getSessionUser } from "@/lib/auth"
import prisma from "@/lib/prisma"
import type { AcademicItem, AcademicItemType, Course } from "@/lib/academics"

export const runtime = "nodejs"

const allowedSources = new Set(["manual", "ics"])
const allowedItemTypes = new Set<AcademicItemType>([
  "assignment",
  "exam",
  "reading",
  "essay",
  "calendar",
])

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const toPositiveInt = (value: unknown): number | null => {
  const num = toNumber(value)
  if (num == null || !Number.isInteger(num) || num <= 0) return null
  return num
}

const normalizeCourses = (
  value: unknown
): { ok: true; courses: Course[] } | { ok: false; error: string } => {
  if (value == null) {
    return { ok: true, courses: [] }
  }

  if (!Array.isArray(value)) {
    return { ok: false, error: "courses must be an array." }
  }

  const courses: Course[] = []
  const seenIds = new Set<number>()

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid course entry." }
    }

    const record = item as Record<string, unknown>

    const id = toPositiveInt(record.id)
    if (id == null) {
      return { ok: false, error: "Course id must be a positive integer." }
    }

    if (seenIds.has(id)) {
      return { ok: false, error: "Duplicate course id detected." }
    }
    seenIds.add(id)

    const codeRaw = typeof record.code === "string" ? record.code.trim() : ""
    const nameRaw = typeof record.name === "string" ? record.name.trim() : ""
    const professorRaw =
      typeof record.professor === "string" ? record.professor.trim() : ""
    const scheduleRaw =
      typeof record.schedule === "string" ? record.schedule.trim() : ""
    const sourceRaw =
      typeof record.source === "string"
        ? record.source.trim().toLowerCase()
        : ""

    const code = codeRaw || nameRaw || `Course ${id}`
    const name = nameRaw || codeRaw || `Course ${id}`
    const professor = professorRaw || "Instructor TBA"

    const course: Course = {
      id,
      code,
      name,
      professor,
      source: allowedSources.has(sourceRaw) ? (sourceRaw as Course["source"]) : "manual",
    }

    if (scheduleRaw) {
      course.schedule = scheduleRaw
    }

    courses.push(course)
  }

  return { ok: true, courses }
}

const normalizeAcademicItems = (
  value: unknown
): { ok: true; academicItems: AcademicItem[] } | { ok: false; error: string } => {
  if (value == null) {
    return { ok: true, academicItems: [] }
  }

  if (!Array.isArray(value)) {
    return { ok: false, error: "academicItems must be an array." }
  }

  if (value.length > 500) {
    return { ok: false, error: "Too many academic items provided." }
  }

  const academicItems: AcademicItem[] = []
  const seenIds = new Set<number>()

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid academic item entry." }
    }

    const record = item as Record<string, unknown>

    const id = toPositiveInt(record.id)
    if (id == null) {
      return { ok: false, error: "Academic item id must be a positive integer." }
    }

    if (seenIds.has(id)) {
      return { ok: false, error: "Duplicate academic item id detected." }
    }
    seenIds.add(id)

    const courseId = toPositiveInt(record.courseId)
    const courseRaw = typeof record.course === "string" ? record.course.trim() : ""
    const titleRaw = typeof record.title === "string" ? record.title.trim() : ""
    if (!titleRaw) {
      return { ok: false, error: "Academic item title is required." }
    }

    const dueAtRaw = typeof record.dueAt === "string" ? record.dueAt.trim() : ""
    if (!dueAtRaw) {
      return { ok: false, error: "Academic item dueAt is required." }
    }

    const dueAt = new Date(dueAtRaw)
    if (Number.isNaN(dueAt.getTime())) {
      return { ok: false, error: "Academic item dueAt is invalid." }
    }

    const typeRaw =
      typeof record.type === "string" ? record.type.trim().toLowerCase() : ""
    if (!allowedItemTypes.has(typeRaw as AcademicItemType)) {
      return { ok: false, error: "Academic item type is invalid." }
    }
    const type = typeRaw as AcademicItemType

    const notesRaw = typeof record.notes === "string" ? record.notes.trim() : ""
    const sourceRaw =
      typeof record.source === "string"
        ? record.source.trim().toLowerCase()
        : ""
    const externalIdRaw =
      typeof record.externalId === "string" ? record.externalId.trim() : ""

    const academicItem: AcademicItem = {
      id,
      courseId: courseId ?? undefined,
      course: courseRaw || "General",
      type,
      title: titleRaw,
      dueAt: dueAtRaw,
      completed: Boolean(record.completed),
      source: allowedSources.has(sourceRaw) ? (sourceRaw as "manual" | "ics") : "manual",
    }

    if (notesRaw) {
      academicItem.notes = notesRaw
    }

    if (externalIdRaw) {
      academicItem.externalId = externalIdRaw
    }

    academicItems.push(academicItem)
  }

  return { ok: true, academicItems }
}

const sanitizePayload = (
  payload: Prisma.JsonValue | null
): { courses: Course[]; academicItems: AcademicItem[] } => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { courses: [], academicItems: [] }
  }

  const record = payload as Record<string, unknown>
  const coursesResult = normalizeCourses(record.courses ?? [])
  const itemsResult = normalizeAcademicItems(record.academicItems ?? [])

  return {
    courses: coursesResult.ok ? coursesResult.courses : [],
    academicItems: itemsResult.ok ? itemsResult.academicItems : [],
  }
}

const persistAcademicsPayload = async (
  userId: number,
  courses: Course[],
  academicItems: AcademicItem[]
) => {
  await prisma.$transaction(async tx => {
    const courseIds = courses.map(course => course.id)

    if (courseIds.length === 0) {
      await tx.academicCourse.deleteMany({ where: { userId } })
    } else {
      await tx.academicCourse.deleteMany({
        where: {
          userId,
          id: { notIn: courseIds },
        },
      })
    }

    for (const course of courses) {
      const source = allowedSources.has(course.source ?? "")
        ? (course.source as Course["source"])
        : "manual"

      await tx.academicCourse.upsert({
        where: {
          userId_id: {
            userId,
            id: course.id,
          },
        },
        create: {
          userId,
          id: course.id,
          code: course.code,
          name: course.name,
          professor: course.professor,
          schedule: course.schedule ?? null,
          source,
        },
        update: {
          code: course.code,
          name: course.name,
          professor: course.professor,
          schedule: course.schedule ?? null,
          source,
        },
      })
    }

    const itemIds = academicItems.map(item => item.id)

    if (itemIds.length === 0) {
      await tx.academicItem.deleteMany({ where: { userId } })
    } else {
      await tx.academicItem.deleteMany({
        where: {
          userId,
          id: { notIn: itemIds },
        },
      })
    }

    for (const item of academicItems) {
      const dueAt = new Date(item.dueAt)
      const source = allowedSources.has(item.source ?? "") ? item.source : "manual"
      const type = item.type as PrismaAcademicItemType

      await tx.academicItem.upsert({
        where: {
          userId_id: {
            userId,
            id: item.id,
          },
        },
        create: {
          userId,
          id: item.id,
          courseId: item.courseId ?? null,
          courseLabel: item.course,
          type,
          title: item.title,
          dueAt,
          notes: item.notes ?? null,
          completed: item.completed,
          source,
          externalId: item.externalId ?? null,
        },
        update: {
          courseId: item.courseId ?? null,
          courseLabel: item.course,
          type,
          title: item.title,
          dueAt,
          notes: item.notes ?? null,
          completed: item.completed,
          source,
          externalId: item.externalId ?? null,
        },
      })
    }

    await tx.academics.upsert({
      where: { userId },
      create: {
        userId,
        payload: {
          courses,
          academicItems,
        },
      },
      update: {
        payload: {
          courses,
          academicItems,
        },
      },
    })
  })
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  let courses = await prisma.academicCourse.findMany({
    where: { userId: user.id },
    orderBy: { id: "asc" },
  })

  let academicItems = await prisma.academicItem.findMany({
    where: { userId: user.id },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
  })

  if (courses.length === 0 && academicItems.length === 0) {
    const academics = await prisma.academics.findUnique({
      where: { userId: user.id },
    })

    const payload = sanitizePayload(academics?.payload ?? null)

    if (payload.courses.length > 0 || payload.academicItems.length > 0) {
      await persistAcademicsPayload(user.id, payload.courses, payload.academicItems)
      courses = await prisma.academicCourse.findMany({
        where: { userId: user.id },
        orderBy: { id: "asc" },
      })
      academicItems = await prisma.academicItem.findMany({
        where: { userId: user.id },
        orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      })
    }
  }

  const coursePayload: Course[] = courses.map(course => ({
    id: course.id,
    code: course.code,
    name: course.name,
    professor: course.professor,
    schedule: course.schedule ?? undefined,
    source: allowedSources.has(course.source) ? (course.source as Course["source"]) : "manual",
  }))

  const academicItemPayload: AcademicItem[] = academicItems.map(item => ({
    id: item.id,
    courseId: item.courseId ?? undefined,
    course: item.courseLabel,
    type: item.type as AcademicItemType,
    title: item.title,
    dueAt: item.dueAt.toISOString(),
    notes: item.notes ?? undefined,
    completed: item.completed,
    source: allowedSources.has(item.source)
      ? (item.source as AcademicItem["source"])
      : "manual",
    externalId: item.externalId ?? undefined,
  }))

  return NextResponse.json({ courses: coursePayload, academicItems: academicItemPayload })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const record = body as { courses?: unknown; academicItems?: unknown }

  const coursesResult = normalizeCourses(record.courses ?? [])
  if (!coursesResult.ok) {
    return NextResponse.json({ error: coursesResult.error }, { status: 400 })
  }

  const itemsResult = normalizeAcademicItems(record.academicItems ?? [])
  if (!itemsResult.ok) {
    return NextResponse.json({ error: itemsResult.error }, { status: 400 })
  }

  await persistAcademicsPayload(
    user.id,
    coursesResult.courses,
    itemsResult.academicItems
  )

  return NextResponse.json({
    courses: coursesResult.courses,
    academicItems: itemsResult.academicItems,
  })
}
