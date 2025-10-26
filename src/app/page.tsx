"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { NumberScale } from "@/components/number-scale"
import { useRole } from "@/components/role-context"
import { CoachDashboard } from "@/components/coach-dashboard"
import { ACADEMICS_UPDATED_EVENT, AcademicItem, mockAcademicItems } from "@/lib/academics"
import type { CheckInLog } from "@/lib/role-types"
import {
  BookOpen,
  Dumbbell,
  Apple,
  Calendar,
  Droplets,
  Target,
  CheckCircle2,
  ArrowRight,
  Zap,
  Award,
  ListChecks
} from "lucide-react"
import { cn } from "@/lib/utils"

type CheckInDiaryEntry = {
  id: number
  date: string
  createdAt: string
  mentalState: number
  physicalState: number
  mentalNotes: string
  physicalNotes: string
}

// Enhanced mock data with more sophisticated metrics
const mockData = {
  checkIn: {
    mental: null,
    physical: null,
    completed: false
  },
  todayStats: {
    hydration: 32,
    hydrationGoal: 80,
    mealsLogged: 2,
    sessionsCompleted: 1,
    academicItemsDue: 3,
    sleepHours: 7.5,
    stressLevel: 2,
    energyLevel: 4
  },
  upcomingItems: [
    { id: 1, type: "exam", title: "Calculus Midterm", course: "MATH 201", due: "Today 2:00 PM", priority: "high", progress: 85 },
    { id: 2, type: "assignment", title: "Physics Lab Report", course: "PHYS 101", due: "Tomorrow 11:59 PM", priority: "medium", progress: 60 },
    { id: 3, type: "reading", title: "Chapter 5: Biomechanics", course: "KIN 301", due: "Friday", priority: "low", progress: 30 }
  ],
  todaysSessions: [
    { id: 1, type: "practice", title: "Morning Practice", time: "6:00 AM - 8:00 AM", intensity: "high", completed: true, calories: 450, heartRate: 165 },
    { id: 2, type: "lift", title: "Strength Training", time: "4:00 PM - 5:30 PM", intensity: "medium", completed: false, calories: 320, heartRate: 140 }
  ],
  weeklyStats: {
    sessions: 8,
    prsSet: 2,
    hydrationAvg: 72,
    assignments: 5,
    totalCalories: 3200,
    avgHeartRate: 155,
    recoveryScore: 87
  }
}

const isSameDay = (value: string, reference: Date) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return (
    date.getDate() === reference.getDate() &&
    date.getMonth() === reference.getMonth() &&
    date.getFullYear() === reference.getFullYear()
  )
}

const formatSessionTimeRange = (startAt: string, endAt: string) => {
  if (!startAt || !endAt) return ""
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ""
  const format = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

  return `${format(start)} - ${format(end)}`
}

const formatDateLabel = (value: string) => {
  if (!value) return "TBD"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

const formatAcademicDueLabel = (value: string) => {
  if (!value) return "No due date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

  if (diffMs < 0) {
    const overdueDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24))
    if (overdueDays <= 1) {
      return "Overdue"
    }
    return `Overdue by ${overdueDays} days`
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return `Today ${timeLabel}`
  if (diffDays === 1) return `Tomorrow ${timeLabel}`
  if (diffDays < 7) {
    const weekday = date.toLocaleDateString("en-US", { weekday: "short" })
    return `${weekday} ${timeLabel}`
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const getAcademicPriorityLevel = (item: AcademicItem) => {
  const dueDate = item.dueAt ? new Date(item.dueAt) : null
  if (dueDate && !Number.isNaN(dueDate.getTime())) {
    const hoursUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilDue <= 24) return "high"
    if (hoursUntilDue <= 72) return "medium"
  }

  switch (item.type) {
    case "exam":
    case "essay":
      return "high"
    case "assignment":
      return "medium"
    default:
      return "low"
  }
}

const formatDiaryEntryDate = (value: string) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

const mapCheckInLogsToDiaryEntries = (logs: CheckInLog[]): CheckInDiaryEntry[] => {
  return [...logs]
    .map((log) => ({
      id: log.id,
      date: log.date,
      createdAt: log.createdAt,
      mentalState: log.mentalState,
      physicalState: log.physicalState,
      mentalNotes: log.mentalNotes ?? "",
      physicalNotes: log.physicalNotes ?? "",
    }))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}

export default function DashboardPage() {
  const [mentalState, setMentalState] = useState<number | null>(mockData.checkIn.mental)
  const [physicalState, setPhysicalState] = useState<number | null>(mockData.checkIn.physical)
  const [checkInCompleted, setCheckInCompleted] = useState(mockData.checkIn.completed)
  const [mentalNotes, setMentalNotes] = useState("")
  const [physicalNotes, setPhysicalNotes] = useState("")
  const { role, primaryAthlete, currentUser, updateCheckInLogs } = useRole()
  const academicStorageKey = useMemo(
    () => `locker-academics-${currentUser?.email ?? "guest"}`,
    [currentUser?.email]
  )
  const [guestAcademicItems, setGuestAcademicItems] = useState<AcademicItem[] | null>(null)
  const isGuest = !currentUser
  const checkInLogs = useMemo(
    () => primaryAthlete?.checkInLogs ?? [],
    [primaryAthlete?.checkInLogs]
  )
  const [diaryEntries, setDiaryEntries] = useState<CheckInDiaryEntry[]>(() =>
    mapCheckInLogsToDiaryEntries(checkInLogs)
  )

  useEffect(() => {
    setDiaryEntries(mapCheckInLogsToDiaryEntries(checkInLogs))
  }, [checkInLogs])

  useEffect(() => {
    if (isGuest) {
      setMentalState(mockData.checkIn.mental)
      setPhysicalState(mockData.checkIn.physical)
      setCheckInCompleted(mockData.checkIn.completed)
      setMentalNotes("")
      setPhysicalNotes("")
    } else {
      setCheckInCompleted(false)
    }
  }, [isGuest])
  const athleteSessions = primaryAthlete?.sessions ?? []

  useEffect(() => {
    if (typeof window === "undefined" || !isGuest) return

    const fallbackItems = mockAcademicItems

    const loadAcademicItems = () => {
      try {
        const stored = window.localStorage.getItem(academicStorageKey)
        if (!stored) {
          setGuestAcademicItems(fallbackItems)
          return
        }

        const parsed = JSON.parse(stored) as { academicItems?: AcademicItem[] }
        const items = Array.isArray(parsed.academicItems) ? parsed.academicItems : []
        setGuestAcademicItems(items)
      } catch (error) {
        console.error("Failed to load academics data", error)
        setGuestAcademicItems(fallbackItems)
      }
    }

    loadAcademicItems()

    const handleUpdate = () => {
      loadAcademicItems()
    }

    window.addEventListener(ACADEMICS_UPDATED_EVENT, handleUpdate)
    return () => {
      window.removeEventListener(ACADEMICS_UPDATED_EVENT, handleUpdate)
    }
  }, [academicStorageKey, isGuest])

  const academicItemsForDisplay = useMemo(() => {
    if (!isGuest) {
      return primaryAthlete?.academicItems ?? []
    }
    return guestAcademicItems ?? mockAcademicItems
  }, [isGuest, guestAcademicItems, primaryAthlete?.academicItems])

  const openAcademicItemsCount = useMemo(
    () => academicItemsForDisplay.filter((item) => !item.completed).length,
    [academicItemsForDisplay]
  )

  useEffect(() => {
    if (isGuest) return
    const todayKey = new Date().toISOString().slice(0, 10)
    const todaysEntry = diaryEntries.find((entry) => entry.date === todayKey)

    if (todaysEntry) {
      setMentalState(todaysEntry.mentalState)
      setPhysicalState(todaysEntry.physicalState)
      setMentalNotes(todaysEntry.mentalNotes)
      setPhysicalNotes(todaysEntry.physicalNotes)
      setCheckInCompleted(true)
    } else {
      setMentalState(null)
      setPhysicalState(null)
      setMentalNotes("")
      setPhysicalNotes("")
      setCheckInCompleted(false)
    }
  }, [diaryEntries, isGuest])

  const recentDiaryEntries = useMemo(() => diaryEntries.slice(0, 5), [diaryEntries])

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const todayDate = useMemo(() => new Date(startOfToday), [startOfToday])

  const todaysSessions = athleteSessions.filter((session) => isSameDay(session.startAt, todayDate))
  const sessionsCompletedToday = todaysSessions.filter((session) => session.completed).length

  const workoutAssignments = useMemo(() => {
    const workouts = primaryAthlete?.workouts ?? []
    return workouts.slice(0, 5)
  }, [primaryAthlete])

  const hydrationStats = useMemo(() => {
    if (!primaryAthlete) {
      const progress =
        (mockData.todayStats.hydration / mockData.todayStats.hydrationGoal) * 100
      return {
        total: mockData.todayStats.hydration,
        goal: mockData.todayStats.hydrationGoal,
        progress,
      }
    }

    const hydrationGoal = 80
    const hydrationLogs = primaryAthlete.hydrationLogs ?? []
    const todaysHydration = hydrationLogs
      .filter((log) => isSameDay(log.date, todayDate))
      .reduce((sum, log) => sum + (log.ounces ?? 0), 0)

    return {
      total: todaysHydration,
      goal: hydrationGoal,
      progress: hydrationGoal ? Math.min(100, (todaysHydration / hydrationGoal) * 100) : 0,
    }
  }, [primaryAthlete, todayDate])

  const todayStats = useMemo(() => {
    if (!primaryAthlete) {
      return {
        ...mockData.todayStats,
        academicItemsDue: openAcademicItemsCount,
      }
    }

    const mealsLoggedToday = (primaryAthlete.mealLogs ?? []).filter((log) =>
      isSameDay(log.dateTime, todayDate)
    ).length

    return {
      hydration: hydrationStats.total,
      hydrationGoal: hydrationStats.goal,
      mealsLogged: mealsLoggedToday,
      sessionsCompleted: sessionsCompletedToday,
      academicItemsDue: openAcademicItemsCount,
      sleepHours: null,
      stressLevel: null,
      energyLevel: null,
    }
  }, [
    primaryAthlete,
    hydrationStats,
    sessionsCompletedToday,
    todayDate,
    openAcademicItemsCount,
  ])

  const upcomingItems = useMemo(() => {
    if (academicItemsForDisplay.length === 0) return []

    return academicItemsForDisplay
      .filter((item) => !item.completed)
      .sort((a, b) => {
        const aTime = new Date(a.dueAt ?? "").getTime()
        const bTime = new Date(b.dueAt ?? "").getTime()
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
        if (Number.isNaN(aTime)) return 1
        if (Number.isNaN(bTime)) return -1
        return aTime - bTime
      })
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        course: item.course,
        due: formatAcademicDueLabel(item.dueAt),
        priority: getAcademicPriorityLevel(item),
        progress: item.completed ? 100 : 0,
      }))
  }, [academicItemsForDisplay])

  const weeklyStatsData = useMemo(() => {
    if (!primaryAthlete) return mockData.weeklyStats
    const now = new Date()
    const startWindow = new Date(now)
    startWindow.setDate(now.getDate() - 6)
    startWindow.setHours(0, 0, 0, 0)

    const sessions = primaryAthlete.sessions ?? []
    const sessionsInWindow = sessions.filter((session) => {
      const start = new Date(session.startAt)
      if (Number.isNaN(start.getTime())) return false
      return start >= startWindow && start <= now
    })

    const workouts = primaryAthlete.workouts ?? []
    const prsSet = workouts.filter((workout) => {
      if (workout.status !== "Completed") return false
      const dueDate = new Date(workout.dueDate)
      if (Number.isNaN(dueDate.getTime())) return false
      return dueDate >= startWindow && dueDate <= now
    }).length

    const hydrationLogs = primaryAthlete.hydrationLogs ?? []
    const hydrationTotals = new Map<string, number>()
    hydrationLogs.forEach((log) => {
      const date = new Date(log.date)
      if (Number.isNaN(date.getTime())) return
      const key = date.toISOString().split("T")[0]
      hydrationTotals.set(key, (hydrationTotals.get(key) ?? 0) + (log.ounces ?? 0))
    })

    let hydrationSum = 0
    let hydrationCount = 0
    hydrationTotals.forEach((value, key) => {
      const date = new Date(key)
      if (date >= startWindow && date <= now) {
        hydrationSum += value
        hydrationCount += 1
      }
    })

    const hydrationAvg = hydrationCount > 0 ? Math.round(hydrationSum / hydrationCount) : 0

    const mealLogs = primaryAthlete.mealLogs ?? []
    const totalCalories = mealLogs
      .filter((meal) => {
        const date = new Date(meal.dateTime)
        if (Number.isNaN(date.getTime())) return false
        return date >= startWindow && date <= now
      })
      .reduce((sum, meal) => sum + (meal.calories ?? 0), 0)

    const completedSessions = sessions.filter((session) => session.completed).length
    const recoveryScore = sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0

    return {
      sessions: sessionsInWindow.length,
      prsSet,
      hydrationAvg,
      assignments: 0,
      totalCalories,
      avgHeartRate: 0,
      recoveryScore,
    }
  }, [primaryAthlete])

  const handleCheckIn = () => {
    if (mentalState === null || physicalState === null) {
      return
    }

    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)
    const trimmedMentalNotes = mentalNotes.trim()
    const trimmedPhysicalNotes = physicalNotes.trim()
    const existingEntry = diaryEntries.find((entry) => entry.date === todayKey)
    const existingLog = checkInLogs.find((log) => log.date === todayKey)

    const baseForId = checkInLogs.length > 0 ? checkInLogs : diaryEntries
    const maxId = baseForId.reduce<number>((max, item) => Math.max(max, item.id), 0)
    const nextId = existingEntry?.id ?? existingLog?.id ?? maxId + 1
    const createdAt = existingEntry?.createdAt ?? existingLog?.createdAt ?? now.toISOString()

    const updatedEntry: CheckInDiaryEntry = {
      id: nextId,
      date: todayKey,
      createdAt,
      mentalState,
      physicalState,
      mentalNotes: trimmedMentalNotes,
      physicalNotes: trimmedPhysicalNotes,
    }

    const applyDiaryUpdate = (entries: CheckInDiaryEntry[]) => {
      const filtered = entries.filter(
        (entry) => entry.id !== updatedEntry.id && entry.date !== updatedEntry.date
      )
      const updated = [updatedEntry, ...filtered]
      updated.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      return updated
    }

    if (!primaryAthlete) return

    setDiaryEntries((prev) => applyDiaryUpdate(prev))
    updateCheckInLogs(primaryAthlete.id, (prevLogs) => {
      const filtered = prevLogs.filter(
        (log) => log.id !== updatedEntry.id && log.date !== updatedEntry.date
      )
      const nextLog: CheckInLog = {
        id: updatedEntry.id,
        date: updatedEntry.date,
        createdAt: updatedEntry.createdAt,
        mentalState: updatedEntry.mentalState,
        physicalState: updatedEntry.physicalState,
        ...(trimmedMentalNotes ? { mentalNotes: trimmedMentalNotes } : {}),
        ...(trimmedPhysicalNotes ? { physicalNotes: trimmedPhysicalNotes } : {}),
      }
      const updated = [...filtered, nextLog]
      updated.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      return updated
    })

    setCheckInCompleted(true)
  }

  if (role === "coach") {
    return <CoachDashboard />
  }

  if (!primaryAthlete) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Sign in to see your daily readiness insights.</p>
      </div>
    )
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return (
          <Badge className="bg-gradient-to-r from-[#0f4d92] to-[#123d73] text-white border-0 px-3 py-1">
            High
          </Badge>
        )
      case "medium":
        return (
          <Badge className="bg-gradient-to-r from-[#1c6dd0] to-[#2f7bdc] text-white border-0 px-3 py-1">
            Medium
          </Badge>
        )
      case "low":
        return (
          <Badge className="bg-gradient-to-r from-[#87a8d0] to-[#c7dbf3] text-[#0f2f5b] border-0 px-3 py-1">
            Low
          </Badge>
        )
      default:
        return <Badge variant="secondary">{priority}</Badge>
    }
  }

  const getSessionIntensityBadge = (intensity: string) => {
    switch (intensity) {
      case "high":
        return (
          <Badge className="bg-gradient-to-r from-[#0f4d92] to-[#123d73] text-white border-0 px-3 py-1">
            High
          </Badge>
        )
      case "medium":
        return (
          <Badge className="bg-gradient-to-r from-[#1c6dd0] to-[#2f7bdc] text-white border-0 px-3 py-1">
            Medium
          </Badge>
        )
      case "low":
        return (
          <Badge className="bg-gradient-to-r from-[#87a8d0] to-[#c7dbf3] text-[#0f2f5b] border-0 px-3 py-1">
            Low
          </Badge>
        )
      default:
        return <Badge variant="secondary">{intensity}</Badge>
    }
  }

  const hydrationProgress = hydrationStats.progress

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {/* Daily Check-in Card */}
        <Card className="mb-10 sm:mb-12 glass-card border-0 shadow-premium-lg">
          <CardHeader className="pb-5 sm:pb-6">
            <CardTitle className="flex items-center gap-3 sm:gap-4 text-2xl text-gray-900">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
                <Target className="h-7 w-7 text-white" />
              </div>
              Daily Check-in
              {checkInCompleted && (
                <Badge className="bg-gradient-to-r from-[#0f4d92] to-[#123d73] text-white border-0 px-4 py-2">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completed
                </Badge>
              )}
            </CardTitle>
            <p className="text-gray-600 text-lg">How are you feeling today? Rate your mental and physical state.</p>
          </CardHeader>
          <CardContent className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <NumberScale
                label="Mental State"
                value={mentalState}
                onChange={setMentalState}
              />
              <NumberScale
                label="Physical State"
                value={physicalState}
                onChange={setPhysicalState}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-600">Mental Notes</p>
                  <span className="text-xs text-gray-400">Optional</span>
                </div>
                <textarea
                  value={mentalNotes}
                  onChange={(event) => setMentalNotes(event.target.value)}
                  placeholder="Celebrate wins, note stressors, or reflect on your mindset."
                  className="w-full min-h-[120px] rounded-2xl border border-white/30 bg-white/60 px-3 py-2.5 text-sm text-gray-700 shadow-inner backdrop-blur-sm transition focus:border-[#1c6dd0] focus:outline-none focus:ring-2 focus:ring-[#1c6dd0]/50 sm:px-4 sm:py-3"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-600">Physical Notes</p>
                  <span className="text-xs text-gray-400">Optional</span>
                </div>
                <textarea
                  value={physicalNotes}
                  onChange={(event) => setPhysicalNotes(event.target.value)}
                  placeholder="Log soreness, recovery cues, or anything your body is telling you."
                  className="w-full min-h-[120px] rounded-2xl border border-white/30 bg-white/60 px-3 py-2.5 text-sm text-gray-700 shadow-inner backdrop-blur-sm transition focus:border-[#1c6dd0] focus:outline-none focus:ring-2 focus:ring-[#1c6dd0]/50 sm:px-4 sm:py-3"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Entries are saved to this device each time you complete your check-in.
            </p>
            <Button
              onClick={handleCheckIn}
              disabled={mentalState === null || physicalState === null}
              className="w-full h-12 text-base font-bold gradient-primary hover:shadow-glow text-white border-0 rounded-2xl transition-all duration-300 hover:scale-105 sm:h-14 sm:text-lg"
            >
              {checkInCompleted ? (
                <>
                  <CheckCircle2 className="h-6 w-6 mr-3" />
                  Update Check-in
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-6 w-6 mr-3" />
                  Complete Check-in
                </>
              )}
            </Button>
            {recentDiaryEntries.length > 0 && (
              <div className="pt-6 border-t border-white/40">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  Recent check-in notes
                </h4>
                <div className="space-y-3 sm:space-y-4 max-h-64 overflow-y-auto pr-1">
                  {recentDiaryEntries.map((entry) => (
                    <div
                      key={entry.createdAt}
                      className="glass-card border border-white/30 rounded-2xl p-3 sm:p-4 space-y-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">
                          {formatDiaryEntryDate(entry.date)}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-[#1c6dd0] font-semibold">
                          🧠 {entry.mentalState} · 💪 {entry.physicalState}
                        </span>
                      </div>
                      {entry.mentalNotes && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Mental
                          </p>
                          <p className="text-sm text-gray-700 whitespace-pre-line">
                            {entry.mentalNotes}
                          </p>
                        </div>
                      )}
                      {entry.physicalNotes && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Physical
                          </p>
                          <p className="text-sm text-gray-700 whitespace-pre-line">
                            {entry.physicalNotes}
                          </p>
                        </div>
                      )}
                      {!entry.mentalNotes && !entry.physicalNotes && (
                        <p className="text-xs text-gray-500">
                          No diary notes added for this check-in.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Progress & Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 mb-10 sm:mb-12">
          <div className="space-y-4 sm:space-y-5">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Zap className="h-6 w-6 text-[#0f4d92]" />
              Today&apos;s Progress
            </h3>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-1">
              <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300">
                <CardContent className="p-3 sm:p-5">
                  <div className="flex flex-col items-center text-center gap-3 md:flex-row md:items-center md:justify-between md:text-left">
                    <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:text-left sm:gap-3">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl gradient-success flex items-center justify-center shadow-glow">
                        <Droplets className="h-6 w-6 text-white sm:h-7 sm:w-7" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 sm:text-sm">Hydration</p>
                        <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{hydrationStats.total}oz</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 w-full md:w-auto md:items-end md:text-right">
                      <p className="text-xs font-semibold text-gray-600 sm:text-sm">{hydrationProgress.toFixed(0)}%</p>
                      <Progress value={hydrationProgress} className="w-full max-w-[120px] h-2 rounded-full md:w-20 md:max-w-none" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300">
                <CardContent className="p-3 sm:p-5">
                  <div className="flex flex-col items-center text-center gap-2 sm:gap-3 sm:flex-row sm:text-left sm:items-center">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl gradient-warning flex items-center justify-center shadow-glow">
                      <Apple className="h-6 w-6 text-white sm:h-7 sm:w-7" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 sm:text-sm">Meals Logged</p>
                      <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{todayStats.mealsLogged}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300">
                <CardContent className="p-3 sm:p-5">
                  <div className="flex flex-col items-center text-center gap-2 sm:gap-3 sm:flex-row sm:text-left sm:items-center">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl gradient-danger flex items-center justify-center shadow-glow">
                      <Dumbbell className="h-6 w-6 text-white sm:h-7 sm:w-7" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 sm:text-sm">Sessions Completed</p>
                      <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{sessionsCompletedToday}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-5 sm:space-y-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-[#0f4d92]" />
              Upcoming
            </h3>

            <Card className="glass-card border-0 shadow-premium">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-xl text-gray-900 flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-[#0f4d92]" />
                  Academics Due
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {upcomingItems.length > 0 ? (
                  upcomingItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 p-3 sm:p-5 rounded-2xl glass-card border border-white/20 hover:bg-white/50 transition-all duration-300 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl gradient-primary flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm sm:text-base">{item.title}</p>
                          <p className="text-xs text-gray-600 sm:text-sm">{item.course}</p>
                          <Progress value={item.progress} className="w-full max-w-[160px] h-2 mt-2 rounded-full" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-auto">
                        {getPriorityBadge(item.priority)}
                        <span className="text-xs text-gray-500 font-medium sm:text-sm">{item.due}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 sm:p-6 text-center rounded-2xl border border-dashed border-gray-300 bg-white/60 text-sm text-gray-500">
                    You&apos;re all caught up on academic work.
                  </div>
                )}
                <Button variant="outline" className="w-full glass-card border-white/20 hover:bg-white/50">
                  View All ({openAcademicItemsCount})
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-premium">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-xl text-gray-900 flex items-center gap-3">
                  <Dumbbell className="h-6 w-6 text-[#0f4d92]" />
                  Today&apos;s Training
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {todaysSessions.length > 0 ? (
                  todaysSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex flex-col gap-3 p-3 sm:p-5 rounded-2xl glass-card border border-white/20 hover:bg-white/50 transition-all duration-300 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div
                          className={cn(
                            "w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center",
                            session.completed ? "gradient-success" : "bg-gray-100"
                          )}
                        >
                          <Dumbbell
                            className={cn(
                              "h-5 w-5 sm:h-6 sm:w-6",
                              session.completed ? "text-white" : "text-gray-400"
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900 text-sm sm:text-base">{session.title}</p>
                          <p className="text-xs text-gray-600 sm:text-sm">{formatSessionTimeRange(session.startAt, session.endAt)}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-gray-500 sm:text-xs">
                            {session.focus && <span>{session.focus}</span>}
                            {session.assignedBy && <span>By {session.assignedBy}</span>}
                          </div>
                        </div>
                      </div>
                      {getSessionIntensityBadge(session.intensity)}
                    </div>
                  ))
                ) : (
                  <div className="p-4 sm:p-6 text-center rounded-2xl border border-dashed border-gray-300 bg-white/60 text-sm text-gray-500">
                    No training sessions scheduled for today yet.
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-xl text-gray-900 flex items-center gap-3">
                  <ListChecks className="h-6 w-6 text-[#0f4d92]" />
                  Workout Assignments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {workoutAssignments.length > 0 ? (
                  workoutAssignments.map((workout) => (
                    <div
                      key={workout.id}
                      className="flex flex-col gap-3 p-3 sm:p-5 rounded-2xl glass-card border border-white/20 hover:bg-white/50 transition-all duration-300 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="font-bold text-gray-900 text-sm sm:text-base">{workout.title}</p>
                        <p className="text-xs text-gray-600 sm:text-sm">
                          Due {formatDateLabel(workout.dueDate)} • {workout.focus}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Assigned by {workout.assignedBy ?? "staff"}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "capitalize border-0 px-3 py-1 text-xs sm:text-sm",
                          workout.status === "Completed"
                            ? "bg-gradient-to-r from-[#0f4d92] to-[#123d73] text-white"
                            : "bg-[#e2ebf9] text-[#0f2f5b]"
                        )}
                      >
                        {workout.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-4 sm:p-6 text-center rounded-2xl border border-dashed border-gray-300 bg-white/60 text-sm text-gray-500">
                    No workouts assigned yet. Your coach will add them here.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* This Week Stats */}
        <div className="mb-10 sm:mb-12">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              This Week
            </h3>
            <Button variant="outline" className="glass-card border-white/20 hover:bg-white/50">
              View details <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-3 sm:p-5 text-center flex flex-col items-center justify-center gap-2 sm:gap-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
                  <Dumbbell className="h-7 w-7 text-white sm:h-8 sm:w-8" />
                </div>
                <p className="text-xs font-semibold text-gray-600 sm:text-sm">Sessions</p>
                <p className="text-3xl font-bold text-gray-900 sm:text-4xl">{weeklyStatsData.sessions}</p>
                <p className="text-[10px] text-[#1c6dd0] font-semibold sm:text-xs">+2 from last week</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-3 sm:p-5 text-center flex flex-col items-center justify-center gap-2 sm:gap-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl gradient-warning flex items-center justify-center shadow-glow">
                  <Award className="h-7 w-7 text-white sm:h-8 sm:w-8" />
                </div>
                <p className="text-xs font-semibold text-gray-600 sm:text-sm">PRs Set</p>
                <p className="text-3xl font-bold text-gray-900 sm:text-4xl">{weeklyStatsData.prsSet}</p>
                <p className="text-[10px] text-[#1c6dd0] font-semibold sm:text-xs">New records!</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-3 sm:p-5 text-center flex flex-col items-center justify-center gap-2 sm:gap-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl gradient-success flex items-center justify-center shadow-glow">
                  <Droplets className="h-7 w-7 text-white sm:h-8 sm:w-8" />
                </div>
                <p className="text-xs font-semibold text-gray-600 sm:text-sm">Hydration Avg</p>
                <p className="text-3xl font-bold text-gray-900 sm:text-4xl">{weeklyStatsData.hydrationAvg}%</p>
                <p className="text-[10px] text-[#1c6dd0] font-semibold sm:text-xs">Good consistency</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-3 sm:p-5 text-center flex flex-col items-center justify-center gap-2 sm:gap-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl gradient-secondary flex items-center justify-center shadow-glow">
                  <BookOpen className="h-7 w-7 text-white sm:h-8 sm:w-8" />
                </div>
                <p className="text-xs font-semibold text-gray-600 sm:text-sm">Assignments</p>
                <p className="text-3xl font-bold text-gray-900 sm:text-4xl">{weeklyStatsData.assignments}</p>
                <p className="text-[10px] text-[#1c6dd0] font-semibold sm:text-xs">5 completed</p>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  )
}