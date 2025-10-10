"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

type Role = "athlete" | "coach"

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

type Session = {
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

type CalendarEvent = {
  id: number
  title: string
  date: string
  timeRange: string
  type: string
  focus?: string
}

type WorkoutPlan = {
  id: number
  title: string
  focus: string
  dueDate: string
  status: "Scheduled" | "Completed"
  intensity: string
  assignedBy?: string
}

const normalizeTag = (tag: string) => tag.trim().toLowerCase()

const normalizeTags = (tags: string[] = []) => {
  const normalized = tags
    .map(normalizeTag)
    .filter((tag) => tag.length > 0)
  return Array.from(new Set(normalized))
}

type Athlete = {
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
}

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

type UserAccount = {
  email: string
  name: string
  role: Role
  athleteId?: number
}

type LoginInput = {
  email: string
  role: Role
  name?: string
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
  currentUser: UserAccount | null
  login: (input: LoginInput) => void
  logout: () => void
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

const STORAGE_KEY = "locker-app-state-v1"

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

const initialHydrationLogs: HydrationLog[] = [
  { id: 1, date: "2024-01-15", ounces: 8, source: "cup", time: "08:00" },
  { id: 2, date: "2024-01-15", ounces: 12, source: "bottle", time: "10:30" },
  { id: 3, date: "2024-01-15", ounces: 8, source: "cup", time: "12:00" },
  { id: 4, date: "2024-01-15", ounces: 17, source: "shake", time: "14:00" },
  { id: 5, date: "2024-01-15", ounces: 8, source: "cup", time: "16:30" },
]

const initialMealLogs: MealLog[] = [
  {
    id: 1,
    dateTime: "2024-01-15T08:00:00Z",
    mealType: "breakfast",
    calories: 450,
    proteinG: 25,
    notes: "Oatmeal with berries and protein powder",
    completed: true,
    nutritionFacts: [],
  },
  {
    id: 2,
    dateTime: "2024-01-15T12:30:00Z",
    mealType: "lunch",
    calories: 650,
    proteinG: 40,
    notes: "Grilled chicken salad",
    completed: true,
    nutritionFacts: [],
  },
  {
    id: 3,
    dateTime: "2024-01-15T18:00:00Z",
    mealType: "dinner",
    calories: 0,
    proteinG: 0,
    notes: "Planned: Salmon with quinoa",
    completed: false,
    nutritionFacts: [],
  },
  {
    id: 4,
    dateTime: "2024-01-15T15:00:00Z",
    mealType: "snack",
    calories: 200,
    proteinG: 15,
    notes: "Greek yogurt with nuts",
    completed: true,
    nutritionFacts: [],
  },
]

const initialAthletes: Athlete[] = [
  {
    id: 1,
    name: "Alex Johnson",
    email: "alex.johnson@locker.app",
    sport: "Track & Field",
    level: "Elite",
    team: "Sprints",
    tags: ["track", "sprints"],
    sessions: [
      {
        id: 1,
        type: "practice",
        title: "Morning Practice",
        startAt: "2024-01-15T06:00:00Z",
        endAt: "2024-01-15T08:00:00Z",
        intensity: "high",
        notes: "Focus on technique",
        completed: true,
        assignedBy: "Coach Rivera",
        focus: "Acceleration Drills",
      },
    ],
    calendar: [
      {
        id: 1,
        title: "Morning Practice",
        date: "2024-01-15",
        timeRange: "6:00 AM - 8:00 AM",
        type: "practice",
        focus: "Acceleration Drills",
      },
    ],
    workouts: [
      {
        id: 1,
        title: "Acceleration Drills",
        focus: "Speed Mechanics",
        dueDate: "2024-01-15",
        status: "Completed",
        intensity: "high",
        assignedBy: "Coach Rivera",
      },
    ],
    hydrationLogs: initialHydrationLogs,
    mealLogs: initialMealLogs,
    coachEmail: "coach.rivera@locker.app",
  },
]

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("athlete")
  const [athletes, setAthletes] = useState<Athlete[]>(initialAthletes)
  const [activeAthleteId, setActiveAthleteId] = useState<number | null>(initialAthletes[0]?.id ?? null)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as {
        role?: Role
        athletes?: Athlete[]
        activeAthleteId?: number | null
        currentUser?: UserAccount | null
      }

      if (parsed.role) setRoleState(parsed.role)
      if (Array.isArray(parsed.athletes) && parsed.athletes.length > 0) {
        const normalized: Athlete[] = parsed.athletes.map((athlete: Athlete) => ({
          ...athlete,
          tags: Array.isArray(athlete.tags) ? normalizeTags(athlete.tags) : [],
          sessions: Array.isArray(athlete.sessions) ? athlete.sessions : [],
          calendar: Array.isArray(athlete.calendar) ? athlete.calendar : [],
          workouts: Array.isArray(athlete.workouts) ? athlete.workouts : [],
          hydrationLogs: Array.isArray((athlete as Partial<Athlete>).hydrationLogs)
            ? (athlete as Partial<Athlete>).hydrationLogs!
            : [],
          mealLogs: Array.isArray((athlete as Partial<Athlete>).mealLogs)
            ? (athlete as Partial<Athlete>).mealLogs!
            : [],
        }))
        setAthletes(normalized)
      }
      if (typeof parsed.activeAthleteId === "number" || parsed.activeAthleteId === null) {
        setActiveAthleteId(parsed.activeAthleteId ?? null)
      }
      if (parsed.currentUser) {
        setCurrentUser(parsed.currentUser)
      }
    } catch (error) {
      console.error("Failed to load Locker state", error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const payload = JSON.stringify({
      role,
      athletes,
      activeAthleteId,
      currentUser,
    })
    window.localStorage.setItem(STORAGE_KEY, payload)
  }, [role, athletes, activeAthleteId, currentUser])

  const setRole = useCallback((nextRole: Role) => {
    setRoleState(nextRole)
  }, [])

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

  const scheduleSession = useCallback(
    (athleteId: number, session: ScheduleSessionInput, options?: ScheduleOptions) => {
      setAthletes((prev) =>
        prev.map((athlete): Athlete => {
          if (athlete.id !== athleteId) return athlete

          return applySessionToAthlete(athlete, session, options)
        })
      )
    },
    [applySessionToAthlete]
  )

  const toggleSessionCompletion = useCallback((athleteId: number, sessionId: number) => {
    setAthletes((prev) =>
      prev.map((athlete): Athlete => {
        if (athlete.id !== athleteId) return athlete

        const updatedSessions = athlete.sessions.map((session) =>
          session.id === sessionId ? { ...session, completed: !session.completed } : session
        )

        const completedSession = updatedSessions.find((session) => session.id === sessionId)

        const updatedWorkouts = athlete.workouts.map((workout) =>
          workout.id === sessionId
            ? {
                ...workout,
                status: (completedSession && completedSession.completed
                  ? "Completed"
                  : "Scheduled") as WorkoutPlan["status"],
              }
            : workout
        )

        return {
          ...athlete,
          sessions: updatedSessions,
          workouts: updatedWorkouts,
        }
      })
    )
  }, [])

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
      }

      return [...prev, newAthlete]
    })
  }, [])

  const assignSessionToTag = useCallback(
    (tag: string, session: ScheduleSessionInput, options?: ScheduleOptions) => {
      const normalizedTag = normalizeTag(tag)
      if (!normalizedTag) return

      setAthletes((prev) =>
        prev.map((athlete) => {
          if (!athlete.tags.includes(normalizedTag)) return athlete
          return applySessionToAthlete(athlete, session, options)
        })
      )
    },
    [applySessionToAthlete]
  )

  const updateHydrationLogs = useCallback(
    (athleteId: number, updater: (logs: HydrationLog[]) => HydrationLog[]) => {
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete
          const nextLogs = updater(athlete.hydrationLogs ?? [])
          return {
            ...athlete,
            hydrationLogs: nextLogs,
          }
        })
      )
    },
    []
  )

  const updateMealLogs = useCallback(
    (athleteId: number, updater: (logs: MealLog[]) => MealLog[]) => {
      setAthletes((prev) =>
        prev.map((athlete) => {
          if (athlete.id !== athleteId) return athlete
          const nextLogs = updater(athlete.mealLogs ?? [])
          return {
            ...athlete,
            mealLogs: nextLogs,
          }
        })
      )
    },
    []
  )

  const login = useCallback(
    ({ email, role: loginRole, name }: LoginInput) => {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) return

      if (loginRole === "athlete") {
        let selectedAthlete: Athlete | null = null
        setAthletes((prev) => {
          const existingIndex = prev.findIndex((athlete) => athlete.email.toLowerCase() === normalizedEmail)
          if (existingIndex !== -1) {
            const next = [...prev]
            const existing = next[existingIndex]
            const updatedAthlete = {
              ...existing,
              name: name?.trim() || existing.name,
            }
            next[existingIndex] = updatedAthlete
            selectedAthlete = updatedAthlete
            return next
          }

          const id = Date.now() + Math.floor(Math.random() * 1000)
          const inferredName = name?.trim() || normalizedEmail.split("@")[0]
          const newAthlete: Athlete = {
            id,
            name: inferredName,
            email: normalizedEmail,
            sport: "Unknown Sport",
            level: "Development",
            team: "Independent",
            tags: [],
            sessions: [],
            calendar: [],
            workouts: [],
            hydrationLogs: [],
            mealLogs: [],
          }
          selectedAthlete = newAthlete
          return [...prev, newAthlete]
        })
        setActiveAthleteId(selectedAthlete?.id ?? null)
        setCurrentUser({
          email: normalizedEmail,
          name: selectedAthlete?.name ?? name?.trim() ?? normalizedEmail,
          role: "athlete",
          athleteId: selectedAthlete?.id,
        })
        setRoleState("athlete")
        return
      }

      setCurrentUser({
        email: normalizedEmail,
        name: name?.trim() || normalizedEmail.split("@")[0],
        role: "coach",
      })
      setRoleState("coach")
    },
    []
  )

  const logout = useCallback(() => {
    setCurrentUser(null)
  }, [])

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
      currentUser,
      login,
      logout,
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
      currentUser,
      login,
      logout,
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
