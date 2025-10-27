"use client"

import { useMemo, useState } from "react"
import { useRole } from "./role-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Activity,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Dumbbell,
  LineChart,
  ListChecks,
  Mail,
  Plus,
  Share2,
  Tag,
  UserPlus,
  Target,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

type DayName = (typeof daysOfWeek)[number]

type GeneratedScheduleSession = {
  key: string
  day: DayName
  group: string
  tags: string[]
  title: string
  type: "practice" | "lift"
  intensity: "low" | "medium" | "high"
  focus: string
  notes: string
  startAt: string
  endAt: string
}

const dayIndexMap = new Map(daysOfWeek.map((day, index) => [day.toLowerCase(), index]))

const nextMonday = () => {
  const now = new Date()
  const day = now.getDay()
  const daysUntilMonday = (1 - day + 7) % 7
  const candidate = new Date(now)
  candidate.setHours(0, 0, 0, 0)
  candidate.setDate(candidate.getDate() + daysUntilMonday)
  return candidate
}

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

const slugifyTag = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const resolveScheduleTags = (group: string) => {
  const normalized = group.toLowerCase()
  const simplified = normalized.replace(/[^a-z0-9\s]/g, " ")
  const compact = simplified.replace(/\s+/g, " ").trim()

  const tagMatchers: { pattern: RegExp; tag: string }[] = [
    { pattern: /\bhj\b|\bhigh\s*jump\b/, tag: "hj" },
    { pattern: /\bpv\b|\bpole\s*vault\b/, tag: "pv" },
    { pattern: /\bmultis?\b|\bmulti\b/, tag: "multi" },
    { pattern: /\bmain\s*group\b/, tag: "main-group" },
    { pattern: /\bmen\b/, tag: "men" },
    { pattern: /\bwomen\b|\bgirls\b|\bfemale\b/, tag: "women" },
    { pattern: /\b100m\s*h\b|\b100mh\b/, tag: "100mh" },
    { pattern: /\b400m\s*h\b|\b400mh\b/, tag: "400mh" },
    { pattern: /\blift(s)?\b|\blifting\b|\bweight\s*room\b/, tag: "lift" },
  ]

  const detected = new Set<string>()
  for (const { pattern, tag } of tagMatchers) {
    if (pattern.test(compact)) {
      detected.add(tag)
    }
  }

  if (detected.size > 0) {
    return Array.from(detected)
  }

  const parts = compact
    .replace(/\band\b/g, " ")
    .split(/[\s/+,]+/)
    .map((part) => slugifyTag(part))
    .filter((part) => part.length > 0 && part !== "and")

  return parts.length > 0 ? Array.from(new Set(parts)) : []
}

const toLocalDateTime = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  const hours = `${date.getHours()}`.padStart(2, "0")
  const minutes = `${date.getMinutes()}`.padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}:00`
}

const inferIntensity = (notes: string) => {
  if (/test|max|time trial|plyo/i.test(notes)) return "high"
  if (/recovery|mobility|off/i.test(notes)) return "low"
  return "medium"
}

const parseScheduleTemplate = (
  template: string,
  startDate: string,
  durationMinutes: number
): { sessions: GeneratedScheduleSession[]; errors: string[] } => {
  const errors: string[] = []
  const trimmedTemplate = template.trim()
  if (!trimmedTemplate) {
    errors.push("Paste a schedule template to generate sessions.")
    return { sessions: [], errors }
  }

  const startDateObj = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(startDateObj.getTime())) {
    errors.push("Enter a valid week starting date.")
    return { sessions: [], errors }
  }

  if (startDateObj.getDay() !== 1) {
    errors.push("Select a Monday to keep the schedule aligned with each day.")
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    errors.push("Session duration must be a positive number of minutes.")
    return { sessions: [], errors }
  }

  const practiceLines: Partial<Record<DayName, string>> = {}
  const planLines: Partial<Record<DayName, string[]>> = {}

  let section: "none" | "practice" | "plan" = "none"
  let currentPlanDay: DayName | null = null

  for (const rawLine of template.split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    if (/^practice schedule/i.test(trimmed)) {
      section = "practice"
      continue
    }

    if (/^training plan/i.test(trimmed)) {
      section = "plan"
      currentPlanDay = null
      continue
    }

    if (section === "practice") {
      const match = rawLine.match(/^\s*([A-Za-z]+)\s*:\s*(.+)$/)
      if (match) {
        const dayName = match[1].trim().toLowerCase()
        const resolvedDay = (dayName.charAt(0).toUpperCase() + dayName.slice(1)) as DayName
        if (dayIndexMap.has(resolvedDay.toLowerCase())) {
          practiceLines[resolvedDay] = match[2].trim()
        } else {
          errors.push(`Unrecognized day "${match[1].trim()}" in practice schedule.`)
        }
      }
      continue
    }

    if (section === "plan") {
      const dayMatch = trimmed.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i)
      if (dayMatch && dayMatch[0].length === trimmed.length) {
        const normalized = (dayMatch[0].charAt(0).toUpperCase() + dayMatch[0].slice(1).toLowerCase()) as DayName
        currentPlanDay = normalized
        if (!planLines[currentPlanDay]) planLines[currentPlanDay] = []
        continue
      }
      if (currentPlanDay) {
        const cleaned = trimmed.replace(/^[\-*\u2022]+\s*/, "")
        if (cleaned.length > 0) {
          planLines[currentPlanDay]?.push(cleaned)
        }
      }
    }
  }

  const sessions: GeneratedScheduleSession[] = []

  for (const day of daysOfWeek) {
    const entries = practiceLines[day]
    if (!entries) continue

    const dayPlan = planLines[day] ?? []

    for (const entryRaw of entries.split(",")) {
      const entry = entryRaw.trim()
      if (!entry) continue

      if (/off|on your own/i.test(entry)) continue

      const match = entry.match(/(.+?)\s+(\d{1,2}:\d{2})\s*([ap]m)?$/i)
      if (!match) {
        errors.push(`Unable to parse "${entry}" for ${day}.`)
        continue
      }

      const group = match[1].trim()
      const time = match[2]
      const meridiem = match[3]?.toLowerCase()

      const [hourStr, minuteStr] = time.split(":")
      let hour = Number.parseInt(hourStr, 10)
      const minute = Number.parseInt(minuteStr, 10)

      if (Number.isNaN(hour) || Number.isNaN(minute)) {
        errors.push(`Invalid time "${time}" for ${group} on ${day}.`)
        continue
      }

      if (meridiem === "pm" && hour < 12) {
        hour += 12
      } else if (meridiem === "am" && hour === 12) {
        hour = 0
      } else if (!meridiem) {
        if (hour < 8) {
          hour += 12
        }
      }

      const offset = dayIndexMap.get(day.toLowerCase()) ?? 0
      const sessionDate = new Date(startDateObj)
      sessionDate.setDate(sessionDate.getDate() + offset)
      sessionDate.setHours(hour, minute, 0, 0)

      const endDate = new Date(sessionDate.getTime() + durationMinutes * 60 * 1000)

      const notes = dayPlan.join("\n")
      const focus = dayPlan[0] ?? group
      const type = /lift/i.test(group) ? "lift" : "practice"
      const intensity = inferIntensity(notes)
      const tags = resolveScheduleTags(group)
      const effectiveTags = tags.length > 0 ? tags : [slugifyTag(group)].filter((tag) => tag.length > 0)

      sessions.push({
        key: `${day}-${group}-${time}`,
        day,
        group,
        tags: effectiveTags,
        title: `${group} – ${day}`,
        type,
        intensity,
        focus,
        notes,
        startAt: toLocalDateTime(sessionDate),
        endAt: toLocalDateTime(endDate),
      })
    }
  }

  return { sessions, errors }
}

const formatPreviewTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

type AssignExerciseForm = {
  title: string
  type: string
  focus: string
  date: string
  startTime: string
  endTime: string
  intensity: string
  notes: string
}

const initialForm: AssignExerciseForm = {
  title: "",
  type: "practice",
  focus: "",
  date: "",
  startTime: "",
  endTime: "",
  intensity: "medium",
  notes: "",
}

type AddAthleteFormState = {
  name: string
  emails: string
  sport: string
  level: string
  team: string
  tags: string
}

const initialAthleteForm: AddAthleteFormState = {
  name: "",
  emails: "",
  sport: "",
  level: "",
  team: "",
  tags: "",
}

type BulkAssignFormState = AssignExerciseForm & {
  tag: string
}

const initialBulkForm: BulkAssignFormState = {
  ...initialForm,
  tag: "",
}

const formatDate = (value: string) => {
  if (!value) return "TBD"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

const formatDateTime = (value: string) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const isUpcoming = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() >= new Date().setHours(0, 0, 0, 0)
}

const extractEmails = (value: string) => {
  const tokens = value
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  const valid: string[] = []
  const invalid: string[] = []

  for (const token of tokens) {
    const normalized = token.toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      valid.push(normalized)
    } else {
      invalid.push(token)
    }
  }

  return { valid: Array.from(new Set(valid)), invalid }
}

const typeBadge = (type: string) => {
  switch (type) {
    case "lift":
      return (
        <Badge className="border-[#b3c7e6] bg-[#d9e3f5] px-2 py-0.5 text-[0.7rem] text-[#0f4d92] sm:text-xs">
          Strength
        </Badge>
      )
    case "rehab":
      return (
        <Badge className="border-[#c5ddf5] bg-[#e4f1ff] px-2 py-0.5 text-[0.7rem] text-[#12467f] sm:text-xs">
          Recovery
        </Badge>
      )
    default:
      return (
        <Badge className="border-[#c7d7ee] bg-[#edf2fa] px-2 py-0.5 text-[0.7rem] text-[#123a70] sm:text-xs">
          Practice
        </Badge>
      )
  }
}

function CoachAthleteCard({
  athleteId,
  name,
  email,
  sport,
  level,
  team,
  tags,
  sessions,
  calendar,
  workouts,
  assignedByName,
}: {
  athleteId: number
  name: string
  email: string
  sport: string
  level: string
  team: string
  tags: string[]
  sessions: ReturnType<typeof useRole>["athletes"][number]["sessions"]
  calendar: ReturnType<typeof useRole>["athletes"][number]["calendar"]
  workouts: ReturnType<typeof useRole>["athletes"][number]["workouts"]
  assignedByName: string
}) {
  const { scheduleSession } = useRole()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<AssignExerciseForm>(initialForm)

  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter((session) => isUpcoming(session.startAt))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [sessions]
  )

  const nextSession = upcomingSessions[0]
  const calendarHighlights = calendar.slice(0, 3)
  const activeWorkouts = workouts.slice(0, 3)

  const handleAssign = () => {
    if (!form.title || !form.date || !form.startTime || !form.endTime) {
      return
    }

    const startAt = `${form.date}T${form.startTime}`
    const endAt = `${form.date}T${form.endTime}`

    scheduleSession(
      athleteId,
      {
        title: form.title,
        type: form.type,
        startAt,
        endAt,
        intensity: form.intensity,
        notes: form.notes,
      },
      {
        focus: form.focus || form.title,
        assignedBy: assignedByName,
      }
    )

    setForm(initialForm)
    setOpen(false)
  }

  return (
    <Card className="glass-card border-0 shadow-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-gray-900 sm:text-xl">{name}</CardTitle>
          <p className="text-xs font-medium text-gray-500 sm:text-sm">{sport} • {team}</p>
          <div className="mt-1 flex items-center gap-2 text-[0.7rem] text-gray-500 sm:text-xs">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="font-medium text-gray-600">{email}</span>
          </div>
        </div>
        <Badge className="bg-gradient-to-r from-[#0f4d92] to-[#1c6dd0] border-0 px-2 py-1 text-xs font-medium text-white sm:text-sm">
          {level}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <div className="rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-gray-500 sm:text-xs">Next Session</p>
              {nextSession ? (
                <div>
                  <p className="text-sm font-semibold text-gray-900 sm:text-base">{nextSession.title}</p>
                  <p className="text-xs text-gray-500 sm:text-sm">{formatDateTime(nextSession.startAt)}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500 sm:text-sm">No upcoming session scheduled</p>
              )}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[0.7rem] text-gray-500 sm:text-xs">Intensity</p>
              <p className="text-sm font-semibold capitalize sm:text-base">
                {nextSession ? nextSession.intensity : "TBD"}
              </p>
            </div>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[0.7rem] text-gray-500 sm:gap-2 sm:text-xs">
            <Tag className="h-3 w-3 text-[#0f4d92]" />
            {tags.map((tagValue) => {
              const label = tagValue.charAt(0).toUpperCase() + tagValue.slice(1)
              return (
                <Badge
                  key={tagValue}
                  className="border-[#c7d7ee] bg-[#edf2fa] px-2 py-1 text-[0.7rem] capitalize text-[#123a70] sm:text-xs"
                >
                  {label}
                </Badge>
              )
            })}
          </div>
        )}

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-900 sm:mb-3 sm:text-sm">
            <CalendarIcon className="h-4 w-4 text-[#0f4d92]" /> Calendar Highlights
          </h4>
          <div className="space-y-1.5 sm:space-y-2">
            {calendarHighlights.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-xs sm:text-sm"
              >
                <div className="max-w-[70%] sm:max-w-none">
                  <p className="font-semibold text-gray-900 sm:text-base">{event.title}</p>
                  <p className="text-[0.7rem] text-gray-500 sm:text-xs">
                    {formatDate(event.date)} • {event.timeRange}
                  </p>
                </div>
                {typeBadge(event.type)}
              </div>
            ))}
            {calendarHighlights.length === 0 && (
              <p className="text-xs text-gray-500 sm:text-sm">No events on the calendar yet.</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-900 sm:mb-3 sm:text-sm">
            <ListChecks className="h-4 w-4 text-[#1c6dd0]" /> Workout Plan
          </h4>
          <div className="space-y-1.5 sm:space-y-2">
            {activeWorkouts.map((workout) => (
              <div
                key={workout.id}
                className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-xs sm:text-sm"
              >
                <div className="max-w-[70%] sm:max-w-none">
                  <p className="font-semibold text-gray-900 sm:text-base">{workout.title}</p>
                  <p className="text-[0.7rem] text-gray-500 sm:text-xs">
                    Due {formatDate(workout.dueDate)} • {workout.focus}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "border-0 px-2 py-1 text-[0.7rem] capitalize sm:text-xs",
                    workout.status === "Completed"
                      ? "bg-gradient-to-r from-[#0f4d92] to-[#123d73] text-white"
                      : "bg-[#e2ebf9] text-[#0f2f5b]"
                  )}
                >
                  {workout.status}
                </Badge>
              </div>
            ))}
            {activeWorkouts.length === 0 && (
              <p className="text-xs text-gray-500 sm:text-sm">No workouts assigned yet.</p>
            )}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gradient-secondary text-white shadow-glow">
              <Plus className="mr-2 h-4 w-4" /> Assign Exercise
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Exercise for {name}</DialogTitle>
              <DialogDescription>Schedule a new training block that updates their calendar and workouts instantly.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 sm:space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Title</label>
                  <Input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Acceleration Drills"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Session Type</label>
                  <select
                    className="w-full rounded-md border border-gray-200 p-2 text-sm"
                    value={form.type}
                    onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                  >
                    <option value="practice">Practice</option>
                    <option value="lift">Strength</option>
                    <option value="rehab">Recovery</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Performance Focus</label>
                <Input
                  value={form.focus}
                  onChange={(event) => setForm((prev) => ({ ...prev, focus: event.target.value }))}
                  placeholder="Speed mechanics"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Date</label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Intensity</label>
                  <select
                    className="w-full rounded-md border border-gray-200 p-2 text-sm"
                    value={form.intensity}
                    onChange={(event) => setForm((prev) => ({ ...prev, intensity: event.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Start Time</label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">End Time</label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Coaching Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Key coaching points, equipment needs, etc."
                  rows={3}
                  className="min-h-[5rem] w-full rounded-md border border-gray-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c7dbf3] sm:min-h-[6.5rem]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} className="gradient-primary text-white">
                Assign Exercise
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export function CoachDashboard() {
  const { athletes, addAthlete, assignSessionToTag, currentUser, scheduleSession } = useRole()
  const [isAddAthleteOpen, setIsAddAthleteOpen] = useState(false)
  const [addAthleteForm, setAddAthleteForm] = useState(initialAthleteForm)
  const [addAthleteError, setAddAthleteError] = useState<string | null>(null)
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false)
  const [bulkAssignForm, setBulkAssignForm] = useState(initialBulkForm)
  const [bulkAssignError, setBulkAssignError] = useState<string | null>(null)
  const [isSchedulePasteOpen, setIsSchedulePasteOpen] = useState(false)
  const [scheduleText, setScheduleText] = useState("")
  const [scheduleDuration, setScheduleDuration] = useState(75)
  const [schedulePreview, setSchedulePreview] = useState<GeneratedScheduleSession[]>([])
  const [scheduleErrors, setScheduleErrors] = useState<string[]>([])
  const [scheduleStartDate, setScheduleStartDate] = useState(() => formatDateForInput(nextMonday()))

  const coachDisplayName = currentUser?.name ?? "Coaching Staff"

  const allSessions = useMemo(() => athletes.flatMap((athlete) => athlete.sessions), [athletes])
  const totalSessions = allSessions.length
  const completedSessions = allSessions.filter((session) => session.completed).length
  const completionRate = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0

  const sessionsToday = allSessions.filter((session) => {
    const date = new Date(session.startAt)
    if (Number.isNaN(date.getTime())) return false
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }).length

  const upcomingAssignments = athletes.reduce(
    (total, athlete) => total + athlete.workouts.filter((workout) => workout.status !== "Completed").length,
    0
  )

  const upcomingSessions = useMemo(
    () =>
      allSessions
        .filter((session) => isUpcoming(session.startAt))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .slice(0, 5),
    [allSessions]
  )

  const matchingAthleteCount = useMemo(() => {
    const normalizedTag = bulkAssignForm.tag.trim().toLowerCase()
    if (!normalizedTag) return 0
    return athletes.filter((athlete) => athlete.tags.includes(normalizedTag)).length
  }, [athletes, bulkAssignForm.tag])

  const previewAssignments = useMemo(() => {
    return schedulePreview.map((session) => {
      const matchingAthletes = session.tags.length
        ? athletes.filter((athlete) => session.tags.some((tag) => athlete.tags.includes(tag)))
        : []
      const recipients = matchingAthletes.length > 0 ? matchingAthletes : athletes
      return {
        session,
        assignedCount: recipients.length,
        assignedLabel:
          matchingAthletes.length > 0
            ? `Tag${session.tags.length > 1 ? "s" : ""}: ${session.tags.join(", ")}`
            : "All Athletes",
      }
    })
  }, [schedulePreview, athletes])

  const handleAddAthlete = () => {
    const { valid: emails, invalid } = extractEmails(addAthleteForm.emails)

    if (invalid.length > 0) {
      setAddAthleteError(`Remove invalid email address${invalid.length > 1 ? "es" : ""}: ${invalid.join(", ")}`)
      return
    }

    if (emails.length === 0) {
      setAddAthleteError("Add at least one valid email address.")
      return
    }

    const tagValues = addAthleteForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    for (const email of emails) {
      addAthlete({
        name: emails.length === 1 ? addAthleteForm.name : undefined,
        email,
        sport: addAthleteForm.sport || undefined,
        level: addAthleteForm.level || undefined,
        team: addAthleteForm.team || undefined,
        tags: tagValues.length ? tagValues : undefined,
      })
    }

    setAddAthleteForm(initialAthleteForm)
    setAddAthleteError(null)
    setIsAddAthleteOpen(false)
  }

  const handleBulkAssign = () => {
    if (!bulkAssignForm.tag.trim()) {
      setBulkAssignError("Add a tag to target the correct athletes.")
      return
    }

    if (!bulkAssignForm.title || !bulkAssignForm.date || !bulkAssignForm.startTime || !bulkAssignForm.endTime) {
      setBulkAssignError("Title, date, start time, and end time are required.")
      return
    }

    const normalizedTag = bulkAssignForm.tag.trim().toLowerCase()
    const targetedAthletes = athletes.filter((athlete) => athlete.tags.includes(normalizedTag))
    if (targetedAthletes.length === 0) {
      setBulkAssignError("No athletes currently match that tag.")
      return
    }

    const startAt = `${bulkAssignForm.date}T${bulkAssignForm.startTime}`
    const endAt = `${bulkAssignForm.date}T${bulkAssignForm.endTime}`

    assignSessionToTag(
      bulkAssignForm.tag,
      {
        title: bulkAssignForm.title,
        type: bulkAssignForm.type,
        startAt,
        endAt,
        intensity: bulkAssignForm.intensity,
        notes: bulkAssignForm.notes,
      },
      {
        focus: bulkAssignForm.focus || bulkAssignForm.title,
        assignedBy: coachDisplayName,
      }
    )

    setBulkAssignForm(initialBulkForm)
    setBulkAssignError(null)
    setIsBulkAssignOpen(false)
  }

  const resetScheduleImport = () => {
    setScheduleText("")
    setSchedulePreview([])
    setScheduleErrors([])
    setScheduleDuration(75)
    setScheduleStartDate(formatDateForInput(nextMonday()))
  }

  const handleGenerateSchedulePreview = () => {
    const { sessions, errors } = parseScheduleTemplate(scheduleText, scheduleStartDate, scheduleDuration)
    setSchedulePreview(sessions)
    setScheduleErrors(errors)
  }

  const handleApplySchedule = () => {
    if (schedulePreview.length === 0) {
      setScheduleErrors(["Generate a preview before assigning workouts."])
      return
    }

    for (const session of schedulePreview) {
      const targetedAthletes = session.tags.length
        ? athletes.filter((athlete) => session.tags.some((tag) => athlete.tags.includes(tag)))
        : []
      const recipients = targetedAthletes.length > 0 ? targetedAthletes : athletes

      for (const athlete of recipients) {
        scheduleSession(
          athlete.id,
          {
            type: session.type,
            title: session.title,
            startAt: session.startAt,
            endAt: session.endAt,
            intensity: session.intensity,
            notes: session.notes || undefined,
          },
          {
            focus: session.focus,
            assignedBy: coachDisplayName,
          }
        )
      }
    }

    resetScheduleImport()
    setIsSchedulePasteOpen(false)
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Coach Control Center</h1>
          <p className="text-xs font-medium text-gray-600 sm:text-sm">
            Monitor athlete readiness, assign sessions, and keep calendars in sync.
          </p>
        </div>
        <Badge className="bg-gradient-to-r from-[#0f4d92] to-[#1c6dd0] border-0 px-3 py-1 text-xs font-semibold text-white sm:text-sm">
          <Users className="mr-2 h-4 w-4" /> {athletes.length} Athletes
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-start gap-2.5 sm:justify-end sm:gap-3">
        <Dialog open={isAddAthleteOpen} onOpenChange={setIsAddAthleteOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white shadow-glow">
              <UserPlus className="mr-2 h-4 w-4" /> Add Athlete
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Athlete by Email</DialogTitle>
              <DialogDescription>
                Invite new student-athletes to your roster using one or more email addresses.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 sm:space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Athlete Email(s) *</label>
                  <textarea
                    value={addAthleteForm.emails}
                    onChange={(event) => setAddAthleteForm((prev) => ({ ...prev, emails: event.target.value }))}
                    placeholder="athlete@locker.app, teammate@locker.app"
                    rows={3}
                    className="min-h-[4.5rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Separate multiple emails with commas, spaces, or new lines.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Full Name</label>
                  <Input
                    value={addAthleteForm.name}
                    onChange={(event) => setAddAthleteForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Jamie Thompson"
                  />
                  <p className="mt-1 text-xs text-gray-500">Used when adding a single athlete.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Sport</label>
                  <Input
                    value={addAthleteForm.sport}
                    onChange={(event) => setAddAthleteForm((prev) => ({ ...prev, sport: event.target.value }))}
                    placeholder="Track & Field"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Team / Group</label>
                  <Input
                    value={addAthleteForm.team}
                    onChange={(event) => setAddAthleteForm((prev) => ({ ...prev, team: event.target.value }))}
                    placeholder="Sprints"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Competitive Level</label>
                  <Input
                    value={addAthleteForm.level}
                    onChange={(event) => setAddAthleteForm((prev) => ({ ...prev, level: event.target.value }))}
                    placeholder="Elite"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Tags</label>
                  <Input
                    value={addAthleteForm.tags}
                    onChange={(event) => setAddAthleteForm((prev) => ({ ...prev, tags: event.target.value }))}
                    placeholder="track, sprinter"
                  />
                  <p className="mt-1 text-xs text-gray-500">Use tags to group athletes (e.g. track, distance, rehab).</p>
                </div>
              </div>
              {addAthleteError && (
                <p className="text-xs font-medium text-red-600 sm:text-sm">{addAthleteError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddAthleteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAthlete} className="gradient-primary text-white">
                Save Athlete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="shadow-sm">
              <Share2 className="mr-2 h-4 w-4" /> Assign by Tag
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Exercise to Tagged Athletes</DialogTitle>
              <DialogDescription>
                Select a tag (for example, <span className="font-semibold text-[#0f4d92]">track</span>) to instantly add a session to
                every athlete in that group.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 sm:space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Target Tag *</label>
                  <Input
                    value={bulkAssignForm.tag}
                    onChange={(event) =>
                      setBulkAssignForm((prev) => ({ ...prev, tag: event.target.value }))
                    }
                    placeholder="track"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {matchingAthleteCount > 0
                      ? `${matchingAthleteCount} athlete${matchingAthleteCount === 1 ? " matches" : "s match"} this tag`
                      : "No athletes currently match this tag"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Title *</label>
                  <Input
                    value={bulkAssignForm.title}
                    onChange={(event) =>
                      setBulkAssignForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    placeholder="Track Speed Session"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Session Type</label>
                  <select
                    className="w-full rounded-md border border-gray-200 p-2 text-sm"
                    value={bulkAssignForm.type}
                    onChange={(event) =>
                      setBulkAssignForm((prev) => ({ ...prev, type: event.target.value }))
                    }
                  >
                    <option value="practice">Practice</option>
                    <option value="lift">Strength</option>
                    <option value="rehab">Recovery</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Focus</label>
                  <Input
                    value={bulkAssignForm.focus}
                    onChange={(event) =>
                      setBulkAssignForm((prev) => ({ ...prev, focus: event.target.value }))
                    }
                    placeholder="Block starts and acceleration"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Date *</label>
                  <Input
                    type="date"
                    value={bulkAssignForm.date}
                    onChange={(event) =>
                      setBulkAssignForm((prev) => ({ ...prev, date: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Intensity</label>
                  <select
                    className="w-full rounded-md border border-gray-200 p-2 text-sm"
                    value={bulkAssignForm.intensity}
                    onChange={(event) =>
                      setBulkAssignForm((prev) => ({ ...prev, intensity: event.target.value }))
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Start Time *</label>
                  <Input
                    type="time"
                    value={bulkAssignForm.startTime}
                    onChange={(event) =>
                      setBulkAssignForm((prev) => ({ ...prev, startTime: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">End Time *</label>
                  <Input
                    type="time"
                    value={bulkAssignForm.endTime}
                    onChange={(event) =>
                      setBulkAssignForm((prev) => ({ ...prev, endTime: event.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Coaching Notes</label>
                  <textarea
                    value={bulkAssignForm.notes}
                    onChange={(event) =>
                      setBulkAssignForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    placeholder="Shared context, goals, or equipment needs."
                    rows={3}
                    className="min-h-[5rem] w-full rounded-md border border-gray-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c7dbf3] sm:min-h-[6.5rem]"
                  />
                </div>
              </div>
              {bulkAssignError && (
                <p className="text-xs font-medium text-red-600 sm:text-sm">{bulkAssignError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkAssignOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkAssign} className="gradient-secondary text-white">
                Assign to Group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isSchedulePasteOpen}
          onOpenChange={(open) => {
            setIsSchedulePasteOpen(open)
            if (!open) {
              resetScheduleImport()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" className="shadow-sm">
              <ListChecks className="mr-2 h-4 w-4" /> Paste Weekly Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Auto-Fill Workouts from Coach Template</DialogTitle>
              <DialogDescription>
                Paste your weekly practice schedule and training plan to generate athlete sessions automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Week Starting (Monday) *</label>
                  <Input
                    type="date"
                    value={scheduleStartDate}
                    onChange={(event) => setScheduleStartDate(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Session Duration (minutes)</label>
                  <Input
                    type="number"
                    min={15}
                    value={scheduleDuration}
                    onChange={(event) => setScheduleDuration(Number(event.target.value))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Coach Schedule Template *</label>
                <textarea
                  value={scheduleText}
                  onChange={(event) => setScheduleText(event.target.value)}
                  rows={10}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  placeholder="Paste the Practice Schedule and Training Plan text here."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Works best with the weekly format your coaching staff already uses.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button onClick={handleGenerateSchedulePreview} variant="secondary" className="w-full sm:w-auto">
                  Generate Preview
                </Button>
                {scheduleErrors.length > 0 && (
                  <ul className="space-y-1 text-xs font-medium text-red-600 sm:text-sm">
                    {scheduleErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
              {previewAssignments.length > 0 && (
                <div className="rounded-md border border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs font-semibold text-gray-600">Day</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600">Group</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600">Start</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600">End</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600">Assigned</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600">Focus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewAssignments.map(({ session, assignedCount, assignedLabel }) => (
                        <TableRow key={session.key}>
                          <TableCell className="text-sm font-medium text-gray-900">{session.day}</TableCell>
                          <TableCell className="text-sm text-gray-700">{session.group}</TableCell>
                          <TableCell className="text-sm text-gray-700">{formatPreviewTime(session.startAt)}</TableCell>
                          <TableCell className="text-sm text-gray-700">{formatPreviewTime(session.endAt)}</TableCell>
                          <TableCell className="text-sm text-gray-700">
                            {assignedLabel}
                            <span className="ml-1 text-xs text-gray-500">({assignedCount})</span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">
                            <span className="block max-w-[12rem] truncate" title={session.focus}>
                              {session.focus}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
                    Sessions default to medium intensity unless tests are detected in the plan notes.
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsSchedulePasteOpen(false)
                  resetScheduleImport()
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleApplySchedule} className="gradient-secondary text-white" disabled={schedulePreview.length === 0}>
                Assign Workouts
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Team Sessions</p>
                <p className="text-xl font-bold text-gray-900 sm:text-2xl">{totalSessions}</p>
              </div>
              <Dumbbell className="h-7 w-7 text-[#0f4d92] sm:h-8 sm:w-8" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Completion Rate</p>
                <p className="text-xl font-bold text-gray-900 sm:text-2xl">{completionRate}%</p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-[#1c6dd0] sm:h-8 sm:w-8" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Sessions Today</p>
                <p className="text-xl font-bold text-gray-900 sm:text-2xl">{sessionsToday}</p>
              </div>
              <Clock className="h-7 w-7 text-[#87a8d0] sm:h-8 sm:w-8" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Open Assignments</p>
                <p className="text-xl font-bold text-gray-900 sm:text-2xl">{upcomingAssignments}</p>
              </div>
              <Target className="h-7 w-7 text-[#123d73] sm:h-8 sm:w-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-0 shadow-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg text-gray-900 sm:text-xl">Upcoming Team Schedule</CardTitle>
            <p className="text-xs text-gray-500 sm:text-sm">Automated calendar view of all scheduled training blocks.</p>
          </div>
          <Badge className="border-[#c7d7ee] bg-[#edf2fa] px-3 py-1 text-xs font-medium text-[#123a70] sm:text-sm">Next 5</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-transparent">
                  <TableHead className="text-xs font-medium text-gray-500 sm:text-sm">Session</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 sm:text-sm">Athlete</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 sm:text-sm">Start</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 sm:text-sm">Intensity</TableHead>
              </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingSessions.map((session) => {
                const athlete = athletes.find((item) => item.sessions.some((s) => s.id === session.id))
                return (
                  <TableRow key={session.id} className="border-transparent hover:bg-white/60">
                    <TableCell className="text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        {session.type === "lift" ? (
                          <Dumbbell className="h-4 w-4 text-[#0f4d92]" />
                        ) : session.type === "rehab" ? (
                          <Activity className="h-4 w-4 text-[#1c6dd0]" />
                        ) : (
                          <LineChart className="h-4 w-4 text-[#123a70]" />
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{session.title}</p>
                          <p className="text-[0.7rem] text-gray-500 sm:text-xs">{session.focus}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 sm:text-sm">{athlete?.name ?? "Team"}</TableCell>
                    <TableCell className="text-xs text-gray-600 sm:text-sm">{formatDateTime(session.startAt)}</TableCell>
                    <TableCell>
                      <Badge className="border border-[#c7d7ee] bg-[#e8f0fb] px-2 py-1 text-[0.7rem] capitalize text-[#0f2f5b] sm:text-xs">
                        {session.intensity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
              {upcomingSessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-gray-500 sm:text-sm">
                    No upcoming sessions scheduled.
                  </TableCell>
                </TableRow>
              )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-gray-900 sm:mb-4 sm:text-2xl">
          <Users className="h-5 w-5 text-[#0f4d92]" /> Athlete Roster
        </h2>
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          {athletes.map((athlete) => (
            <CoachAthleteCard
              key={athlete.id}
              athleteId={athlete.id}
              name={athlete.name}
              email={athlete.email}
              sport={athlete.sport}
              level={athlete.level}
              team={athlete.team}
              tags={athlete.tags}
              sessions={athlete.sessions}
              calendar={athlete.calendar}
              workouts={athlete.workouts}
              assignedByName={coachDisplayName}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
