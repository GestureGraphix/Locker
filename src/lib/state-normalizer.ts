import type {
  Athlete,
  CalendarEvent,
  HydrationLog,
  MealLog,
  MobilityExercise,
  MobilityLog,
  NutritionFact,
  NutritionGoals,
  Session,
  StoredAccount,
  WorkoutPlan,
} from "./role-types"

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isString = (value: unknown): value is string => typeof value === "string"

export const normalizeTag = (tag: string) => tag.trim().toLowerCase()

export const normalizeTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return []
  const normalized = tags
    .map((tag) => (isString(tag) ? normalizeTag(tag) : ""))
    .filter((tag) => tag.length > 0)
  return Array.from(new Set(normalized))
}

const normalizeNutritionFacts = (facts: unknown): NutritionFact[] => {
  if (!Array.isArray(facts)) return []
  const normalized: NutritionFact[] = []
  for (const fact of facts) {
    if (!fact || typeof fact !== "object") continue
    const record = fact as Record<string, unknown>
    if (!isString(record.name) || !record.name.trim()) continue
    const amount =
      isFiniteNumber(record.amount) ? record.amount : undefined
    const percentDailyValue =
      isFiniteNumber(record.percentDailyValue) ? record.percentDailyValue : undefined
    const unit = isString(record.unit) ? record.unit : undefined
    const display = isString(record.display) ? record.display : undefined
    normalized.push({
      name: record.name.trim(),
      amount,
      unit,
      percentDailyValue,
      display,
    })
  }
  return normalized
}

const normalizeHydrationLogs = (logs: unknown): HydrationLog[] => {
  if (!Array.isArray(logs)) return []
  const normalized: HydrationLog[] = []
  for (const entry of logs) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    if (!isFiniteNumber(record.id)) continue
    if (!isString(record.date) || !isString(record.source) || !isString(record.time)) continue
    const ounces = Number(record.ounces)
    if (!Number.isFinite(ounces)) continue
    normalized.push({
      id: record.id,
      date: record.date,
      ounces,
      source: record.source,
      time: record.time,
    })
  }
  return normalized
}

const normalizeMealLogs = (logs: unknown): MealLog[] => {
  if (!Array.isArray(logs)) return []
  const normalized: MealLog[] = []
  for (const entry of logs) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    if (!isFiniteNumber(record.id)) continue
    if (!isString(record.dateTime) || !isString(record.mealType)) continue
    const calories = Number(record.calories)
    const proteinG = Number(record.proteinG)
    if (!Number.isFinite(calories) || !Number.isFinite(proteinG)) continue
    const notes = isString(record.notes) ? record.notes : ""
    const completed = record.completed === true
    normalized.push({
      id: record.id,
      dateTime: record.dateTime,
      mealType: record.mealType,
      calories,
      proteinG,
      notes,
      completed,
      nutritionFacts: normalizeNutritionFacts(record.nutritionFacts),
    })
  }
  return normalized
}

const normalizeMobilityExercises = (value: unknown): MobilityExercise[] => {
  if (!Array.isArray(value)) return []
  const normalized: MobilityExercise[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    if (!isFiniteNumber(record.id)) continue
    if (!isString(record.group) || !record.group.trim()) continue
    if (!isString(record.name) || !record.name.trim()) continue
    const youtubeUrl = isString(record.youtubeUrl) ? record.youtubeUrl.trim() : undefined
    const prescription = isString(record.prescription)
      ? record.prescription.trim()
      : undefined
    const thumbnail = isString(record.thumbnail) ? record.thumbnail : undefined
    normalized.push({
      id: record.id,
      group: record.group.trim(),
      name: record.name.trim(),
      youtubeUrl: youtubeUrl && youtubeUrl.length > 0 ? youtubeUrl : undefined,
      prescription: prescription && prescription.length > 0 ? prescription : undefined,
      thumbnail: thumbnail && thumbnail.length > 0 ? thumbnail : undefined,
    })
  }
  return normalized
}

const normalizeMobilityLogs = (value: unknown): MobilityLog[] => {
  if (!Array.isArray(value)) return []
  const normalized: MobilityLog[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    if (!isFiniteNumber(record.id)) continue
    if (!isFiniteNumber(record.exerciseId)) continue
    if (!isString(record.exerciseName) || !record.exerciseName.trim()) continue
    if (!isString(record.date) || !record.date.trim()) continue
    const duration = Number(record.durationMin)
    if (!Number.isFinite(duration) || duration < 0) continue
    const notes = isString(record.notes) ? record.notes : undefined
    normalized.push({
      id: record.id,
      exerciseId: record.exerciseId,
      exerciseName: record.exerciseName.trim(),
      date: record.date.trim(),
      durationMin: duration,
      notes,
    })
  }
  return normalized
}

const normalizeGoalNumber = (value: unknown): number | undefined => {
  if (typeof value !== "number") return undefined
  if (!Number.isFinite(value)) return undefined
  return value
}

const normalizeNutritionGoals = (goals: unknown): NutritionGoals | undefined => {
  if (!goals || typeof goals !== "object") return undefined
  const record = goals as Record<string, unknown>
  const hydrationOuncesPerDay = normalizeGoalNumber(record.hydrationOuncesPerDay)
  const caloriesPerDay = normalizeGoalNumber(record.caloriesPerDay)
  const proteinGramsPerDay = normalizeGoalNumber(record.proteinGramsPerDay)
  const carbsGramsPerDay = normalizeGoalNumber(record.carbsGramsPerDay)
  const fatsGramsPerDay = normalizeGoalNumber(record.fatsGramsPerDay)

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

const normalizeSessions = (sessions: unknown): Session[] => {
  if (!Array.isArray(sessions)) return []
  const normalized: Session[] = []
  for (const session of sessions) {
    if (!session || typeof session !== "object") continue
    const record = session as Record<string, unknown>
    if (!isFiniteNumber(record.id)) continue
    if (!isString(record.type) || !isString(record.title)) continue
    if (!isString(record.startAt) || !isString(record.endAt) || !isString(record.intensity)) continue
    const notes = isString(record.notes) ? record.notes : undefined
    const assignedBy = isString(record.assignedBy) ? record.assignedBy : undefined
    const focus = isString(record.focus) ? record.focus : undefined
    const completed = record.completed === true
    normalized.push({
      id: record.id,
      type: record.type,
      title: record.title,
      startAt: record.startAt,
      endAt: record.endAt,
      intensity: record.intensity,
      notes,
      completed,
      assignedBy,
      focus,
    })
  }
  return normalized
}

const normalizeCalendarEvents = (events: unknown): CalendarEvent[] => {
  if (!Array.isArray(events)) return []
  const normalized: CalendarEvent[] = []
  for (const event of events) {
    if (!event || typeof event !== "object") continue
    const record = event as Record<string, unknown>
    if (!isFiniteNumber(record.id)) continue
    if (!isString(record.title) || !isString(record.date)) continue
    if (!isString(record.timeRange) || !isString(record.type)) continue
    const focus = isString(record.focus) ? record.focus : undefined
    normalized.push({
      id: record.id,
      title: record.title,
      date: record.date,
      timeRange: record.timeRange,
      type: record.type,
      focus,
    })
  }
  return normalized
}

const normalizeWorkouts = (workouts: unknown): WorkoutPlan[] => {
  if (!Array.isArray(workouts)) return []
  const normalized: WorkoutPlan[] = []
  for (const workout of workouts) {
    if (!workout || typeof workout !== "object") continue
    const record = workout as Record<string, unknown>
    if (!isFiniteNumber(record.id)) continue
    if (!isString(record.title) || !isString(record.focus) || !isString(record.dueDate)) continue
    if (!isString(record.status) || (record.status !== "Scheduled" && record.status !== "Completed")) continue
    if (!isString(record.intensity)) continue
    const assignedBy = isString(record.assignedBy) ? record.assignedBy : undefined
    normalized.push({
      id: record.id,
      title: record.title,
      focus: record.focus,
      dueDate: record.dueDate,
      status: record.status === "Completed" ? "Completed" : "Scheduled",
      intensity: record.intensity,
      assignedBy,
    })
  }
  return normalized
}

const normalizeAthlete = (value: unknown): Athlete | null => {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (!isFiniteNumber(record.id)) return null
  if (!isString(record.email) || !record.email.trim()) return null
  const email = record.email.trim().toLowerCase()
  const name = isString(record.name) && record.name.trim() ? record.name.trim() : email
  const sport = isString(record.sport) ? record.sport : ""
  const level = isString(record.level) ? record.level : ""
  const team = isString(record.team) ? record.team : ""
  const position = isString(record.position) ? record.position : undefined
  const coachEmail = isString(record.coachEmail) ? record.coachEmail : undefined
  const location = isString(record.location) ? record.location : undefined
  const university = isString(record.university) ? record.university : undefined
  const graduationYear = isString(record.graduationYear) ? record.graduationYear : undefined
  const phone = isString(record.phone) ? record.phone : undefined
  const notes = isString(record.notes) ? record.notes : undefined
  const heightCm = isFiniteNumber(record.heightCm) ? record.heightCm : undefined
  const weightKg = isFiniteNumber(record.weightKg) ? record.weightKg : undefined
  const allergies = Array.isArray(record.allergies)
    ? record.allergies.filter(isString).map((item) => item.trim()).filter((item) => item.length > 0)
    : undefined
  const tags = normalizeTags(record.tags)
  const nutritionGoals = normalizeNutritionGoals(record.nutritionGoals)
  return {
    id: record.id,
    name,
    email,
    sport,
    level,
    team,
    tags,
    sessions: normalizeSessions(record.sessions),
    calendar: normalizeCalendarEvents(record.calendar),
    workouts: normalizeWorkouts(record.workouts),
    hydrationLogs: normalizeHydrationLogs(record.hydrationLogs),
    mealLogs: normalizeMealLogs(record.mealLogs),
    mobilityExercises: normalizeMobilityExercises(record.mobilityExercises),
    mobilityLogs: normalizeMobilityLogs(record.mobilityLogs),
    nutritionGoals,
    coachEmail,
    position,
    heightCm,
    weightKg,
    allergies,
    phone,
    location,
    university,
    graduationYear,
    notes,
    isSeedData: record.isSeedData === true,
  }
}

export const normalizeAthletes = (value: unknown): Athlete[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  const normalized: Athlete[] = []
  for (const entry of value) {
    const athlete = normalizeAthlete(entry)
    if (!athlete) continue
    if (seen.has(athlete.id)) continue
    seen.add(athlete.id)
    normalized.push(athlete)
  }
  return normalized
}

const ROLE_VALUES = new Set(["athlete", "coach"])

export const normalizeAccounts = (value: unknown): StoredAccount[] => {
  if (!Array.isArray(value)) return []
  const map = new Map<string, StoredAccount>()
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    if (!isString(record.email) || !record.email.trim()) continue
    const email = record.email.trim().toLowerCase()
    if (!isString(record.password) || !record.password) continue
    if (!isString(record.role) || !ROLE_VALUES.has(record.role)) continue
    const name = isString(record.name) && record.name.trim() ? record.name.trim() : email
    const athleteId = isFiniteNumber(record.athleteId) ? record.athleteId : undefined
    const key = `${email}:${record.role}`
    map.set(key, {
      email,
      name,
      role: record.role as StoredAccount["role"],
      password: record.password,
      athleteId,
    })
  }
  return Array.from(map.values())
}
