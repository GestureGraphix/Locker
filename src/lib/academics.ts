export const ACADEMICS_UPDATED_EVENT = "locker-academics-updated"

type StorageKeyUser = {
  id?: number | null
  email?: string | null
}

export type AcademicsStorageKeys = {
  primary: string
  fallbacks: string[]
}

export const getAcademicsStorageKeys = (
  user: StorageKeyUser | null | undefined
): AcademicsStorageKeys => {
  if (!user) {
    return { primary: "locker-academics-guest", fallbacks: [] }
  }

  const fallbacks = new Set<string>()

  const email =
    typeof user.email === "string" && user.email.trim().length > 0
      ? user.email.trim()
      : null

  if (email) {
    fallbacks.add(`locker-academics-${email}`)
  }

  // Always allow migrating guest data into an authenticated account
  fallbacks.add("locker-academics-guest")

  const id =
    typeof user.id === "number" && Number.isInteger(user.id) && user.id > 0
      ? user.id
      : null

  if (id != null) {
    const primary = `locker-academics-user-${id}`
    const fallbackList = Array.from(fallbacks).filter(key => key !== primary)
    return { primary, fallbacks: fallbackList }
  }

  if (email) {
    const fallbackList = Array.from(fallbacks).filter(
      key => key !== `locker-academics-${email}`
    )
    return { primary: `locker-academics-${email}`, fallbacks: fallbackList }
  }

  return { primary: "locker-academics-guest", fallbacks: [] }
}

export type ManualItemType = "assignment" | "exam" | "reading" | "essay"
export type AcademicItemType = ManualItemType | "calendar"

export type AcademicItem = {
  id: number
  courseId?: number
  course: string
  type: AcademicItemType
  title: string
  dueAt: string
  notes?: string
  completed: boolean
  source: "manual" | "ics"
  externalId?: string
}

export type Course = {
  id: number
  name: string
  code: string
  professor: string
  schedule?: string
  source?: "manual" | "ics"
}

export type AcademicsUpdateDetail = {
  count: number
}

export const mockCourses: Course[] = [
  {
    id: 1,
    name: "Calculus II",
    code: "MATH 201",
    professor: "Dr. Smith",
    schedule: "Mon/Wed/Fri · 9:00 AM – 10:15 AM",
    source: "manual"
  },
  {
    id: 2,
    name: "Physics I",
    code: "PHYS 101",
    professor: "Dr. Johnson",
    schedule: "Tue/Thu · 11:00 AM – 12:15 PM",
    source: "manual"
  },
  {
    id: 3,
    name: "Biomechanics",
    code: "KIN 301",
    professor: "Dr. Williams",
    schedule: "Mon · 2:00 PM – 4:00 PM",
    source: "manual"
  },
  {
    id: 4,
    name: "Sports Psychology",
    code: "PSYC 250",
    professor: "Dr. Brown",
    schedule: "Wed · 1:00 PM – 2:30 PM",
    source: "manual"
  }
]

export const mockAcademicItems: AcademicItem[] = [
  {
    id: 1,
    courseId: 1,
    course: "MATH 201",
    type: "exam",
    title: "Midterm Exam",
    dueAt: "2024-01-15T14:00:00Z",
    notes: "Chapters 1-5, bring calculator",
    completed: false,
    source: "manual"
  },
  {
    id: 2,
    courseId: 2,
    course: "PHYS 101",
    type: "assignment",
    title: "Lab Report #3",
    dueAt: "2024-01-16T23:59:00Z",
    notes: "Kinematics experiment",
    completed: false,
    source: "manual"
  },
  {
    id: 3,
    courseId: 3,
    course: "KIN 301",
    type: "reading",
    title: "Chapter 5: Biomechanics",
    dueAt: "2024-01-19T09:00:00Z",
    notes: "Focus on joint mechanics",
    completed: true,
    source: "manual"
  },
  {
    id: 4,
    courseId: 4,
    course: "PSYC 250",
    type: "essay",
    title: "Motivation in Sports",
    dueAt: "2024-01-22T23:59:00Z",
    notes: "1500 words, APA format",
    completed: false,
    source: "manual"
  }
]
