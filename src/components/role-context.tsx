"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

type Role = "athlete" | "coach"

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

type Athlete = {
  id: number
  name: string
  sport: string
  level: string
  team: string
  sessions: Session[]
  calendar: CalendarEvent[]
  workouts: WorkoutPlan[]
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

type RoleContextValue = {
  role: Role
  setRole: (role: Role) => void
  athletes: Athlete[]
  scheduleSession: (athleteId: number, session: ScheduleSessionInput, options?: ScheduleOptions) => void
  toggleSessionCompletion: (athleteId: number, sessionId: number) => void
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

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

const initialAthletes: Athlete[] = [
  {
    id: 1,
    name: "Alex Johnson",
    sport: "Track & Field",
    level: "Elite",
    team: "Sprints",
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
  },
]

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("athlete")
  const [athletes, setAthletes] = useState(initialAthletes)

  const scheduleSession = useCallback(
    (athleteId: number, session: ScheduleSessionInput, options?: ScheduleOptions) => {
      setAthletes((prev) =>
        prev.map((athlete): Athlete => {
          if (athlete.id !== athleteId) return athlete

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
            status: "Scheduled", // direct literal, matches union
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
        })
      )
    },
    [role]
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
                  : "Scheduled") as WorkoutPlan["status"], // 👈 cast to union
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

  const value = useMemo(
    () => ({ role, setRole, athletes, scheduleSession, toggleSessionCompletion }),
    [role, athletes, scheduleSession, toggleSessionCompletion]
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
