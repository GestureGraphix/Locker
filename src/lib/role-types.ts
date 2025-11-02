import type { AcademicItem as AcademicsItem, Course as AcademicsCourse } from "./academics"

export type Role = "athlete" | "coach"

export type NutritionFact = {
  name: string
  amount?: number
  unit?: string
  percentDailyValue?: number
  display?: string
}

export type NutritionGoals = {
  hydrationOuncesPerDay?: number
  caloriesPerDay?: number
  proteinGramsPerDay?: number
  carbsGramsPerDay?: number
  fatsGramsPerDay?: number
}

export type HydrationLog = {
  id: number
  date: string
  ounces: number
  source: string
  time: string
}

export type MealLog = {
  id: number
  dateTime: string
  mealType: string
  calories: number
  proteinG: number
  notes: string
  completed: boolean
  nutritionFacts: NutritionFact[]
}

export type MobilityExercise = {
  id: number
  group: string
  name: string
  youtubeUrl?: string
  prescription?: string
  thumbnail?: string
}

export type MobilityLog = {
  id: number
  exerciseId: number
  exerciseName: string
  date: string
  durationMin: number
  notes?: string
}

export type AcademicCourse = AcademicsCourse
export type AcademicItem = AcademicsItem

export type CheckInLog = {
  id: number
  date: string
  createdAt: string
  mentalState: number
  physicalState: number
  mentalNotes?: string
  physicalNotes?: string
}

export type Session = {
  id: number
  type: string
  title: string
  startAt: string
  endAt?: string
  intensity: string
  notes?: string
  completed: boolean
  assignedBy?: string
  focus?: string
}

export type CalendarEvent = {
  id: number
  title: string
  date: string
  timeRange: string
  type: string
  focus?: string
}

export type WorkoutPlan = {
  id: number
  title: string
  focus: string
  dueDate: string
  status: "Scheduled" | "Completed"
  intensity: string
  assignedBy?: string
}

export type Athlete = {
  id: number
  name: string
  email: string
  sport: string
  level: string
  team: string
  tags: string[]
  sessions: Session[]
  calendar: CalendarEvent[]
  workouts: WorkoutPlan[]
  hydrationLogs: HydrationLog[]
  mealLogs: MealLog[]
  mobilityExercises: MobilityExercise[]
  mobilityLogs: MobilityLog[]
  checkInLogs: CheckInLog[]
  academicCourses: AcademicCourse[]
  academicItems: AcademicItem[]
  nutritionGoals?: NutritionGoals
  coachEmail?: string
  position?: string
  heightCm?: number
  weightKg?: number
  allergies?: string[]
  phone?: string
  location?: string
  university?: string
  graduationYear?: string
  notes?: string
  isSeedData?: boolean
}

export type StoredAccount = {
  email: string
  name: string
  role: Role
  password: string
  athleteId?: number
}

export type UserAccount = Omit<StoredAccount, "password"> & { id?: number }
