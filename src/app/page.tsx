"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { NumberScale } from "@/components/number-scale"
import { useRole } from "@/components/role-context"
import { CoachDashboard } from "@/components/coach-dashboard"
import {
  BookOpen,
  Dumbbell,
  Apple,
  Calendar,
  Droplets,
  Target,
  CheckCircle2,
  ArrowRight,
  Plus,
  Zap,
  Award,
  Sparkles,
  ListChecks
} from "lucide-react"
import { cn } from "@/lib/utils"

type CheckInDiaryEntry = {
  date: string
  createdAt: string
  mentalState: number
  physicalState: number
  mentalNotes: string
  physicalNotes: string
}

const diaryStorageKey = "locker.checkInDiary"

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

const isDiaryEntry = (value: unknown): value is CheckInDiaryEntry => {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<CheckInDiaryEntry>
  return (
    typeof entry.date === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.mentalState === "number" &&
    typeof entry.physicalState === "number" &&
    typeof entry.mentalNotes === "string" &&
    typeof entry.physicalNotes === "string"
  )
}

export default function DashboardPage() {
  const [mentalState, setMentalState] = useState<number | null>(mockData.checkIn.mental)
  const [physicalState, setPhysicalState] = useState<number | null>(mockData.checkIn.physical)
  const [checkInCompleted, setCheckInCompleted] = useState(mockData.checkIn.completed)
  const [mentalNotes, setMentalNotes] = useState("")
  const [physicalNotes, setPhysicalNotes] = useState("")
  const [diaryEntries, setDiaryEntries] = useState<CheckInDiaryEntry[]>([])
  const { role, primaryAthlete, currentUser } = useRole()
  const isGuest = !currentUser

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
    if (typeof window === "undefined" || isGuest) return
    const stored = window.localStorage.getItem(diaryStorageKey)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      const entries = (Array.isArray(parsed) ? parsed : []).filter(isDiaryEntry)
      entries.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setDiaryEntries(entries)
    } catch (error) {
      console.error("Failed to load diary entries", error)
    }
  }, [isGuest])

  useEffect(() => {
    if (typeof window === "undefined" || isGuest) return
    window.localStorage.setItem(diaryStorageKey, JSON.stringify(diaryEntries))
  }, [diaryEntries, isGuest])

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

  const upcomingCalendar = useMemo(() => {
    const calendar = primaryAthlete?.calendar ?? []
    return calendar
      .filter((event) => {
        const eventDate = new Date(event.date)
        if (Number.isNaN(eventDate.getTime())) return true
        return eventDate.getTime() >= startOfToday
      })
      .slice(0, 5)
  }, [primaryAthlete, startOfToday])

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
    if (!primaryAthlete) return mockData.todayStats
    const mealsLoggedToday = (primaryAthlete.mealLogs ?? []).filter((log) =>
      isSameDay(log.dateTime, todayDate)
    ).length

    return {
      hydration: hydrationStats.total,
      hydrationGoal: hydrationStats.goal,
      mealsLogged: mealsLoggedToday,
      sessionsCompleted: sessionsCompletedToday,
      academicItemsDue: 0,
      sleepHours: null,
      stressLevel: null,
      energyLevel: null,
    }
  }, [primaryAthlete, hydrationStats, sessionsCompletedToday, todayDate])

  const upcomingItems = useMemo(() => {
    if (!primaryAthlete) return mockData.upcomingItems
    const workouts = (primaryAthlete.workouts ?? []).map((workout) => {
      const dueLabel = workout.dueDate ? formatDateLabel(workout.dueDate) : "Scheduled"
      const priority = (workout.intensity ?? "medium").toLowerCase()
      return {
        id: workout.id,
        type: "training",
        title: workout.title,
        course: workout.focus ?? workout.title,
        due: dueLabel,
        priority,
        progress: workout.status === "Completed" ? 100 : 0,
      }
    })
    return workouts.slice(0, 4)
  }, [primaryAthlete])

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
    const newEntry: CheckInDiaryEntry = {
      date: todayKey,
      createdAt: now.toISOString(),
      mentalState,
      physicalState,
      mentalNotes: mentalNotes.trim(),
      physicalNotes: physicalNotes.trim(),
    }

    setDiaryEntries((prev) => {
      const filtered = prev.filter((entry) => entry.date !== todayKey)
      const updated = [newEntry, ...filtered]
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f4d92]/25 via-[#1c6dd0]/20 to-[#acc4e6]/25 rounded-3xl blur-3xl"></div>
            <div className="relative glass-card rounded-3xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0f172a] via-[#0f4d92] to-[#12284b] bg-clip-text text-transparent mb-2">
                    Good morning, Alex! 👋
                  </h1>
                  <p className="text-xl text-gray-600 font-medium">Ready to tackle another day?</p>
                </div>
                <div className="hidden md:block">
                  <div className="w-32 h-32 rounded-full gradient-hero flex items-center justify-center animate-float">
                    <Sparkles className="h-16 w-16 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Check-in Card */}
        <Card className="mb-12 glass-card border-0 shadow-premium-lg">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-4 text-2xl text-gray-900">
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
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-600">Mental Notes</p>
                  <span className="text-xs text-gray-400">Optional</span>
                </div>
                <textarea
                  value={mentalNotes}
                  onChange={(event) => setMentalNotes(event.target.value)}
                  placeholder="Celebrate wins, note stressors, or reflect on your mindset."
                  className="w-full min-h-[120px] rounded-2xl border border-white/30 bg-white/60 px-4 py-3 text-sm text-gray-700 shadow-inner backdrop-blur-sm transition focus:border-[#1c6dd0] focus:outline-none focus:ring-2 focus:ring-[#1c6dd0]/50"
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
                  className="w-full min-h-[120px] rounded-2xl border border-white/30 bg-white/60 px-4 py-3 text-sm text-gray-700 shadow-inner backdrop-blur-sm transition focus:border-[#1c6dd0] focus:outline-none focus:ring-2 focus:ring-[#1c6dd0]/50"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Entries are saved to this device each time you complete your check-in.
            </p>
            <Button
              onClick={handleCheckIn}
              disabled={mentalState === null || physicalState === null}
              className="w-full h-14 text-lg font-bold gradient-primary hover:shadow-glow text-white border-0 rounded-2xl transition-all duration-300 hover:scale-105"
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
                <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                  {recentDiaryEntries.map((entry) => (
                    <div
                      key={entry.createdAt}
                      className="glass-card border border-white/30 rounded-2xl p-4 space-y-3 shadow-sm"
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Zap className="h-6 w-6 text-[#0f4d92]" />
              Today&apos;s Progress
            </h3>
            
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl gradient-success flex items-center justify-center shadow-glow">
                      <Droplets className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Hydration</p>
                    <p className="text-3xl font-bold text-gray-900">{hydrationStats.total}oz</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-600">{hydrationProgress.toFixed(0)}%</p>
                    <Progress value={hydrationProgress} className="w-20 h-3" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl gradient-warning flex items-center justify-center shadow-glow">
                    <Apple className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Meals Logged</p>
                    <p className="text-3xl font-bold text-gray-900">{todayStats.mealsLogged}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl gradient-danger flex items-center justify-center shadow-glow">
                    <Dumbbell className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Sessions Completed</p>
                    <p className="text-3xl font-bold text-gray-900">{sessionsCompletedToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-[#0f4d92]" />
              Upcoming
            </h3>
            
            <Card className="glass-card border-0 shadow-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-gray-900 flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-[#0f4d92]" />
                  Academics Due
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-5 rounded-2xl glass-card border border-white/20 hover:bg-white/50 transition-all duration-300">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-600">{item.course}</p>
                        <Progress value={item.progress} className="w-32 h-2 mt-2" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getPriorityBadge(item.priority)}
                      <span className="text-sm text-gray-500 font-medium">{item.due}</span>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full glass-card border-white/20 hover:bg-white/50">
                  View All ({todayStats.academicItemsDue})
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-gray-900 flex items-center gap-3">
                  <Dumbbell className="h-6 w-6 text-[#0f4d92]" />
                  Today&apos;s Training
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {todaysSessions.length > 0 ? (
                  todaysSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-5 rounded-2xl glass-card border border-white/20 hover:bg-white/50 transition-all duration-300"
                    >
                      <div className="flex items-center space-x-4">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            session.completed ? "gradient-success" : "bg-gray-100"
                          )}
                        >
                          <Dumbbell
                            className={cn(
                              "h-6 w-6",
                              session.completed ? "text-white" : "text-gray-400"
                            )}
                          />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{session.title}</p>
                          <p className="text-sm text-gray-600">{formatSessionTimeRange(session.startAt, session.endAt)}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500">
                            {session.focus && <span>{session.focus}</span>}
                            {session.assignedBy && <span>By {session.assignedBy}</span>}
                          </div>
                        </div>
                      </div>
                      {getSessionIntensityBadge(session.intensity)}
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-gray-300 bg-white/60 text-sm text-gray-500">
                    No training sessions scheduled for today yet.
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-gray-900 flex items-center gap-3">
                  <Calendar className="h-6 w-6 text-[#0f4d92]" />
                  Personal Calendar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingCalendar.length > 0 ? (
                  upcomingCalendar.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-5 rounded-2xl glass-card border border-white/20 hover:bg-white/50 transition-all duration-300"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{event.title}</p>
                        <p className="text-sm text-gray-600">
                          {formatDateLabel(event.date)} • {event.timeRange}
                        </p>
                        {event.focus && <p className="text-xs text-gray-500 mt-1">{event.focus}</p>}
                      </div>
                      <Badge className="capitalize bg-[#e8f0fb] text-[#123a70] border border-[#c7d7ee]">{event.type}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-gray-300 bg-white/60 text-sm text-gray-500">
                    No upcoming events on the calendar.
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-gray-900 flex items-center gap-3">
                  <ListChecks className="h-6 w-6 text-[#0f4d92]" />
                  Workout Assignments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {workoutAssignments.length > 0 ? (
                  workoutAssignments.map((workout) => (
                    <div
                      key={workout.id}
                      className="flex items-center justify-between p-5 rounded-2xl glass-card border border-white/20 hover:bg-white/50 transition-all duration-300"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{workout.title}</p>
                        <p className="text-sm text-gray-600">
                          Due {formatDateLabel(workout.dueDate)} • {workout.focus}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Assigned by {workout.assignedBy ?? "staff"}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "capitalize border-0 px-4 py-1",
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
                  <div className="p-6 text-center rounded-2xl border border-dashed border-gray-300 bg-white/60 text-sm text-gray-500">
                    No workouts assigned yet. Your coach will add them here.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* This Week Stats */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              This Week
            </h3>
            <Button variant="outline" className="glass-card border-white/20 hover:bg-white/50">
              View details <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <Dumbbell className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Sessions</p>
                <p className="text-4xl font-bold text-gray-900 mb-2">{weeklyStatsData.sessions}</p>
                <p className="text-xs text-[#1c6dd0] font-semibold">+2 from last week</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-warning flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <Award className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">PRs Set</p>
                <p className="text-4xl font-bold text-gray-900 mb-2">{weeklyStatsData.prsSet}</p>
                <p className="text-xs text-[#1c6dd0] font-semibold">New records!</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-success flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <Droplets className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Hydration Avg</p>
                <p className="text-4xl font-bold text-gray-900 mb-2">{weeklyStatsData.hydrationAvg}%</p>
                <p className="text-xs text-[#1c6dd0] font-semibold">Good consistency</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-secondary flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <BookOpen className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Assignments</p>
                <p className="text-4xl font-bold text-gray-900 mb-2">{weeklyStatsData.assignments}</p>
                <p className="text-xs text-[#1c6dd0] font-semibold">5 completed</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hydration Progress Card */}
        <Card className="glass-card border-0 shadow-premium-lg">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-4 text-2xl text-gray-900">
              <div className="w-12 h-12 rounded-2xl gradient-success flex items-center justify-center shadow-glow">
                <Droplets className="h-7 w-7 text-white" />
              </div>
              Hydration Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="flex justify-between text-lg">
                <span className="font-bold text-gray-900">{hydrationStats.total}oz consumed</span>
                <span className="text-gray-600">{hydrationStats.goal}oz goal</span>
              </div>
              <Progress value={hydrationProgress} className="w-full h-4" />
              <div className="flex gap-4">
                <Button variant="outline" className="flex-1 glass-card border-white/20 hover:bg-white/50 h-12">
                  <Plus className="h-5 w-5 mr-2" />+8oz
                </Button>
                <Button variant="outline" className="flex-1 glass-card border-white/20 hover:bg-white/50 h-12">
                  <Plus className="h-5 w-5 mr-2" />+12oz
                </Button>
                <Button variant="outline" className="flex-1 glass-card border-white/20 hover:bg-white/50 h-12">
                  <Plus className="h-5 w-5 mr-2" />+17oz
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}