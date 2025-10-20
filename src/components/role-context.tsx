"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import type {
  Athlete,
  HydrationLog,
  MealLog,
  Role,
  UserAccount,
  Session,
  WorkoutPlan
} from "@/lib/role-types"
export type { MealLog, NutritionFact } from "@/lib/role-types"
import { initialAthletes } from "@/lib/initial-data"
import type { CalendarEvent } from "@/lib/role-types"
import { normalizeAthletes, normalizeTag, normalizeTags } from "@/lib/state-normalizer"



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
  >
>

type LoginInput = {
  email: string
  role?: Role
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
  login: (input: LoginInput) => Promise<AuthResult>
  createAccount: (input: CreateAccountInput) => Promise<AuthResult>
  logout: () => void
  updateAthleteProfile: (athleteId: number, updates: UpdateAthleteInput) => void
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

const STORAGE_KEY = "locker-app-state-v1"
const SERVER_STATE_ENDPOINT = "/api/state"
const SESSION_ENDPOINT = "/api/auth/session"
const LOGIN_ENDPOINT = "/api/auth/login"
const SIGNUP_ENDPOINT = "/api/auth/signup"

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

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("athlete")
  const [athletes, setAthletes] = useState<Athlete[]>(initialAthletes)
  const [activeAthleteId, setActiveAthleteId] = useState<number | null>(
    initialAthletes[0]?.id ?? null
  )
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [serverHydrated, setServerHydrated] = useState(false)

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
        sessionToken?: string | null
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
      if (typeof parsed.sessionToken === "string") {
        setSessionToken(parsed.sessionToken)
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
      sessionToken,
    })
    window.localStorage.setItem(STORAGE_KEY, payload)
  }, [role, athletes, activeAthleteId, currentUser, sessionToken, isHydrated])

  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated || sessionToken) return
    let cancelled = false

    const fetchServerState = async () => {
      try {
        const response = await fetch(SERVER_STATE_ENDPOINT, { cache: "no-store" })
        if (!response.ok) return
        const payload = (await response.json()) as {
          athletes?: unknown
        }
        if (cancelled) return

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
      } finally {
        if (!cancelled) {
          setServerHydrated(true)
        }
      }
    }

    void fetchServerState()

    return () => {
      cancelled = true
    }
  }, [isHydrated, sessionToken])

  const setRole = useCallback((nextRole: Role) => {
    setRoleState(nextRole)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated || !serverHydrated) return
    const controller = new AbortController()

    const syncState = async () => {
      try {
        await fetch(SERVER_STATE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ athletes }),
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
  }, [athletes, isHydrated, serverHydrated])

  useEffect(() => {
    if (!isHydrated) return
    if (!sessionToken) {
      setServerHydrated(false)
      return
    }

    const controller = new AbortController()

    const revalidateSession = async () => {
      try {
        const response = await fetch(SESSION_ENDPOINT, {
          method: "GET",
          headers: { Authorization: `Bearer ${sessionToken}` },
          cache: "no-store",
          signal: controller.signal,
        })
        if (!response.ok) {
          setSessionToken(null)
          setCurrentUser(null)
          return
        }
        const payload = (await response.json()) as {
          user?: UserAccount
          athletes?: unknown
        }
        if (!payload.user) return

        const normalizedAthletes = normalizeAthletes(payload.athletes)
        setAthletes(normalizedAthletes)
        setCurrentUser(payload.user)
        setRoleState(payload.user.role)
        if (payload.user.role === "athlete" && payload.user.athleteId != null) {
          setActiveAthleteId(payload.user.athleteId)
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        console.error("Failed to revalidate session", error)
      } finally {
        setServerHydrated(true)
      }
    }

    void revalidateSession()

    return () => {
      controller.abort()
    }
  }, [isHydrated, sessionToken])

  const applyAuthenticatedSession = useCallback(
    ({ token, user, athletes: sessionAthletes }: { token: string; user: UserAccount; athletes: Athlete[] }) => {
      setSessionToken(token)
      setCurrentUser(user)
      setRoleState(user.role)
      const normalizedAthletes = normalizeAthletes(sessionAthletes)
      setAthletes(normalizedAthletes)
      if (user.role === "athlete" && user.athleteId != null) {
        setActiveAthleteId(user.athleteId)
      } else if (normalizedAthletes.length > 0) {
        setActiveAthleteId((prev) => prev ?? normalizedAthletes[0].id)
      }
      setServerHydrated(true)
    },
    []
  )

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

          updated = {
            ...athlete,
            ...updates,
            email: normalizedEmail,
            tags: normalizedTags,
            allergies: normalizedAllergies,
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
    async ({ email, role: loginRole, password }: LoginInput): Promise<AuthResult> => {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) {
        return { success: false, error: "Email is required to sign in." }
      }

      if (!password) {
        return { success: false, error: "Password is required." }
      }

      try {
        const body: Record<string, unknown> = {
          email: normalizedEmail,
          password,
        }

        if (loginRole) {
          body.role = loginRole
        }

        const response = await fetch(LOGIN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          let errorMessage = "Unable to sign in. Please check your credentials."
          try {
            const payload = (await response.json()) as { error?: string }
            if (payload?.error) {
              errorMessage = payload.error
            }
          } catch {
            // Ignore JSON parse errors
          }
          if (response.status === 401 || response.status === 404) {
            setSessionToken(null)
            setCurrentUser(null)
          }
          return { success: false, error: errorMessage }
        }

        const payload = (await response.json()) as {
          token: string
          user: UserAccount
          athletes: Athlete[]
        }

        applyAuthenticatedSession(payload)
        return { success: true }
      } catch (error) {
        console.error("Failed to sign in", error)
        return { success: false, error: "Unable to sign in. Please try again." }
      }
    },
    [applyAuthenticatedSession]
  )

  const createAccount = useCallback(
    async ({ email, role: accountRole, password, name }: CreateAccountInput): Promise<AuthResult> => {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) {
        return { success: false, error: "Email is required to create an account." }
      }
      if (!password) {
        return { success: false, error: "Password is required." }
      }
      if (password.length < 8) {
        return { success: false, error: "Password must be at least 8 characters long." }
      }

      try {
        const response = await fetch(SIGNUP_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            role: accountRole,
            name,
          }),
        })

        if (!response.ok) {
          let errorMessage = "Unable to create your account. Please try again."
          try {
            const payload = (await response.json()) as { error?: string }
            if (payload?.error) {
              errorMessage = payload.error
            }
          } catch {
            // Ignore parse errors
          }
          return { success: false, error: errorMessage }
        }

        const payload = (await response.json()) as {
          token: string
          user: UserAccount
          athletes: Athlete[]
        }

        applyAuthenticatedSession(payload)
        return { success: true }
      } catch (error) {
        console.error("Failed to create account", error)
        return { success: false, error: "Unable to create your account. Please try again." }
      }
    },
    [applyAuthenticatedSession]
  )


  const logout = useCallback(() => {
    setCurrentUser(null)
    setActiveAthleteId(null)
    setSessionToken(null)
    setServerHydrated(false)
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
