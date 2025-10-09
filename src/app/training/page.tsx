"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRole } from "@/components/role-context"
import { CoachDashboard } from "@/components/coach-dashboard"
import {
  Dumbbell,
  Plus,
  Calendar,
  Clock,
  Target,
  Activity,
  Zap,
  Award,
  Timer
} from "lucide-react"

const mockPRs = [
  { id: 1, exercise: "Bench Press", loadKg: 95, reps: 5, date: "2024-01-14", intensity: "high" },
  { id: 2, exercise: "Squat", loadKg: 140, reps: 3, date: "2024-01-12", intensity: "high" },
  { id: 3, exercise: "Deadlift", loadKg: 160, reps: 1, date: "2024-01-10", intensity: "high" },
  { id: 4, exercise: "Overhead Press", loadKg: 65, reps: 8, date: "2024-01-08", intensity: "medium" }
]

const getIntensityColor = (intensity: string) => {
  switch (intensity) {
    case "high": return "bg-red-100 text-red-800 border-red-200"
    case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "low": return "bg-green-100 text-green-800 border-green-200"
    default: return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "practice": return <Activity className="h-4 w-4" />
    case "lift": return <Dumbbell className="h-4 w-4" />
    case "rehab": return <Target className="h-4 w-4" />
    default: return <Activity className="h-4 w-4" />
  }
}

const formatDuration = (startAt: string, endAt: string) => {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const diffMs = end.getTime() - start.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return `${diffHours}h ${diffMinutes}m`
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

export default function Training() {
  const { role, athletes, scheduleSession, toggleSessionCompletion } = useRole()
  const primaryAthlete = athletes[0]
  const sessions = primaryAthlete?.sessions ?? []
  const [prs, setPRs] = useState(mockPRs)
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false)
  const [isAddPROpen, setIsAddPROpen] = useState(false)
  const [newSession, setNewSession] = useState({
    type: "practice",
    title: "",
    startAt: "",
    endAt: "",
    intensity: "medium",
    notes: ""
  })
  const [newPR, setNewPR] = useState({
    exercise: "",
    loadKg: "",
    reps: "",
    date: new Date().toISOString().split('T')[0],
    intensity: "medium"
  })

  const handleAddSession = () => {
    if (!primaryAthlete) return
    if (newSession.title && newSession.startAt && newSession.endAt) {
      scheduleSession(primaryAthlete.id, {
        type: newSession.type,
        title: newSession.title,
        startAt: newSession.startAt,
        endAt: newSession.endAt,
        intensity: newSession.intensity,
        notes: newSession.notes,
      })
      setNewSession({
        type: "practice",
        title: "",
        startAt: "",
        endAt: "",
        intensity: "medium",
        notes: "",
      })
      setIsAddSessionOpen(false)
    }
  }

  const handleAddPR = () => {
    if (newPR.exercise && newPR.loadKg && newPR.reps) {
      const pr = {
        id: prs.length + 1,
        ...newPR,
        loadKg: parseFloat(newPR.loadKg),
        reps: parseInt(newPR.reps)
      }
      setPRs(prev => [...prev, pr])
      setNewPR({
        exercise: "",
        loadKg: "",
        reps: "",
        date: new Date().toISOString().split('T')[0],
        intensity: "medium"
      })
      setIsAddPROpen(false)
    }
  }

  const toggleSessionComplete = (id: number) => {
    if (!primaryAthlete) return
    toggleSessionCompletion(primaryAthlete.id, id)
  }

  const upcomingSessions = useMemo(() => {
    const activeSessions = primaryAthlete?.sessions ?? []
    return activeSessions
      .filter((session) => !session.completed)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  }, [primaryAthlete])
  const completedSessions = sessions.filter(session => session.completed)
  const recentPRs = prs.slice(0, 5)

  if (role === "coach") {
    return <CoachDashboard />
  }

  if (!primaryAthlete) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Training</h1>
        <p className="text-muted-foreground">No athlete data available yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Training</h1>
          <p className="text-muted-foreground">Track your sessions and personal records</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddSessionOpen} onOpenChange={setIsAddSessionOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Training Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={newSession.type}
                    onChange={(e) => setNewSession(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="practice">Practice</option>
                    <option value="lift">Strength Training</option>
                    <option value="rehab">Recovery/Rehab</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input 
                    value={newSession.title}
                    onChange={(e) => setNewSession(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter session title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Start Time</label>
                    <Input 
                      type="datetime-local"
                      value={newSession.startAt}
                      onChange={(e) => setNewSession(prev => ({ ...prev, startAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">End Time</label>
                    <Input 
                      type="datetime-local"
                      value={newSession.endAt}
                      onChange={(e) => setNewSession(prev => ({ ...prev, endAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Intensity</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={newSession.intensity}
                    onChange={(e) => setNewSession(prev => ({ ...prev, intensity: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Input 
                    value={newSession.notes}
                    onChange={(e) => setNewSession(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Session notes"
                  />
                </div>
                <Button onClick={handleAddSession} className="w-full">
                  Add Session
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddPROpen} onOpenChange={setIsAddPROpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Log PR
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Personal Record</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Exercise</label>
                  <Input 
                    value={newPR.exercise}
                    onChange={(e) => setNewPR(prev => ({ ...prev, exercise: e.target.value }))}
                    placeholder="e.g., Bench Press"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Weight (kg)</label>
                    <Input 
                      type="number"
                      value={newPR.loadKg}
                      onChange={(e) => setNewPR(prev => ({ ...prev, loadKg: e.target.value }))}
                      placeholder="95"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Reps</label>
                    <Input 
                      type="number"
                      value={newPR.reps}
                      onChange={(e) => setNewPR(prev => ({ ...prev, reps: e.target.value }))}
                      placeholder="5"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <Input 
                    type="date"
                    value={newPR.date}
                    onChange={(e) => setNewPR(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Intensity</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={newPR.intensity}
                    onChange={(e) => setNewPR(prev => ({ ...prev, intensity: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <Button onClick={handleAddPR} className="w-full">
                  Log PR
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Sessions This Week</p>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">PRs This Month</p>
                <p className="text-2xl font-bold">{prs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Timer className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Avg Session Time</p>
                <p className="text-2xl font-bold">1.5h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium">High Intensity</p>
                <p className="text-2xl font-bold">
                  {sessions.filter(s => s.intensity === "high").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="prs">Personal Records</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {/* Upcoming Sessions */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Upcoming Sessions</h2>
            <div className="space-y-3">
              {upcomingSessions.map(session => (
                <Card key={session.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {getTypeIcon(session.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold">{session.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(session.startAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatTime(session.startAt)} - {formatTime(session.endAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Timer className="h-4 w-4" />
                              {formatDuration(session.startAt, session.endAt)}
                            </span>
                          </div>
                          {session.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{session.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getIntensityColor(session.intensity)}>
                          {session.intensity}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toggleSessionComplete(session.id)}
                        >
                          Complete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Completed Sessions */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Intensity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedSessions.map(session => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(session.type)}
                            <span className="capitalize">{session.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{session.title}</TableCell>
                        <TableCell>{new Date(session.startAt).toLocaleDateString()}</TableCell>
                        <TableCell>{formatDuration(session.startAt, session.endAt)}</TableCell>
                        <TableCell>
                          <Badge className={getIntensityColor(session.intensity)}>
                            {session.intensity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            Completed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="prs" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Personal Records</h2>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exercise</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Reps</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Intensity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPRs.map(pr => (
                      <TableRow key={pr.id}>
                        <TableCell className="font-medium">{pr.exercise}</TableCell>
                        <TableCell>{pr.loadKg} kg</TableCell>
                        <TableCell>{pr.reps}</TableCell>
                        <TableCell>{new Date(pr.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge className={getIntensityColor(pr.intensity)}>
                            {pr.intensity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

