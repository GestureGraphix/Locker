"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import type {
  AcademicCourse,
  AcademicItem,
  Athlete,
  HydrationLog,
  MealLog,
  MobilityExercise,
  MobilityLog,
  CheckInLog,
  Role,
  StoredAccount,
  UserAccount,
  Session,
  WorkoutPlan,
  NutritionFact
} from "@/lib/role-types"
import { initialAthletes } from "@/lib/initial-data"
import type { CalendarEvent } from "@/lib/role-types"
import {
  normalizeAccounts,
  normalizeAthletes,
  normalizeTag,
  normalizeTags,
} from "@/lib/state-normalizer"
import { isSqlAuth } from "@/lib/auth-mode"



type ScheduleSessionInput = {
  type: string
  title: string
  startAt: string
  endAt: string
  intensity: string
  notes?: string
}

type ScheduleOptions = {
  focus?: string
  assignedBy?: string
}

type AddAthleteInput = {
  name?: string
  email: string
  sport?: string
  level?: string
  team?: string
  tags?: string[]
}

type UpdateAthleteInput = Partial<
  Pick<
    Athlete,
    |
      "name"
    | "email"
    | "sport"
    | "level"
    | "team"
    | "tags"
    | "position"
    | "heightCm"
    | "weightKg"
    | "allergies"
    | "phone"
    | "location"
    | "university"
    | "graduationYear"
    | "notes"
    | "nutritionGoals"
  >
>

type LoginInput = {
  email: string
  role: Role
  password: string
}

type CreateAccountInput = {
  email: string
  role: Role
  password: string
  name?: string
}

type AuthResult =
  | { success: true }
  | { success: false; error: string }

type SignInInput = {
  email: string
  password: string
  role?: Role
}

type SqlAuthUserPayload = {
  id: number
  email: string
  name: string | null
  role: string
}

const toRoleFromSql = (value: string | null | undefined): Role | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "athlete" || normalized === "coach") {
    return normalized
  }
  return null
}

const toUserAccountFromSql = (user: SqlAuthUserPayload | null | undefined): UserAccount | null => {
  if (!user) return null
  const role = toRoleFromSql(user.role)
  if (!role) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
    role,
  }
}

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const sanitizeHydrationLogsFromServer = (value: unknown): HydrationLog[] => {
  if (!Array.isArray(value)) return []
  const logs: HydrationLog[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const idNumber = coerceNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) continue
    const rawDate = typeof record.date === "string" ? record.date.trim() : ""
    if (!rawDate) continue
    const ouncesNumber = coerceNumber(record.ounces)
    if (ouncesNumber == null || !Number.isFinite(ouncesNumber) || ouncesNumber < 0) continue
    const source = typeof record.source === "string" ? record.source.trim() : ""
    if (!source) continue
    const time = typeof record.time === "string" ? record.time.trim() : ""
    if (!time) continue
    logs.push({
      id: idNumber,
      date: rawDate,
      ounces: Math.round(ouncesNumber),
      source,
      time,
    })
  }
  return logs.sort((a, b) => {
    if (a.date === b.date) return a.id - b.id
    return a.date.localeCompare(b.date)
  })
}

const sanitizeNutritionFactsFromServer = (value: unknown): NutritionFact[] => {
  if (!Array.isArray(value)) return []
  const facts: NutritionFact[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const name = typeof record.name === "string" ? record.name.trim() : ""
    if (!name) continue
    const fact: NutritionFact = { name }
    const amount = coerceNumber(record.amount)
    if (amount != null) fact.amount = amount
    if (typeof record.unit === "string" && record.unit.trim()) {
      fact.unit = record.unit.trim()
    }
    const pdv = coerceNumber(record.percentDailyValue)
    if (pdv != null) fact.percentDailyValue = pdv
    if (typeof record.display === "string" && record.display.trim()) {
      fact.display = record.display.trim()
    }
    facts.push(fact)
  }
  return facts
}

const sanitizeMealLogsFromServer = (value: unknown): MealLog[] => {
  if (!Array.isArray(value)) return []
  const logs: MealLog[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const idNumber = coerceNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) continue
    const rawDate = typeof record.dateTime === "string" ? record.dateTime : null
    const dateTime = rawDate && !Number.isNaN(new Date(rawDate).getTime()) ? rawDate : new Date().toISOString()
    const mealType =
      typeof record.mealType === "string" && record.mealType.trim()
        ? record.mealType.trim()
        : "meal"
    const calories = coerceNumber(record.calories) ?? 0
    const protein =
      coerceNumber(record.proteinG) ??
      coerceNumber((record as Record<string, unknown>).proteinGrams) ??
      0
    const notes = typeof record.notes === "string" ? record.notes : ""
    const completed = Boolean(record.completed)
    const nutritionFacts = sanitizeNutritionFactsFromServer(record.nutritionFacts)
    logs.push({
      id: idNumber,
      dateTime,
      mealType,
      calories: Math.round(calories),
      proteinG: protein,
      notes,
      completed,
      nutritionFacts,
    })
  }
  return logs.sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  )
}

const ACADEMIC_ITEM_TYPES = new Set([
  "assignment",
  "exam",
  "reading",
  "essay",
  "calendar",
])

const ACADEMIC_SOURCE_VALUES = new Set(["manual", "ics"])

const sanitizeAcademicCoursesFromServer = (value: unknown): AcademicCourse[] => {
  if (!Array.isArray(value)) return []
  const courses: AcademicCourse[] = []
  const seen = new Set<number>()

  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const idNumber = coerceNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) continue
    if (seen.has(idNumber)) continue
    seen.add(idNumber)

    const name = typeof record.name === "string" ? record.name.trim() : ""
    const code = typeof record.code === "string" ? record.code.trim() : ""
    const professor = typeof record.professor === "string" ? record.professor.trim() : ""
    if (!name || !code) continue

    const schedule =
      typeof record.schedule === "string" && record.schedule.trim()
        ? record.schedule.trim()
        : undefined
    const source =
      typeof record.source === "string" && ACADEMIC_SOURCE_VALUES.has(record.source)
        ? (record.source as AcademicCourse["source"])
        : undefined

    courses.push({
      id: idNumber,
      name,
      code,
      professor,
      ...(schedule ? { schedule } : {}),
      ...(source ? { source } : {}),
    })
  }

  return courses.sort((a, b) => a.id - b.id)
}

const sanitizeAcademicItemsFromServer = (value: unknown): AcademicItem[] => {
  if (!Array.isArray(value)) return []
  const items: AcademicItem[] = []
  const seen = new Set<number>()

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    const idNumber = coerceNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) continue
    if (seen.has(idNumber)) continue
    seen.add(idNumber)

    const course = typeof record.course === "string" ? record.course.trim() : ""
    const title = typeof record.title === "string" ? record.title.trim() : ""
    const dueAt = typeof record.dueAt === "string" ? record.dueAt : ""
    if (!course || !title || !dueAt) continue

    const type = typeof record.type === "string" ? record.type.trim() : ""
    if (!ACADEMIC_ITEM_TYPES.has(type)) continue

    const courseIdNumber = coerceNumber(record.courseId)
    const courseId =
      courseIdNumber != null && Number.isInteger(courseIdNumber) && courseIdNumber > 0
        ? courseIdNumber
        : undefined
    const notes =
      typeof record.notes === "string" && record.notes.trim()
        ? record.notes.trim()
        : undefined
    const source =
      typeof record.source === "string" && ACADEMIC_SOURCE_VALUES.has(record.source)
        ? (record.source as AcademicItem["source"])
        : "manual"
    const externalId =
      typeof record.externalId === "string" && record.externalId.trim()
        ? record.externalId.trim()
        : undefined

    items.push({
      id: idNumber,
      courseId,
      course,
      type: type as AcademicItem["type"],
      title,
      dueAt,
      ...(notes ? { notes } : {}),
      completed: record.completed === true,
      source,
      ...(externalId ? { externalId } : {}),
    })
  }

  return items.sort((a, b) => a.id - b.id)
}

const sanitizeMobilityExercisesFromServer = (value: unknown): MobilityExercise[] => {
  if (!Array.isArray(value)) return []
  const exercises: MobilityExercise[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const idNumber = coerceNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) continue
    const group = typeof record.group === "string" ? record.group.trim() : ""
    if (!group) continue
    const name = typeof record.name === "string" ? record.name.trim() : ""
    if (!name) continue
    const youtubeUrl =
      typeof record.youtubeUrl === "string" && record.youtubeUrl.trim()
        ? record.youtubeUrl.trim()
        : undefined
    const prescription =
      typeof record.prescription === "string" && record.prescription.trim()
        ? record.prescription.trim()
        : undefined
    const thumbnail =
      typeof record.thumbnail === "string" && record.thumbnail.trim()
        ? record.thumbnail.trim()
        : undefined
    exercises.push({
      id: idNumber,
      group,
      name,
      ...(youtubeUrl ? { youtubeUrl } : {}),
      ...(prescription ? { prescription } : {}),
      ...(thumbnail ? { thumbnail } : {}),
    })
  }
  return exercises.sort((a, b) => a.id - b.id)
}

const sanitizeMobilityLogsFromServer = (value: unknown): MobilityLog[] => {
  if (!Array.isArray(value)) return []
  const logs: MobilityLog[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const idNumber = coerceNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) continue
    const exerciseId = coerceNumber(record.exerciseId)
    if (exerciseId == null || !Number.isInteger(exerciseId) || exerciseId <= 0) continue
    const exerciseName =
      typeof record.exerciseName === "string" ? record.exerciseName.trim() : ""
    if (!exerciseName) continue
    const date = typeof record.date === "string" ? record.date.trim() : ""
    if (!date) continue
    const duration = coerceNumber(record.durationMin)
    if (duration == null || !Number.isFinite(duration) || duration < 0) continue
    const notes =
      typeof record.notes === "string" && record.notes.trim()
        ? record.notes.trim()
        : undefined
    logs.push({
      id: idNumber,
      exerciseId,
      exerciseName,
      date,
      durationMin: Math.round(duration),
      ...(notes ? { notes } : {}),
    })
  }
  return logs.sort((a, b) => {
    if (a.date === b.date) return a.id - b.id
    return a.date.localeCompare(b.date)
  })
}

const sanitizeCheckInLogsFromServer = (value: unknown): CheckInLog[] => {
  if (!Array.isArray(value)) return []
  const logs: CheckInLog[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const idNumber = coerceNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) continue
    const date = typeof record.date === "string" ? record.date.trim() : ""
    if (!date) continue
    const createdAt =
      typeof record.createdAt === "string" && record.createdAt.trim()
        ? record.createdAt.trim()
        : null
    if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) continue
    const mentalState = coerceNumber(record.mentalState)
    if (mentalState == null || mentalState < 1 || mentalState > 10) continue
    const physicalState = coerceNumber(record.physicalState)
    if (physicalState == null || physicalState < 1 || physicalState > 10) continue
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
      mentalState: Math.round(mentalState),
      physicalState: Math.round(physicalState),
      ...(mentalNotes ? { mentalNotes } : {}),
      ...(physicalNotes ? { physicalNotes } : {}),
    })
  }
  return logs.sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
    if (dateDiff !== 0) return dateDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

const sanitizeWorkoutsFromServer = (value: unknown): WorkoutPlan[] => {
  if (!Array.isArray(value)) return []
  const workouts: WorkoutPlan[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>

    const idNumber = coerceNumber(record.id)
    if (idNumber == null || !Number.isInteger(idNumber) || idNumber <= 0) continue

    const title = typeof record.title === "string" ? record.title.trim() : ""
    if (!title) continue

    const focus = typeof record.focus === "string" ? record.focus.trim() : ""
    if (!focus) continue

    const dueDateRaw = typeof record.dueDate === "string" ? record.dueDate.trim() : ""
    if (!dueDateRaw) continue
    const dueDate = new Date(
      dueDateRaw.includes("T") ? dueDateRaw : `${dueDateRaw}T00:00:00.000Z`
    )
    if (Number.isNaN(dueDate.getTime())) continue

    const statusRaw =
      typeof record.status === "string" ? record.status.trim().toLowerCase() : ""
    let status: WorkoutPlan["status"] | null = null
    if (statusRaw === "completed") {
      status = "Completed"
    } else if (statusRaw === "scheduled") {
      status = "Scheduled"
    }
    if (!status) continue

    const intensity =
      typeof record.intensity === "string" ? record.intensity.trim() : ""
    if (!intensity) continue

    const assignedBy =
      typeof record.assignedBy === "string" && record.assignedBy.trim()
        ? record.assignedBy.trim()
        : undefined

    workouts.push({
      id: idNumber,
      title,
      focus,
      dueDate: dueDate.toISOString().split("T")[0],
      status,
      intensity,
      ...(assignedBy ? { assignedBy } : {}),
    })
  }

  return workouts.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )
}

const buildAthleteForSqlUser = (
  user: UserAccount,
  options: {
    hydrationLogs?: HydrationLog[]
    mealLogs?: MealLog[]
    workouts?: WorkoutPlan[]
    mobilityExercises?: MobilityExercise[]
    mobilityLogs?: MobilityLog[]
    checkInLogs?: CheckInLog[]
    academicCourses?: AcademicCourse[]
    academicItems?: AcademicItem[]
    previous?: Athlete | null
  } = {}
): Athlete => {
  const base = options.previous ?? initialAthletes[0] ?? null
  const baseIsSeed = base?.isSeedData ?? false
  const hydrationLogs =
    options.hydrationLogs ?? (baseIsSeed ? [] : base?.hydrationLogs ?? [])
  const mealLogs = options.mealLogs ?? (baseIsSeed ? [] : base?.mealLogs ?? [])
  const workouts = options.workouts ?? (baseIsSeed ? [] : base?.workouts ?? [])
  const mobilityExercises =
    options.mobilityExercises ?? (baseIsSeed ? [] : base?.mobilityExercises ?? [])
  const mobilityLogs =
    options.mobilityLogs ?? (baseIsSeed ? [] : base?.mobilityLogs ?? [])
  const checkInLogs =
    options.checkInLogs ?? (baseIsSeed ? [] : base?.checkInLogs ?? [])
  const academicCourses =
    options.academicCourses ?? (baseIsSeed ? [] : base?.academicCourses ?? [])
  const academicItems =
    options.academicItems ?? (baseIsSeed ? [] : base?.academicItems ?? [])

  return {
    id: user.id ?? base?.id ?? Date.now(),
    name: user.name ?? base?.name ?? user.email,
    email: user.email,
    sport: base?.sport ?? "",
    level: base?.level ?? "",
    team: base?.team ?? "",
    tags: baseIsSeed ? [] : base?.tags ?? [],
    sessions: baseIsSeed ? [] : base?.sessions ?? [],
    calendar: baseIsSeed ? [] : base?.calendar ?? [],
    workouts,
    hydrationLogs,
    mealLogs,
    mobilityExercises,
    mobilityLogs,
    checkInLogs,
    academicCourses,
    academicItems,
    nutritionGoals: baseIsSeed ? undefined : base?.nutritionGoals,
    coachEmail: baseIsSeed ? undefined : base?.coachEmail,
    position: baseIsSeed ? undefined : base?.position,
    heightCm: baseIsSeed ? undefined : base?.heightCm,
    weightKg: baseIsSeed ? undefined : base?.weightKg,
    allergies: baseIsSeed ? [] : base?.allergies ?? [],
    phone: baseIsSeed ? undefined : base?.phone,
    location: baseIsSeed ? undefined : base?.location,
    university: baseIsSeed ? undefined : base?.university,
    graduationYear: baseIsSeed ? undefined : base?.graduationYear,
    notes: baseIsSeed ? undefined : base?.notes,
    isSeedData: false,
  }
}

type RoleContextValue = {
  role: Role
  setRole: (role: Role) => void
  athletes: Athlete[]
  primaryAthlete: Athlete | null
  activeAthleteId: number | null
  setActiveAthleteId: (id: number | null) => void
  scheduleSession: (athleteId: number, session: ScheduleSessionInput, options?: ScheduleOptions) => void
  toggleSessionCompletion: (athleteId: number, sessionId: number) => void
  addAthlete: (input: AddAthleteInput) => void
  assignSessionToTag: (tag: string, session: ScheduleSessionInput, options?: ScheduleOptions) => void
  updateHydrationLogs: (athleteId: number, updater: (logs: HydrationLog[]) => HydrationLog[]) => void
  updateMealLogs: (athleteId: number, updater: (logs: MealLog[]) => MealLog[]) => void
  updateMobilityExercises: (
    athleteId: number,
    updater: (exercises: MobilityExercise[]) => MobilityExercise[]
  ) => void
  updateMobilityLogs: (athleteId: number, updater: (logs: MobilityLog[]) => MobilityLog[]) => void
  updateCheckInLogs: (athleteId: number, updater: (logs: CheckInLog[]) => CheckInLog[]) => void
  updateAcademics: (
    athleteId: number,
    updater: (state: {
      courses: AcademicCourse[]
      academicItems: AcademicItem[]
    }) => {
      courses: AcademicCourse[]
      academicItems: AcademicItem[]
    }
  ) => void
  currentUser: UserAccount | null
  login: (input: LoginInput) => AuthResult
  createAccount: (input: CreateAccountInput) => AuthResult
  logout: () => void
  signIn: (input: SignInInput) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  updateAthleteProfile: (athleteId: number, updates: UpdateAthleteInput) => void
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

const STORAGE_KEY = "locker-app-state-v1"
const SERVER_STATE_ENDPOINT = "/api/state"

const formatTimeRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const format = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

  return `${format(start)} - ${format(end)}`
}

const toISO = (value: string) => {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

// Relaxed generic so we can sort any T using the accessor
const sortByDate = <T,>(items: T[], accessor: (item: T) => string) => {
  return [...items].sort((a, b) => {
    const aDate = new Date(accessor(a)).getTime()
    const bDate = new Date(accessor(b)).getTime()
    if (Number.isNaN(aDate) && Number.isNaN(bDate)) return 0
    if (Number.isNaN(aDate)) return 1
    if (Number.isNaN(bDate)) return -1
    return aDate - bDate
  })
}

const sanitizeGoalNumber = (value: number | null | undefined): number | undefined => {
  if (value === null || value === undefined) return undefined
  return Number.isFinite(value) ? value : undefined
}

const sanitizeNutritionGoals = (
  goals: Athlete["nutritionGoals"]
): Athlete["nutritionGoals"] | undefined => {
  if (!goals) return undefined
  const hydrationOuncesPerDay = sanitizeGoalNumber(goals.hydrationOuncesPerDay)
  const caloriesPerDay = sanitizeGoalNumber(goals.caloriesPerDay)
  const proteinGramsPerDay = sanitizeGoalNumber(goals.proteinGramsPerDay)
  const carbsGramsPerDay = sanitizeGoalNumber(goals.carbsGramsPerDay)
  const fatsGramsPerDay = sanitizeGoalNumber(goals.fatsGramsPerDay)

  if (
    hydrationOuncesPerDay === undefined &&
    caloriesPerDay === undefined &&
    proteinGramsPerDay === undefined &&
    carbsGramsPerDay === undefined &&
    fatsGramsPerDay === undefined
  ) {
    return undefined
  }

  return {
    hydrationOuncesPerDay,
    caloriesPerDay,
    proteinGramsPerDay,
    carbsGramsPerDay,
    fatsGramsPerDay,
  }
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("athlete")
  const [athletes, setAthletes] = useState<Athlete[]>(initialAthletes)
  const [activeAthleteId, setActiveAthleteId] = useState<number | null>(
    initialAthletes[0]?.id ?? null
  )
  const [accounts, setAccounts] = useState<StoredAccount[]>([])
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const sqlAuthEnabled = isSqlAuth()

  useEffect(() => {
    if (sqlAuthEnabled || typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as {
        role?: Role
        athletes?: Athlete[]
        activeAthleteId?: number | null
        currentUser?: UserAccount | null
        accounts?: StoredAccount[]
      }

      if (parsed.role) setRoleState(parsed.role)
      const normalizedAthletes = normalizeAthletes(parsed.athletes)
      if (normalizedAthletes.length > 0) {
        setAthletes(normalizedAthletes)
      }
      if (typeof parsed.activeAthleteId === "number" || parsed.activeAthleteId === null) {
        setActiveAthleteId(parsed.activeAthleteId ?? null)
      }
      if (parsed.currentUser) {
        setCurrentUser(parsed.currentUser)
      }
      const normalizedAccounts = normalizeAccounts(parsed.accounts)
      if (normalizedAccounts.length > 0) {
        setAccounts(normalizedAccounts)
      }
    } catch (error) {
      console.error("Failed to load Locker state", error)
    } finally {
      setIsHydrated(true)
    }
  }, [sqlAuthEnabled])

  useEffect(() => {
    if (sqlAuthEnabled || typeof window === "undefined" || !isHydrated) return
    const payload = JSON.stringify({
      role,
      athletes,
      activeAthleteId,
      currentUser,
      accounts,
    })
    window.localStorage.setItem(STORAGE_KEY, payload)
  }, [sqlAuthEnabled, role, athletes, activeAthleteId, currentUser, accounts, isHydrated])

  useEffect(() => {
    if (sqlAuthEnabled || typeof window === "undefined" || !isHydrated) return
    let cancelled = false

    const fetchServerState = async () => {
      try {
        const response = await fetch(SERVER_STATE_ENDPOINT, { cache: "no-store" })
        if (!response.ok) return
        const payload = (await response.json()) as {
          accounts?: unknown
          athletes?: unknown
        }
        if (cancelled) return

        const serverAccounts = normalizeAccounts(payload.accounts)
        if (serverAccounts.length > 0) {
          setAccounts((prev) => {
            if (prev.length === 0) return serverAccounts
            const merged = new Map<string, StoredAccount>()
            for (const account of prev) {
              merged.set(`${account.email}:${account.role}`, account)
            }
            for (const account of serverAccounts) {
              merged.set(`${account.email}:${account.role}`, account)
            }
            return Array.from(merged.values())
          })
        }

        const serverAthletes = normalizeAthletes(payload.athletes)
        if (serverAthletes.length > 0) {
          let mergedIdSet: Set<number> | null = null
          let fallbackId: number | null = serverAthletes[0]?.id ?? null
          setAthletes((prev) => {
            const serverIds = new Set(serverAthletes.map((athlete) => athlete.id))
            const extras = prev.filter((athlete) => !serverIds.has(athlete.id))
            const merged = [...serverAthletes, ...extras]
            mergedIdSet = new Set(merged.map((athlete) => athlete.id))
            if (fallbackId == null && merged.length > 0) {
              fallbackId = merged[0].id
            }
            return merged
          })

          if (mergedIdSet) {
            const resolvedFallback = fallbackId
            setActiveAthleteId((prevId) => {
              if (prevId != null && mergedIdSet!.has(prevId)) {
                return prevId
              }
              if (resolvedFallback != null) return resolvedFallback
              return prevId ?? null
            })
          }
        }
      } catch (error) {
        console.error("Failed to load server Locker state", error)
      }
    }

    void fetchServerState()

    return () => {
      cancelled = true
    }
  }, [sqlAuthEnabled, isHydrated])

  useEffect(() => {
    if (!sqlAuthEnabled) return

    let cancelled = false

    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" })
        if (!response.ok) {
          if (response.status !== 401) {
            console.error("Failed to fetch authenticated user", response.status)
          }
          if (!cancelled) {
            setCurrentUser(null)
            setRoleState("athlete")
            setActiveAthleteId(null)
          }
          return
        }

        const payload = (await response.json()) as { user?: SqlAuthUserPayload | null }
        if (cancelled) return

        const account = toUserAccountFromSql(payload.user)
        if (!account) {
          setCurrentUser(null)
          setRoleState("athlete")
          setActiveAthleteId(null)
          return
        }

        setCurrentUser(account)
        setRoleState(account.role)
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch authenticated user", error)
        }
      }
    }

    void fetchCurrentUser()

    return () => {
      cancelled = true
    }
  }, [sqlAuthEnabled])

  useEffect(() => {
    if (!sqlAuthEnabled) return

    if (!currentUser || currentUser.role !== "athlete" || currentUser.id == null) {
      setAthletes(initialAthletes)
      setActiveAthleteId(initialAthletes[0]?.id ?? null)
      return
    }

    const userId = currentUser.id

    const readPersistedData = (athlete: Athlete | null) => {
      const usable = athlete && !athlete.isSeedData ? athlete : null
      return {
        hydrationLogs: usable?.hydrationLogs ?? [],
        mealLogs: usable?.mealLogs ?? [],
        workouts: usable?.workouts ?? [],
        mobilityExercises: usable?.mobilityExercises ?? [],
        mobilityLogs: usable?.mobilityLogs ?? [],
        checkInLogs: usable?.checkInLogs ?? [],
        academicCourses: usable?.academicCourses ?? [],
        academicItems: usable?.academicItems ?? [],
      }
    }

    setAthletes((prev) => {
      const previous = prev.find((athlete) => athlete.id === userId) ?? null
      const persisted = readPersistedData(previous)
      return [
        buildAthleteForSqlUser(currentUser, {
          previous,
          ...persisted,
        }),
      ]
    })
    setActiveAthleteId(userId)

    let cancelled = false

    const loadHydrationLogs = async () => {
      try {
        const response = await fetch(`/api/athletes/${userId}/hydration-logs`, {
          cache: "no-store",
        })
        if (!response.ok) {
          if (response.status !== 404) {
            console.error("Failed to fetch hydration logs", response.status)
          }
          if (cancelled) return
          setAthletes((prev) => {
            const previous = prev.find((athlete) => athlete.id === userId) ?? null
            const persisted = readPersistedData(previous)
            return [
              buildAthleteForSqlUser(currentUser, {
                previous,
                ...persisted,
                hydrationLogs: [],
              }),
            ]
          })
          return
        }

        let payload: { hydrationLogs?: unknown } | null = null
        try {
          payload = (await response.json()) as { hydrationLogs?: unknown }
        } catch {
          payload = null
        }
        if (cancelled) return

        const hydrationLogs = sanitizeHydrationLogsFromServer(payload?.hydrationLogs)
        setAthletes((prev) => {
          const previous = prev.find((athlete) => athlete.id === userId) ?? null
          const persisted = readPersistedData(previous)
          return [
            buildAthleteForSqlUser(currentUser, {
              previous,
              ...persisted,
              hydrationLogs,
            }),
          ]
        })
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch hydration logs", error)
        }
      }
    }

    const loadMealLogs = async () => {
      try {
        const response = await fetch(`/api/athletes/${userId}/meal-logs`, { cache: "no-store" })
        if (!response.ok) {
          if (response.status !== 404) {
            console.error("Failed to fetch meal logs", response.status)
          }
          if (cancelled) return
          setAthletes((prev) => {
            const previous = prev.find((athlete) => athlete.id === userId) ?? null
            const persisted = readPersistedData(previous)
            return [
              buildAthleteForSqlUser(currentUser, {
                previous,
                ...persisted,
                mealLogs: [],
              }),
            ]
          })
          return
        }

        let payload: { mealLogs?: unknown } | null = null
        try {
          payload = (await response.json()) as { mealLogs?: unknown }
        } catch {
          payload = null
        }
        if (cancelled) return

        const mealLogs = sanitizeMealLogsFromServer(payload?.mealLogs)
        setAthletes((prev) => {
          const previous = prev.find((athlete) => athlete.id === userId) ?? null
          const persisted = readPersistedData(previous)
          return [
            buildAthleteForSqlUser(currentUser, {
              previous,
              ...persisted,
              mealLogs,
            }),
          ]
        })
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch meal logs", error)
        }
      }
    }

    const loadWorkouts = async () => {
      try {
        const response = await fetch(`/api/athletes/${userId}/workouts`, {
          cache: "no-store",
        })
        if (!response.ok) {
          if (response.status !== 404) {
            console.error("Failed to fetch workouts", response.status)
          }
          if (cancelled) return
          setAthletes((prev) => {
            const previous = prev.find((athlete) => athlete.id === userId) ?? null
            const persisted = readPersistedData(previous)
            return [
              buildAthleteForSqlUser(currentUser, {
                previous,
                ...persisted,
                workouts: [],
              }),
            ]
          })
          return
        }

        let payload: { workouts?: unknown } | null = null
        try {
          payload = (await response.json()) as { workouts?: unknown }
        } catch {
          payload = null
        }
        if (cancelled) return

        const workouts = sanitizeWorkoutsFromServer(payload?.workouts)
        setAthletes((prev) => {
          const previous = prev.find((athlete) => athlete.id === userId) ?? null
          const persisted = readPersistedData(previous)
          return [
            buildAthleteForSqlUser(currentUser, {
              previous,
              ...persisted,
              workouts,
            }),
          ]
        })
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch workouts", error)
        }
      }
    }

    const loadMobilityExercises = async () => {
      try {
        const response = await fetch(`/api/athletes/${userId}/mobility-exercises`, {
          cache: "no-store",
        })
        if (!response.ok) {
          if (response.status !== 404) {
            console.error("Failed to fetch mobility exercises", response.status)
          }
          if (cancelled) return
          setAthletes((prev) => {
            const previous = prev.find((athlete) => athlete.id === userId) ?? null
            const persisted = readPersistedData(previous)
            return [
              buildAthleteForSqlUser(currentUser, {
                previous,
                ...persisted,
                mobilityExercises: [],
              }),
            ]
          })
          return
        }

        let payload: { mobilityExercises?: unknown } | null = null
        try {
          payload = (await response.json()) as { mobilityExercises?: unknown }
        } catch {
          payload = null
        }
        if (cancelled) return

        const mobilityExercises = sanitizeMobilityExercisesFromServer(
          payload?.mobilityExercises
        )
        setAthletes((prev) => {
          const previous = prev.find((athlete) => athlete.id === userId) ?? null
          const persisted = readPersistedData(previous)
          return [
            buildAthleteForSqlUser(currentUser, {
              previous,
              ...persisted,
              mobilityExercises,
            }),
          ]
        })
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch mobility exercises", error)
        }
      }
    }

    const loadMobilityLogs = async () => {
      try {
        const response = await fetch(`/api/athletes/${userId}/mobility-logs`, {
          cache: "no-store",
        })
        if (!response.ok) {
          if (response.status !== 404) {
            console.error("Failed to fetch mobility logs", response.status)
          }
          if (cancelled) return
          setAthletes((prev) => {
            const previous = prev.find((athlete) => athlete.id === userId) ?? null
            const persisted = readPersistedData(previous)
            return [
              buildAthleteForSqlUser(currentUser, {
                previous,
                ...persisted,
                mobilityLogs: [],
              }),
            ]
          })
          return
        }

        let payload: { mobilityLogs?: unknown } | null = null
        try {
          payload = (await response.json()) as { mobilityLogs?: unknown }
        } catch {
          payload = null
        }
        if (cancelled) return

        const mobilityLogs = sanitizeMobilityLogsFromServer(payload?.mobilityLogs)
        setAthletes((prev) => {
          const previous = prev.find((athlete) => athlete.id === userId) ?? null
          const persisted = readPersistedData(previous)
          return [
            buildAthleteForSqlUser(currentUser, {
              previous,
              ...persisted,
              mobilityLogs,
            }),
          ]
        })
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch mobility logs", error)
        }
      }
    }

    const loadCheckInLogs = async () => {
      try {
        const response = await fetch(`/api/athletes/${userId}/check-in-logs`, {
          cache: "no-store",
        })
        if (!response.ok) {
          if (response.status !== 404) {
            console.error("Failed to fetch check-in logs", response.status)
          }
          if (cancelled) return
          setAthletes((prev) => {
            const previous = prev.find((athlete) => athlete.id === userId) ?? null
            const persisted = readPersistedData(previous)
            return [
              buildAthleteForSqlUser(currentUser, {
                previous,
                ...persisted,
                checkInLogs: [],
              }),
            ]
          })
          return
        }

        let payload: { checkInLogs?: unknown } | null = null
        try {
          payload = (await response.json()) as { checkInLogs?: unknown }
        } catch {
          payload = null
        }
        if (cancelled) return

        const checkInLogs = sanitizeCheckInLogsFromServer(payload?.checkInLogs)
        setAthletes((prev) => {
          const previous = prev.find((athlete) => athlete.id === userId) ?? null
          const persisted = readPersistedData(previous)
          return [
            buildAthleteForSqlUser(currentUser, {
              previous,
              ...persisted,
              checkInLogs,
            }),
          ]
        })
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch check-in logs", error)
        }
      }
    }

    const loadAcademics = async () => {
      try {
        const response = await fetch(`/api/athletes/${userId}/academics`, {
          cache: "no-store",
        })
        if (!response.ok) {
          if (response.status !== 404) {
            console.error("Failed to fetch academics", response.status)
          }
          if (cancelled) return
          setAthletes((prev) => {
            const previous = prev.find((athlete) => athlete.id === userId) ?? null
            const persisted = readPersistedData(previous)
            return [
              buildAthleteForSqlUser(currentUser, {
                previous,
                ...persisted,
                academicCourses: [],
                academicItems: [],
              }),
            ]
          })
          return
        }

        let payload: { courses?: unknown; academicItems?: unknown } | null = null
        try {
          payload = (await response.json()) as {
            courses?: unknown
            academicItems?: unknown
          }
        } catch {
          payload = null
        }
        if (cancelled) return

        const courses = sanitizeAcademicCoursesFromServer(payload?.courses)
        const academicItems = sanitizeAcademicItemsFromServer(payload?.academicItems)
        setAthletes((prev) => {
          const previous = prev.find((athlete) => athlete.id === userId) ?? null
          const persisted = readPersistedData(previous)
          return [
            buildAthleteForSqlUser(currentUser, {
              previous,
              ...persisted,
              academicCourses: courses,
              academicItems,
            }),
          ]
        })
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch academics", error)
        }
      }
    }

    void loadHydrationLogs()
    void loadMealLogs()
    void loadWorkouts()
    void loadMobilityExercises()
    void loadMobilityLogs()
    void loadCheckInLogs()
    void loadAcademics()

    return () => {
      cancelled = true
    }
  }, [sqlAuthEnabled, currentUser])

  const setRole = useCallback((nextRole: Role) => {
    setRoleState(nextRole)
  }, [])

  useEffect(() => {
    if (sqlAuthEnabled || typeof window === "undefined" || !isHydrated) return
    const controller = new AbortController()

    const syncState = async () => {
      try {
        await fetch(SERVER_STATE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accounts, athletes }),
          signal: controller.signal,
        })
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        console.error("Failed to sync Locker state", error)
      }
    }

    void syncState()

    return () => {
      controller.abort()
    }
  }, [sqlAuthEnabled, accounts, athletes, isHydrated])

  const applySessionToAthlete = useCallback(
    (
      athlete: Athlete,
      session: ScheduleSessionInput,
      options?: ScheduleOptions
    ): Athlete => {
      const startAtISO = toISO(session.startAt)
      const endAtISO = toISO(session.endAt)
      if (!startAtISO || !endAtISO) {
        return athlete
      }

      const id = Date.now() + Math.floor(Math.random() * 1000)
      const focus = options?.focus ?? session.notes ?? session.title
      const assignedBy = options?.assignedBy ?? (role === "coach" ? "Coach" : "Self")

      const newSession: Session = {
        id,
        type: session.type,
        title: session.title,
        startAt: startAtISO,
        endAt: endAtISO,
        intensity: session.intensity,
        notes: session.notes,
        completed: false,
        assignedBy,
        focus,
      }

      const updatedSessions = sortByDate([...athlete.sessions, newSession], (item) => item.startAt ?? "")

      const event: CalendarEvent = {
        id,
        title: session.title,
        date: startAtISO.includes("T") ? startAtISO.split("T")[0] : startAtISO,
        timeRange: formatTimeRange(startAtISO, endAtISO),
        type: session.type,
        focus,
      }

      const updatedCalendar = sortByDate([...athlete.calendar, event], (item) => item.date ?? "")

      const workout: WorkoutPlan = {
        id,
        title: session.title,
        focus,
        dueDate: event.date,
        status: "Scheduled",
        intensity: session.intensity,
        assignedBy,
      }

      const updatedWorkouts = sortByDate(
        [...athlete.workouts.filter((w) => w.id !== id), workout],
        (item) => item.dueDate
      )

      return {
        ...athlete,
        sessions: updatedSessions,
        calendar: updatedCalendar,
        workouts: updatedWorkouts,
      }
    },
    [role]
  )

  const syncWorkoutsToServer = useCallback(
    async (athleteId: number, workouts: WorkoutPlan[]) => {
      if (!sqlAuthEnabled) return
      if (!currentUser || currentUser.role !== "athlete" || currentUser.id == null) return
      if (currentUser.id !== athleteId) return

      try {
        const response = await fetch(`/api/athletes/${athleteId}/workouts`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workouts }),
        })

        if (!response.ok) {
          console.error("Failed to sync workouts", response.status)
          return
        }

        let payload: { workouts?: unknown } | null = null
        try {
          payload = (await response.json()) as { workouts?: unknown }
        } catch {
          payload = null
        }

        const normalized = sanitizeWorkoutsFromServer(payload?.workouts)
        setAthletes((prev) =>
          prev.map((athlete) =>
            athlete.id === athleteId ? { ...athlete, workouts: normalized } : athlete
          )
        )
      } catch (error) {
        console.error("Failed to sync workouts", error)
      }
    },
    [sqlAuthEnabled, currentUser]
  )

  const scheduleSession = useCallback(
    (athleteId: number, session: ScheduleSessionInput, options?: ScheduleOptions) => {
      let updatedWorkouts: WorkoutPlan[] | null = null
      setAthletes((prev) =>
        prev.map((athlete): Athlete => {
          if (athlete.id !== athleteId) return athlete

          const updated = applySessionToAthlete(athlete, session, options)
          updatedWorkouts = updated.workouts ?? []
          return updated
        })
      )
      if (updatedWorkouts) {
        void syncWorkoutsToServer(athleteId, updatedWorkouts)
      }
    },
    [applySessionToAthlete, syncWorkoutsToServer]
  )

  const toggleSessionCompletion = useCallback((athleteId: number, sessionId: number) => {
    let updatedWorkouts: WorkoutPlan[] | null = null
    setAthletes((prev) =>
      prev.map((athlete): Athlete => {
        if (athlete.id !== athleteId) return athlete

        const updatedSessions = athlete.sessions.map((session) =>
          session.id === sessionId ? { ...session, completed: !session.completed } : session
        )

        const completedSession = updatedSessions.find((session) => session.id === sessionId)

        const nextWorkouts = athlete.workouts.map((workout) =>
          workout.id === sessionId
            ? {
                ...workout,
                status: (completedSession && completedSession.completed
                  ? "Completed"
                  : "Scheduled") as WorkoutPlan["status"],
              }
            : workout
        )
        updatedWorkouts = nextWorkouts

        return {
          ...athlete,
          sessions: updatedSessions,
          workouts: nextWorkouts,
        }
      })
    )
    if (updatedWorkouts) {
      void syncWorkoutsToServer(athleteId, updatedWorkouts)
    }
  }, [syncWorkoutsToServer])

  const addAthlete = useCallback((input: AddAthleteInput) => {
    const email = input.email.trim().toLowerCase()
    if (!email) return

    const tags = normalizeTags(input.tags)

    setAthletes((prev) => {
      const existing = prev.find((athlete) => athlete.email.toLowerCase() === email)

      if (existing) {
        return prev.map((athlete) => {
          if (athlete.email.toLowerCase() !== email) return athlete

          const mergedTags = normalizeTags([...athlete.tags, ...tags])

          return {
            ...athlete,
            name: input.name?.trim() || athlete.name,
            sport: input.sport ?? athlete.sport,
            level: input.level ?? athlete.level,
            team: input.team ?? athlete.team,
            tags: mergedTags,
          }
        })
      }

      const id = Date.now() + Math.floor(Math.random() * 1000)
      const nameFromEmail = input.name?.trim() || email.split("@")[0]

      const newAthlete: Athlete = {
        id,
        name: nameFromEmail,
        email,
        sport: input.sport ?? "Unknown Sport",
        level: input.level ?? "Development",
        team: input.team ?? "Independent",
        tags,
        sessions: [],
        calendar: [],
        workouts: [],
        hydrationLogs: [],
        mealLogs: [],
        mobilityExercises: [],
        mobilityLogs: [],
        checkInLogs: [],
        academicCourses: [],
        academicItems: [],
      }

      return [...prev, newAthlete]
    })
  }, [])

  const assignSessionToTag = useCallback(
    (tag: string, session: ScheduleSessionInput, options?: ScheduleOptions) => {
      const normalizedTag = normalizeTag(tag)
      if (!normalizedTag) return

      const workoutsToSync: { athleteId: number; workouts: WorkoutPlan[] }[] = []
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (!athlete.tags.includes(normalizedTag)) return athlete
          const updated = applySessionToAthlete(athlete, session, options)
          workoutsToSync.push({ athleteId: updated.id, workouts: updated.workouts ?? [] })
          return updated
        })
      )

      for (const entry of workoutsToSync) {
        void syncWorkoutsToServer(entry.athleteId, entry.workouts)
      }
    },
    [applySessionToAthlete, syncWorkoutsToServer]
  )

  const syncHydrationLogsToServer = useCallback(
    async (athleteId: number, logs: HydrationLog[]) => {
      if (!sqlAuthEnabled) return
      if (!currentUser || currentUser.role !== "athlete" || currentUser.id == null) return
      if (currentUser.id !== athleteId) return

      try {
        const response = await fetch(`/api/athletes/${athleteId}/hydration-logs`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hydrationLogs: logs }),
        })

        if (!response.ok) {
          console.error("Failed to sync hydration logs", response.status)
          return
        }

        let payload: { hydrationLogs?: unknown } | null = null
        try {
          payload = (await response.json()) as { hydrationLogs?: unknown }
        } catch {
          payload = null
        }

        const normalized = sanitizeHydrationLogsFromServer(payload?.hydrationLogs)
        setAthletes((prev) =>
          prev.map((athlete) =>
            athlete.id === athleteId ? { ...athlete, hydrationLogs: normalized } : athlete
          )
        )
      } catch (error) {
        console.error("Failed to sync hydration logs", error)
      }
    },
    [sqlAuthEnabled, currentUser]
  )

  const updateHydrationLogs = useCallback(
    (athleteId: number, updater: (logs: HydrationLog[]) => HydrationLog[]) => {
      let updatedLogs: HydrationLog[] | null = null
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete
          const nextLogs = updater(athlete.hydrationLogs ?? [])
          updatedLogs = nextLogs
          return {
            ...athlete,
            hydrationLogs: nextLogs,
          }
        })
      )
      if (updatedLogs) {
        void syncHydrationLogsToServer(athleteId, updatedLogs)
      }
    },
    [syncHydrationLogsToServer]
  )

  const syncMealLogsToServer = useCallback(
    async (athleteId: number, logs: MealLog[]) => {
      if (!sqlAuthEnabled) return
      if (!currentUser || currentUser.role !== "athlete" || currentUser.id == null) return
      if (currentUser.id !== athleteId) return

      try {
        const response = await fetch(`/api/athletes/${athleteId}/meal-logs`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mealLogs: logs }),
        })

        if (!response.ok) {
          console.error("Failed to sync meal logs", response.status)
          return
        }

        let payload: { mealLogs?: unknown } | null = null
        try {
          payload = (await response.json()) as { mealLogs?: unknown }
        } catch {
          payload = null
        }

        const normalized = sanitizeMealLogsFromServer(payload?.mealLogs)
        setAthletes((prev) =>
          prev.map((athlete) =>
            athlete.id === athleteId ? { ...athlete, mealLogs: normalized } : athlete
          )
        )
      } catch (error) {
        console.error("Failed to sync meal logs", error)
      }
    },
    [sqlAuthEnabled, currentUser]
  )

  const updateMealLogs = useCallback(
    (athleteId: number, updater: (logs: MealLog[]) => MealLog[]) => {
      let updatedLogs: MealLog[] | null = null
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete
          const nextLogs = updater(athlete.mealLogs ?? [])
          updatedLogs = nextLogs
          return {
            ...athlete,
            mealLogs: nextLogs,
          }
        })
      )
      if (updatedLogs) {
        void syncMealLogsToServer(athleteId, updatedLogs)
      }
    },
    [syncMealLogsToServer]
  )

  const syncMobilityExercisesToServer = useCallback(
    async (athleteId: number, exercises: MobilityExercise[]) => {
      if (!sqlAuthEnabled) return
      if (!currentUser || currentUser.role !== "athlete" || currentUser.id == null) return
      if (currentUser.id !== athleteId) return

      try {
        const response = await fetch(`/api/athletes/${athleteId}/mobility-exercises`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobilityExercises: exercises }),
        })

        if (!response.ok) {
          console.error("Failed to sync mobility exercises", response.status)
          return
        }

        let payload: { mobilityExercises?: unknown } | null = null
        try {
          payload = (await response.json()) as { mobilityExercises?: unknown }
        } catch {
          payload = null
        }

        const normalized = sanitizeMobilityExercisesFromServer(
          payload?.mobilityExercises
        )
        setAthletes((prev) =>
          prev.map((athlete) =>
            athlete.id === athleteId
              ? { ...athlete, mobilityExercises: normalized }
              : athlete
          )
        )
      } catch (error) {
        console.error("Failed to sync mobility exercises", error)
      }
    },
    [sqlAuthEnabled, currentUser]
  )

  const updateMobilityExercises = useCallback(
    (
      athleteId: number,
      updater: (exercises: MobilityExercise[]) => MobilityExercise[]
    ) => {
      let updatedExercises: MobilityExercise[] | null = null
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete
          const nextExercises = updater(athlete.mobilityExercises ?? [])
          updatedExercises = nextExercises
          return {
            ...athlete,
            mobilityExercises: nextExercises,
          }
        })
      )
      if (updatedExercises) {
        void syncMobilityExercisesToServer(athleteId, updatedExercises)
      }
    },
    [syncMobilityExercisesToServer]
  )

  const syncMobilityLogsToServer = useCallback(
    async (athleteId: number, logs: MobilityLog[]) => {
      if (!sqlAuthEnabled) return
      if (!currentUser || currentUser.role !== "athlete" || currentUser.id == null) return
      if (currentUser.id !== athleteId) return

      try {
        const response = await fetch(`/api/athletes/${athleteId}/mobility-logs`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobilityLogs: logs }),
        })

        if (!response.ok) {
          console.error("Failed to sync mobility logs", response.status)
          return
        }

        let payload: { mobilityLogs?: unknown } | null = null
        try {
          payload = (await response.json()) as { mobilityLogs?: unknown }
        } catch {
          payload = null
        }

        const normalized = sanitizeMobilityLogsFromServer(payload?.mobilityLogs)
        setAthletes((prev) =>
          prev.map((athlete) =>
            athlete.id === athleteId
              ? { ...athlete, mobilityLogs: normalized }
              : athlete
          )
        )
      } catch (error) {
        console.error("Failed to sync mobility logs", error)
      }
    },
    [sqlAuthEnabled, currentUser]
  )

  const updateMobilityLogs = useCallback(
    (athleteId: number, updater: (logs: MobilityLog[]) => MobilityLog[]) => {
      let updatedLogs: MobilityLog[] | null = null
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete
          const nextLogs = updater(athlete.mobilityLogs ?? [])
          updatedLogs = nextLogs
          return {
            ...athlete,
            mobilityLogs: nextLogs,
          }
        })
      )
      if (updatedLogs) {
        void syncMobilityLogsToServer(athleteId, updatedLogs)
      }
    },
    [syncMobilityLogsToServer]
  )

  const syncCheckInLogsToServer = useCallback(
    async (athleteId: number, logs: CheckInLog[]) => {
      if (!sqlAuthEnabled) return
      if (!currentUser || currentUser.role !== "athlete" || currentUser.id == null) return
      if (currentUser.id !== athleteId) return

      try {
        const response = await fetch(`/api/athletes/${athleteId}/check-in-logs`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkInLogs: logs }),
        })

        if (!response.ok) {
          console.error("Failed to sync check-in logs", response.status)
          return
        }

        let payload: { checkInLogs?: unknown } | null = null
        try {
          payload = (await response.json()) as { checkInLogs?: unknown }
        } catch {
          payload = null
        }

        const normalized = sanitizeCheckInLogsFromServer(payload?.checkInLogs)
        setAthletes((prev) =>
          prev.map((athlete) =>
            athlete.id === athleteId
              ? { ...athlete, checkInLogs: normalized }
              : athlete
          )
        )
      } catch (error) {
        console.error("Failed to sync check-in logs", error)
      }
    },
    [sqlAuthEnabled, currentUser]
  )

  const syncAcademicsToServer = useCallback(
    async (
      athleteId: number,
      courses: AcademicCourse[],
      academicItems: AcademicItem[],
    ) => {
      if (!sqlAuthEnabled) return
      if (!currentUser || currentUser.role !== "athlete" || currentUser.id == null) return
      if (currentUser.id !== athleteId) return

      try {
        const response = await fetch(`/api/athletes/${athleteId}/academics`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courses, academicItems }),
        })

        if (!response.ok) {
          console.error("Failed to sync academics", response.status)
          return
        }

        let payload: { courses?: unknown; academicItems?: unknown } | null = null
        try {
          payload = (await response.json()) as {
            courses?: unknown
            academicItems?: unknown
          }
        } catch {
          payload = null
        }

        const normalizedCourses = sanitizeAcademicCoursesFromServer(payload?.courses)
        const normalizedItems = sanitizeAcademicItemsFromServer(payload?.academicItems)
        setAthletes((prev) =>
          prev.map((athlete) =>
            athlete.id === athleteId
              ? {
                  ...athlete,
                  academicCourses: normalizedCourses,
                  academicItems: normalizedItems,
                }
              : athlete,
          ),
        )
      } catch (error) {
        console.error("Failed to sync academics", error)
      }
    },
    [sqlAuthEnabled, currentUser],
  )

  const updateCheckInLogs = useCallback(
    (athleteId: number, updater: (logs: CheckInLog[]) => CheckInLog[]) => {
      let updatedLogs: CheckInLog[] | null = null
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete
          const nextLogs = updater(athlete.checkInLogs ?? [])
          updatedLogs = nextLogs
          return {
            ...athlete,
            checkInLogs: nextLogs,
          }
        })
      )
      if (updatedLogs) {
        void syncCheckInLogsToServer(athleteId, updatedLogs)
      }
    },
    [syncCheckInLogsToServer]
  )

  const updateAcademics = useCallback(
    (
      athleteId: number,
      updater: (state: {
        courses: AcademicCourse[]
        academicItems: AcademicItem[]
      }) => { courses: AcademicCourse[]; academicItems: AcademicItem[] },
    ) => {
      let nextState: { courses: AcademicCourse[]; academicItems: AcademicItem[] } | null = null
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete
          const result = updater({
            courses: athlete.academicCourses ?? [],
            academicItems: athlete.academicItems ?? [],
          })
          nextState = result
          return {
            ...athlete,
            academicCourses: result.courses,
            academicItems: result.academicItems,
          }
        }),
      )
      if (nextState) {
        void syncAcademicsToServer(athleteId, nextState.courses, nextState.academicItems)
      }
    },
    [syncAcademicsToServer],
  )

  const updateAthleteProfile = useCallback(
    (athleteId: number, updates: UpdateAthleteInput) => {
      let updated: Athlete | null = null
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete

          const normalizedTags = updates.tags ? normalizeTags(updates.tags) : athlete.tags
          const normalizedAllergies = updates.allergies
            ? updates.allergies
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
            : athlete.allergies ?? []
          const normalizedEmail = updates.email?.trim().toLowerCase() || athlete.email
          const hasNutritionGoals = Object.prototype.hasOwnProperty.call(updates, "nutritionGoals")
          const normalizedNutritionGoals = hasNutritionGoals
            ? sanitizeNutritionGoals(updates.nutritionGoals)
            : athlete.nutritionGoals

          updated = {
            ...athlete,
            ...updates,
            email: normalizedEmail,
            tags: normalizedTags,
            allergies: normalizedAllergies,
            nutritionGoals: normalizedNutritionGoals,
          }

          return updated
        })
      )

      if (updated) {
        setCurrentUser((prev) => {
          if (prev?.role === "athlete" && prev.athleteId === athleteId) {
            return {
              ...prev,
              name: updated!.name,
              email: updated!.email,
            }
          }
          return prev
        })
      }
    },
    []
  )

  const login = useCallback(
    ({ email, role: loginRole, password }: LoginInput): AuthResult => {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) {
        return { success: false, error: "Email is required to sign in." }
      }

      const account = accounts.find(
        (stored) => stored.email === normalizedEmail && stored.role === loginRole
      )

      if (!account) {
        return { success: false, error: "No account found for that email." }
      }

      if (account.password !== password) {
        return { success: false, error: "Incorrect password." }
      }

      const { password: _password, ...accountWithoutPassword } = account
      void _password

      if (loginRole === "athlete") {
        const athleteId = accountWithoutPassword.athleteId
        const existingAthlete = athleteId
          ? athletes.find((athlete) => athlete.id === athleteId)
          : undefined

        if (!existingAthlete) {
          const inferredName = accountWithoutPassword.name || normalizedEmail.split("@")[0]
          const newAthlete: Athlete = {
            id: athleteId ?? Date.now() + Math.floor(Math.random() * 1000),
            name: inferredName,
            email: normalizedEmail,
            sport: "",
            level: "",
            team: "",
            tags: [],
            sessions: [],
            calendar: [],
            workouts: [],
            hydrationLogs: [],
            mealLogs: [],
            mobilityExercises: [],
            mobilityLogs: [],
            checkInLogs: [],
          }

          setAthletes((prev) => {
            const withoutSeed = prev.filter((athlete) => !athlete.isSeedData)
            return [...withoutSeed, newAthlete]
          })
          setActiveAthleteId(newAthlete.id)
          setCurrentUser({ ...accountWithoutPassword, athleteId: newAthlete.id })
          setRoleState("athlete")
          setAccounts((prev) =>
            prev.map((stored) =>
              stored.email === account.email && stored.role === account.role
                ? { ...stored, athleteId: newAthlete.id }
                : stored
            )
          )
          return { success: true }
        }

        setActiveAthleteId(existingAthlete.id)
        setCurrentUser({ ...accountWithoutPassword, athleteId: existingAthlete.id })
        setRoleState("athlete")
        return { success: true }
      }

      setCurrentUser(accountWithoutPassword)
      setRoleState("coach")
      return { success: true }
    },
    [accounts, athletes]
  )

  const createAccount = useCallback(
    ({ email, role: accountRole, password, name }: CreateAccountInput): AuthResult => {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) {
        return { success: false, error: "Email is required to create an account." }
      }
      if (!password) {
        return { success: false, error: "Password is required." }
      }

      const existingAccount = accounts.find(
        (stored) => stored.email === normalizedEmail && stored.role === accountRole
      )

      if (existingAccount) {
        return { success: false, error: "An account with that email already exists." }
      }

      if (accountRole === "athlete") {
        const id = Date.now() + Math.floor(Math.random() * 1000)
        const inferredName = name?.trim() || normalizedEmail.split("@")[0]
        const newAthlete: Athlete = {
          id,
          name: inferredName,
          email: normalizedEmail,
          sport: "",
          level: "",
          team: "",
          tags: [],
          sessions: [],
          calendar: [],
          workouts: [],
          hydrationLogs: [],
          mealLogs: [],
          mobilityExercises: [],
          mobilityLogs: [],
          checkInLogs: [],
        }

        setAthletes((prev) => {
          const withoutSeed = prev.filter((athlete) => !athlete.isSeedData)
          return [...withoutSeed, newAthlete]
        })
        setActiveAthleteId(id)

        const newAccount: StoredAccount = {
          email: normalizedEmail,
          name: inferredName,
          role: "athlete",
          password,
          athleteId: id,
        }

        setAccounts((prev) => [...prev, newAccount])
        setCurrentUser({ email: normalizedEmail, name: inferredName, role: "athlete", athleteId: id })
        setRoleState("athlete")
        return { success: true }
      }

      const coachName = name?.trim() || normalizedEmail.split("@")[0]
      const newAccount: StoredAccount = {
        email: normalizedEmail,
        name: coachName,
        role: "coach",
        password,
      }

      setAccounts((prev) => [...prev, newAccount])
      setCurrentUser({ email: normalizedEmail, name: coachName, role: "coach" })
      setRoleState("coach")
      return { success: true }
    },
    [accounts]
  )
  

  const logout = useCallback(() => {
    setCurrentUser(null)
    setActiveAthleteId(null)
    setRoleState("athlete")
  }, [])

  const signIn = useCallback(
    async ({ email, password, role: inputRole }: SignInInput): Promise<AuthResult> => {
      if (!sqlAuthEnabled) {
        if (!inputRole) {
          return { success: false, error: "Role is required to sign in." }
        }
        return login({ email, password, role: inputRole })
      }

      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) {
        return { success: false, error: "Email is required to sign in." }
      }
      if (!password) {
        return { success: false, error: "Password is required to sign in." }
      }

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password }),
        })

        let payload: { user?: SqlAuthUserPayload | null; error?: unknown } | null = null
        try {
          payload = (await response.json()) as { user?: SqlAuthUserPayload | null; error?: unknown }
        } catch {
          payload = null
        }

        if (!response.ok) {
          const errorMessage =
            typeof payload?.error === "string" && payload.error
              ? payload.error
              : "Unable to sign in."
          return { success: false, error: errorMessage }
        }

        const account = toUserAccountFromSql(payload?.user)
        if (!account) {
          return { success: false, error: "Unable to sign in." }
        }

        setCurrentUser(account)
        setRoleState(account.role)
        setActiveAthleteId(null)

        return { success: true }
      } catch (error) {
        console.error("Failed to sign in", error)
        return { success: false, error: "Unable to sign in." }
      }
    },
    [sqlAuthEnabled, login]
  )

  const signOut = useCallback(async (): Promise<AuthResult> => {
    if (!sqlAuthEnabled) {
      logout()
      return { success: true }
    }

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) {
        return { success: false, error: "Unable to sign out." }
      }

      setCurrentUser(null)
      setRoleState("athlete")
      setActiveAthleteId(null)

      return { success: true }
    } catch (error) {
      console.error("Failed to sign out", error)
      return { success: false, error: "Unable to sign out." }
    }
  }, [sqlAuthEnabled, logout])

  useEffect(() => {
    if (currentUser?.role === "athlete" && currentUser.athleteId) {
      setActiveAthleteId((prev) => prev ?? currentUser.athleteId ?? null)
    }
  }, [currentUser])

  const primaryAthlete = useMemo(() => {
    if (activeAthleteId != null) {
      return athletes.find((athlete) => athlete.id === activeAthleteId) ?? athletes[0] ?? null
    }
    return athletes[0] ?? null
  }, [athletes, activeAthleteId])

  const value = useMemo(
    () => ({
      role,
      setRole,
      athletes,
      primaryAthlete,
      activeAthleteId,
      setActiveAthleteId,
      scheduleSession,
      toggleSessionCompletion,
      addAthlete,
      assignSessionToTag,
      updateHydrationLogs,
      updateMealLogs,
      updateMobilityExercises,
      updateMobilityLogs,
      updateCheckInLogs,
      updateAcademics,
      updateAthleteProfile,
      currentUser,
      login,
      createAccount,
      logout,
      signIn,
      signOut,
    }),
    [
      role,
      setRole,
      athletes,
      primaryAthlete,
      activeAthleteId,
      scheduleSession,
      toggleSessionCompletion,
      addAthlete,
      assignSessionToTag,
      updateHydrationLogs,
      updateMealLogs,
      updateMobilityExercises,
      updateMobilityLogs,
      updateCheckInLogs,
      updateAcademics,
      updateAthleteProfile,
      currentUser,
      login,
      createAccount,
      logout,
      signIn,
      signOut,
    ]
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export const useRole = () => {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider")
  }
  return context
}

export type { MealLog, NutritionFact } from "@/lib/role-types"
