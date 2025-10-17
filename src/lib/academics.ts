export const ACADEMICS_UPDATED_EVENT = "locker-academics-updated"

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
  source?: "manual" | "ics"
}

export type AcademicsUpdateDetail = {
  count: number
}

export const mockCourses: Course[] = [
  { id: 1, name: "Calculus II", code: "MATH 201", professor: "Dr. Smith", source: "manual" },
  { id: 2, name: "Physics I", code: "PHYS 101", professor: "Dr. Johnson", source: "manual" },
  { id: 3, name: "Biomechanics", code: "KIN 301", professor: "Dr. Williams", source: "manual" },
  { id: 4, name: "Sports Psychology", code: "PSYC 250", professor: "Dr. Brown", source: "manual" }
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
