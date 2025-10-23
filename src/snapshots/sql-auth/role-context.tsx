"use client"

// Snapshot of the pre-SQL auth RoleProvider implementation.
// Copied from src/components/role-context.tsx before the SQL auth migration.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import type {
  Athlete,
  HydrationLog,
  MealLog,
  Role,
  StoredAccount,
  UserAccount,
  Session,
  WorkoutPlan
} from "@/lib/role-types"
export type { MealLog, NutritionFact } from "@/lib/role-types"
import { initialAthletes } from "@/lib/initial-data"
import type { CalendarEvent } from "@/lib/role-types"
import {
  normalizeAccounts,
  normalizeAthletes,
  normalizeTag,
  normalizeTags,
} from "@/lib/state-normalizer"



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
  login: (input: LoginInput) => AuthResult
  createAccount: (input: CreateAccountInput) => AuthResult
  logout: () => void
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
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) return
    const payload = JSON.stringify({
      role,
      athletes,
      activeAthleteId,
      currentUser,
      accounts,
    })
    window.localStorage.setItem(STORAGE_KEY, payload)
  }, [role, athletes, activeAthleteId, currentUser, accounts, isHydrated])

  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) return
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
  }, [isHydrated])

  const setRole = useCallback((nextRole: Role) => {
    setRoleState(nextRole)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) return
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
  }, [accounts, athletes, isHydrated])

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
      updateAthleteProfile,
      currentUser,
      login,
      createAccount,
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
      updateAthleteProfile,
      currentUser,
      login,
      createAccount,
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
