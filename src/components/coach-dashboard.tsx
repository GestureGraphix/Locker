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
  Plus,
  Target,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

const coachName = "Coaching Staff"

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

const typeBadge = (type: string) => {
  switch (type) {
    case "lift":
      return <Badge className="bg-[#d9e3f5] text-[#0f4d92] border-[#b3c7e6]">Strength</Badge>
    case "rehab":
      return <Badge className="bg-[#e4f1ff] text-[#12467f] border-[#c5ddf5]">Recovery</Badge>
    default:
      return <Badge className="bg-[#edf2fa] text-[#123a70] border-[#c7d7ee]">Practice</Badge>
  }
}

function CoachAthleteCard({
  athleteId,
  name,
  sport,
  level,
  team,
  sessions,
  calendar,
  workouts,
}: {
  athleteId: number
  name: string
  sport: string
  level: string
  team: string
  sessions: ReturnType<typeof useRole>["athletes"][number]["sessions"]
  calendar: ReturnType<typeof useRole>["athletes"][number]["calendar"]
  workouts: ReturnType<typeof useRole>["athletes"][number]["workouts"]
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
        assignedBy: coachName,
      }
    )

    setForm(initialForm)
    setOpen(false)
  }

  return (
    <Card className="glass-card border-0 shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-xl text-gray-900">{name}</CardTitle>
          <p className="text-sm text-gray-500 font-medium">{sport} • {team}</p>
        </div>
        <Badge className="bg-gradient-to-r from-[#0f4d92] to-[#1c6dd0] text-white border-0">{level}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-2xl bg-white/80 border border-white/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-gray-500 tracking-wide">Next Session</p>
              {nextSession ? (
                <div>
                  <p className="text-sm font-semibold text-gray-900">{nextSession.title}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(nextSession.startAt)}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No upcoming session scheduled</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Intensity</p>
              <p className="text-sm font-semibold capitalize">{nextSession ? nextSession.intensity : "TBD"}</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-[#0f4d92]" /> Calendar Highlights
          </h4>
          <div className="space-y-2">
            {calendarHighlights.map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">{event.title}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(event.date)} • {event.timeRange}
                  </p>
                </div>
                {typeBadge(event.type)}
              </div>
            ))}
            {calendarHighlights.length === 0 && (
              <p className="text-sm text-gray-500">No events on the calendar yet.</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[#1c6dd0]" /> Workout Plan
          </h4>
          <div className="space-y-2">
            {activeWorkouts.map((workout) => (
              <div key={workout.id} className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">{workout.title}</p>
                  <p className="text-xs text-gray-500">
                    Due {formatDate(workout.dueDate)} • {workout.focus}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "capitalize border-0",
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
              <p className="text-sm text-gray-500">No workouts assigned yet.</p>
            )}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gradient-secondary text-white shadow-glow">
              <Plus className="h-4 w-4 mr-2" /> Assign Exercise
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Exercise for {name}</DialogTitle>
              <DialogDescription>Schedule a new training block that updates their calendar and workouts instantly.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
                  className="w-full rounded-md border border-gray-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c7dbf3]"
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
  const { athletes } = useRole()

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coach Control Center</h1>
          <p className="text-sm text-gray-600 font-medium">
            Monitor athlete readiness, assign sessions, and keep calendars in sync.
          </p>
        </div>
        <Badge className="bg-gradient-to-r from-[#0f4d92] to-[#1c6dd0] text-white border-0">
          <Users className="h-4 w-4 mr-2" /> {athletes.length} Athletes
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Team Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
              </div>
              <Dumbbell className="h-8 w-8 text-[#0f4d92]" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{completionRate}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-[#1c6dd0]" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Sessions Today</p>
                <p className="text-2xl font-bold text-gray-900">{sessionsToday}</p>
              </div>
              <Clock className="h-8 w-8 text-[#87a8d0]" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Open Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingAssignments}</p>
              </div>
              <Target className="h-8 w-8 text-[#123d73]" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl text-gray-900">Upcoming Team Schedule</CardTitle>
            <p className="text-sm text-gray-500">Automated calendar view of all scheduled training blocks.</p>
          </div>
          <Badge className="bg-[#edf2fa] text-[#123a70] border-[#c7d7ee]">Next 5</Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-transparent">
                <TableHead className="text-gray-500">Session</TableHead>
                <TableHead className="text-gray-500">Athlete</TableHead>
                <TableHead className="text-gray-500">Start</TableHead>
                <TableHead className="text-gray-500">Intensity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingSessions.map((session) => {
                const athlete = athletes.find((item) => item.sessions.some((s) => s.id === session.id))
                return (
                  <TableRow key={session.id} className="border-transparent hover:bg-white/60">
                    <TableCell>
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
                          <p className="text-xs text-gray-500">{session.focus}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{athlete?.name ?? "Team"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDateTime(session.startAt)}</TableCell>
                    <TableCell>
                      <Badge className="capitalize bg-[#e8f0fb] text-[#0f2f5b] border border-[#c7d7ee]">
                        {session.intensity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
              {upcomingSessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                    No upcoming sessions scheduled.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#0f4d92]" /> Athlete Roster
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {athletes.map((athlete) => (
            <CoachAthleteCard
              key={athlete.id}
              athleteId={athlete.id}
              name={athlete.name}
              sport={athlete.sport}
              level={athlete.level}
              team={athlete.team}
              sessions={athlete.sessions}
              calendar={athlete.calendar}
              workouts={athlete.workouts}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
