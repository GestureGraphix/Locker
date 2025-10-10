export type Role = "athlete" | "coach"

export type NutritionFact = {
  name: string
  amount?: number
  unit?: string
  percentDailyValue?: number
  display?: string
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

export type Session = {
  id: number
  type: string
  title: string
  startAt: string
  endAt: string
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

export type UserAccount = Omit<StoredAccount, "password">
