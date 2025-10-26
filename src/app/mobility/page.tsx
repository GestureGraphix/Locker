"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  Plus,
  Play,
  Clock,
  TrendingUp,
  ListChecks,
  Dumbbell,
  ChevronDown,
} from "lucide-react"
import { useRole } from "@/components/role-context"

const mockExercises = [
  {
    id: 1,
    group: "back",
    name: "Cat-Cow Stretch",
    youtubeUrl: "https://youtube.com/watch?v=example1",
    prescription: "10 reps, hold 5 seconds each",
    thumbnail: "🧘‍♀️",
  },
  {
    id: 2,
    group: "hips",
    name: "Hip Flexor Stretch",
    youtubeUrl: "https://youtube.com/watch?v=example2",
    prescription: "Hold 30 seconds each side",
    thumbnail: "🤸‍♂️",
  },
  {
    id: 3,
    group: "hamstrings",
    name: "Forward Fold",
    youtubeUrl: "https://youtube.com/watch?v=example3",
    prescription: "Hold 45 seconds, 3 sets",
    thumbnail: "🧘‍♂️",
  },
  {
    id: 4,
    group: "quads",
    name: "Quad Stretch",
    youtubeUrl: "https://youtube.com/watch?v=example4",
    prescription: "Hold 30 seconds each leg",
    thumbnail: "🏃‍♂️",
  },
  {
    id: 5,
    group: "ankles",
    name: "Ankle Circles",
    youtubeUrl: "https://youtube.com/watch?v=example5",
    prescription: "10 circles each direction",
    thumbnail: "🦶",
  },
  {
    id: 6,
    group: "back",
    name: "Thoracic Extension",
    youtubeUrl: "https://youtube.com/watch?v=example6",
    prescription: "15 reps, 2 sets",
    thumbnail: "🧘‍♀️",
  }
]

const mockMobilityLogs = [
  {
    id: 1,
    exerciseId: 1,
    exerciseName: "Cat-Cow Stretch",
    date: "2024-01-15",
    durationMin: 5,
    notes: "Felt tight in lower back",
  },
  {
    id: 2,
    exerciseId: 2,
    exerciseName: "Hip Flexor Stretch",
    date: "2024-01-15",
    durationMin: 8,
    notes: "Right side tighter than left",
  },
  {
    id: 3,
    exerciseId: 3,
    exerciseName: "Forward Fold",
    date: "2024-01-14",
    durationMin: 10,
    notes: "Good flexibility today",
  },
  {
    id: 4,
    exerciseId: 4,
    exerciseName: "Quad Stretch",
    date: "2024-01-14",
    durationMin: 6,
    notes: "Post-workout stretch",
  }
]

const getGroupIcon = (group: string) => {
  switch (group) {
    case "back": return "🫁"
    case "hips": return "🦴"
    case "hamstrings": return "🦵"
    case "quads": return "🦵"
    case "ankles": return "🦶"
    default: return "🏃‍♂️"
  }
}

const exerciseGroups = [
  { name: "back", label: "Back", icon: "🫁" },
  { name: "hips", label: "Hips", icon: "🦴" },
  { name: "hamstrings", label: "Hamstrings", icon: "🦵" },
  { name: "quads", label: "Quads", icon: "🦵" },
  { name: "ankles", label: "Ankles", icon: "🦶" },
  { name: "other", label: "Other", icon: "🏃‍♂️" }
]

export default function Mobility() {
  const { primaryAthlete, updateMobilityExercises, updateMobilityLogs } = useRole()
  const exercises = primaryAthlete?.mobilityExercises ?? mockExercises
  const mobilityLogs = primaryAthlete?.mobilityLogs ?? mockMobilityLogs
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false)
  const [isLogExerciseOpen, setIsLogExerciseOpen] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [newExercise, setNewExercise] = useState({
    group: "back",
    name: "",
    youtubeUrl: "",
    prescription: "",
  })
  const [newLog, setNewLog] = useState({
    exerciseId: "",
    durationMin: "",
    notes: "",
  })

  const handleAddExercise = () => {
    if (!newExercise.name || !newExercise.prescription) return
    if (!primaryAthlete) return
    const nextId = (exercises.length > 0 ? Math.max(...exercises.map((exercise) => exercise.id)) : 0) + 1
    const exercise = {
      id: nextId,
      ...newExercise,
      thumbnail: getGroupIcon(newExercise.group),
    }

    updateMobilityExercises(primaryAthlete.id, (prev) => [...prev, exercise])

    setNewExercise({ group: "back", name: "", youtubeUrl: "", prescription: "" })
    setIsAddExerciseOpen(false)
  }

  const handleLogExercise = () => {
    if (!newLog.exerciseId || !newLog.durationMin) return
    if (!primaryAthlete) return

    const exerciseId = Number.parseInt(newLog.exerciseId, 10)
    if (!Number.isFinite(exerciseId) || exerciseId <= 0) return
    const duration = Number.parseInt(newLog.durationMin, 10)
    if (!Number.isFinite(duration) || duration < 0) return

    const exercise = exercises.find((entry) => entry.id === exerciseId)
    const nextId =
      (mobilityLogs.length > 0 ? Math.max(...mobilityLogs.map((log) => log.id)) : 0) + 1
    const log = {
      id: nextId,
      exerciseId,
      exerciseName: exercise?.name ?? "",
      date: new Date().toISOString().split("T")[0],
      durationMin: Math.max(0, duration),
      notes: newLog.notes,
    }

    updateMobilityLogs(primaryAthlete.id, (prev) => [...prev, log])

    setNewLog({ exerciseId: "", durationMin: "", notes: "" })
    setIsLogExerciseOpen(false)
  }

  const openLogDialog = (exercise: (typeof exercises)[number]) => {
    setNewLog(prev => ({ ...prev, exerciseId: exercise.id.toString() }))
    setIsLogExerciseOpen(true)
  }

  const exercisesByGroup = exerciseGroups.map(group => ({
    ...group,
    exercises: exercises.filter(exercise => exercise.group === group.name),
  }))

  const totalMinutes = mobilityLogs.reduce((sum, log) => sum + (log.durationMin || 0), 0)
  const sessionsLogged = mobilityLogs.length
  const activeGroups = exercisesByGroup.filter(group => group.exercises.length > 0).length

  const toggleGroup = (groupName: string) => {
    setExpandedGroup(prev => (prev === groupName ? null : groupName))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Mobility</h1>
          <p className="text-muted-foreground">Build your custom mobility routines and log recovery work</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Dialog open={isAddExerciseOpen} onOpenChange={setIsAddExerciseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Mobility Exercise</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Muscle Group</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newExercise.group}
                    onChange={(e) => setNewExercise(prev => ({ ...prev, group: e.target.value }))}
                  >
                    {exerciseGroups.map(group => (
                      <option key={group.name} value={group.name}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Exercise Name</label>
                  <Input
                    value={newExercise.name}
                    onChange={(e) => setNewExercise(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="90/90 Hip Stretch"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Prescription</label>
                  <Input
                    value={newExercise.prescription}
                    onChange={(e) => setNewExercise(prev => ({ ...prev, prescription: e.target.value }))}
                    placeholder="Hold 30 seconds each side"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">YouTube Link</label>
                  <Input
                    value={newExercise.youtubeUrl}
                    onChange={(e) => setNewExercise(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                    placeholder="https://youtube.com/..."
                  />
                </div>
                <Button onClick={handleAddExercise} className="w-full">
                  Save Exercise
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isLogExerciseOpen} onOpenChange={setIsLogExerciseOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Activity className="h-4 w-4 mr-2" />
                Log Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Mobility Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Exercise</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newLog.exerciseId}
                    onChange={(e) => setNewLog(prev => ({ ...prev, exerciseId: e.target.value }))}
                  >
                    <option value="">Select exercise</option>
                    {exercises.map(exercise => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={newLog.durationMin}
                    onChange={(e) => setNewLog(prev => ({ ...prev, durationMin: e.target.value }))}
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    value={newLog.notes}
                    onChange={(e) => setNewLog(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="How did the session feel?"
                  />
                </div>
                <Button onClick={handleLogExercise} className="w-full">
                  Save Log
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium sm:text-sm">Mobility Minutes</p>
                <p className="text-xl font-bold sm:text-2xl">{totalMinutes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-[#0f4d92]" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium sm:text-sm">Sessions Logged</p>
                <p className="text-xl font-bold sm:text-2xl">{sessionsLogged}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <ListChecks className="h-5 w-5 text-[#123d73]" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium sm:text-sm">Library Exercises</p>
                <p className="text-xl font-bold sm:text-2xl">{exercises.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <Dumbbell className="h-5 w-5 text-[#1c6dd0]" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium sm:text-sm">Active Groups</p>
                <p className="text-xl font-bold sm:text-2xl">{activeGroups}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="library" className="space-y-4">
        <TabsList>
          <TabsTrigger value="library">Exercise Library</TabsTrigger>
          <TabsTrigger value="logs">Training Logs</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          <div className="space-y-3 md:hidden">
            {exercisesByGroup.map(group => (
              <Card key={group.name}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{group.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#0f2f5b]">{group.label}</p>
                      <p className="text-xs text-muted-foreground">{group.exercises.length} drills</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      expandedGroup === group.name ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedGroup === group.name && (
                  <CardContent className="pt-0">
                    {group.exercises.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No exercises yet. Add one to get started.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {group.exercises.map(exercise => (
                          <div
                            key={exercise.id}
                            className="flex flex-col gap-2 rounded-lg border bg-gradient-to-br from-white to-[#f5f7fb] p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-1 items-start gap-3">
                                <span className="text-2xl">
                                  {exercise.thumbnail || getGroupIcon(group.name)}
                                </span>
                                <div className="space-y-1">
                                  <h3 className="text-sm font-semibold text-[#0f2f5b]">
                                    {exercise.name}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    {exercise.prescription}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openLogDialog(exercise)}
                                className="h-7 px-2 text-primary"
                              >
                                <Play className="h-4 w-4" />
                                <span className="sr-only">Log session</span>
                              </Button>
                            </div>
                            {exercise.youtubeUrl && (
                              <a
                                href={exercise.youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#1c6dd0] hover:underline"
                              >
                                Watch demo
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          <div className="hidden grid-cols-2 gap-3 md:grid md:grid-cols-3 lg:grid-cols-4">
            {exercisesByGroup.map(group => (
              <Card key={group.name} className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <span className="text-2xl">{group.icon}</span>
                      {group.label}
                    </CardTitle>
                    <Badge variant="secondary">{group.exercises.length} drills</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {group.exercises.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No exercises yet. Add one to get started.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {group.exercises.map(exercise => (
                        <div
                          key={exercise.id}
                          className="flex h-full flex-col justify-between rounded-lg border bg-gradient-to-br from-white to-[#f5f7fb] p-3 text-left aspect-square"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-2xl">{exercise.thumbnail || getGroupIcon(group.name)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openLogDialog(exercise)}
                                className="h-7 px-2 text-primary"
                              >
                                <Play className="h-4 w-4" />
                                <span className="sr-only">Log session</span>
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-sm font-semibold text-[#0f2f5b]">{exercise.name}</h3>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {exercise.prescription}
                              </p>
                            </div>
                          </div>
                          {exercise.youtubeUrl && (
                            <a
                              href={exercise.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#1c6dd0] hover:underline"
                            >
                              Watch demo
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Recent Mobility Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {mobilityLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Start logging your mobility work to build a recovery streak.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exercise</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mobilityLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.exerciseName}</TableCell>
                        <TableCell>{log.date}</TableCell>
                        <TableCell>{log.durationMin} min</TableCell>
                        <TableCell>{log.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-[#0f4d92] to-[#123d73] text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5" /> Weekly Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{totalMinutes} min</p>
                <p className="text-sm text-blue-100">Total time logged this week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Suggested Focus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Keep your body moving by building routines around the muscle groups that feel the tightest.
                </p>
                <div className="flex flex-wrap gap-2">
                  {exerciseGroups.map(group => (
                    <span key={group.name} className="px-3 py-1 rounded-full bg-[#eef5ff] text-[#0f2f5b] text-sm">
                      {group.icon} {group.label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
