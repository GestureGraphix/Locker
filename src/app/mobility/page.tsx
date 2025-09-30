"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  Plus, 
  Play, 
  Clock,
  Target,
  Calendar,
  BookOpen,
  Zap,
  Award,
  TrendingUp
} from "lucide-react"

// Mock data
const mockExercises = [
  { 
    id: 1, 
    group: "back", 
    name: "Cat-Cow Stretch", 
    youtubeUrl: "https://youtube.com/watch?v=example1", 
    prescription: "10 reps, hold 5 seconds each",
    thumbnail: "🧘‍♀️"
  },
  { 
    id: 2, 
    group: "hips", 
    name: "Hip Flexor Stretch", 
    youtubeUrl: "https://youtube.com/watch?v=example2", 
    prescription: "Hold 30 seconds each side",
    thumbnail: "🤸‍♂️"
  },
  { 
    id: 3, 
    group: "hamstrings", 
    name: "Forward Fold", 
    youtubeUrl: "https://youtube.com/watch?v=example3", 
    prescription: "Hold 45 seconds, 3 sets",
    thumbnail: "🧘‍♂️"
  },
  { 
    id: 4, 
    group: "quads", 
    name: "Quad Stretch", 
    youtubeUrl: "https://youtube.com/watch?v=example4", 
    prescription: "Hold 30 seconds each leg",
    thumbnail: "🏃‍♂️"
  },
  { 
    id: 5, 
    group: "ankles", 
    name: "Ankle Circles", 
    youtubeUrl: "https://youtube.com/watch?v=example5", 
    prescription: "10 circles each direction",
    thumbnail: "🦶"
  },
  { 
    id: 6, 
    group: "back", 
    name: "Thoracic Extension", 
    youtubeUrl: "https://youtube.com/watch?v=example6", 
    prescription: "15 reps, 2 sets",
    thumbnail: "🧘‍♀️"
  }
]

const mockMobilityLogs = [
  { 
    id: 1, 
    exerciseId: 1, 
    exerciseName: "Cat-Cow Stretch", 
    date: "2024-01-15", 
    durationMin: 5, 
    notes: "Felt tight in lower back"
  },
  { 
    id: 2, 
    exerciseId: 2, 
    exerciseName: "Hip Flexor Stretch", 
    date: "2024-01-15", 
    durationMin: 8, 
    notes: "Right side tighter than left"
  },
  { 
    id: 3, 
    exerciseId: 3, 
    exerciseName: "Forward Fold", 
    date: "2024-01-14", 
    durationMin: 10, 
    notes: "Good flexibility today"
  },
  { 
    id: 4, 
    exerciseId: 4, 
    exerciseName: "Quad Stretch", 
    date: "2024-01-14", 
    durationMin: 6, 
    notes: "Post-workout stretch"
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

const getGroupColor = (group: string) => {
  switch (group) {
    case "back": return "bg-blue-100 text-blue-800 border-blue-200"
    case "hips": return "bg-green-100 text-green-800 border-green-200"
    case "hamstrings": return "bg-purple-100 text-purple-800 border-purple-200"
    case "quads": return "bg-orange-100 text-orange-800 border-orange-200"
    case "ankles": return "bg-pink-100 text-pink-800 border-pink-200"
    default: return "bg-gray-100 text-gray-800 border-gray-200"
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
  const [exercises, setExercises] = useState(mockExercises)
  const [mobilityLogs, setMobilityLogs] = useState(mockMobilityLogs)
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false)
  const [isLogExerciseOpen, setIsLogExerciseOpen] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<typeof exercises[0] | null>(null)
  const [newExercise, setNewExercise] = useState({
    group: "back",
    name: "",
    youtubeUrl: "",
    prescription: ""
  })
  const [newLog, setNewLog] = useState({
    exerciseId: "",
    durationMin: "",
    notes: ""
  })

  const handleAddExercise = () => {
    if (newExercise.name && newExercise.prescription) {
      const exercise = {
        id: exercises.length + 1,
        ...newExercise,
        thumbnail: getGroupIcon(newExercise.group)
      }
      setExercises(prev => [...prev, exercise])
      setNewExercise({ group: "back", name: "", youtubeUrl: "", prescription: "" })
      setIsAddExerciseOpen(false)
    }
  }

  const handleLogExercise = () => {
    if (newLog.exerciseId && newLog.durationMin) {
      const exercise = exercises.find(e => e.id === parseInt(newLog.exerciseId))
      const log = {
        id: mobilityLogs.length + 1,
        exerciseId: parseInt(newLog.exerciseId),
        exerciseName: exercise?.name || "",
        date: new Date().toISOString().split('T')[0],
        durationMin: parseInt(newLog.durationMin),
        notes: newLog.notes
      }
      setMobilityLogs(prev => [...prev, log])
      setNewLog({ exerciseId: "", durationMin: "", notes: "" })
      setIsLogExerciseOpen(false)
    }
  }

  const openLogDialog = (exercise: typeof exercises[0]) => {
    setSelectedExercise(exercise)
    setNewLog(prev => ({ ...prev, exerciseId: exercise.id.toString() }))
    setIsLogExerciseOpen(true)
  }

  const exercisesByGroup = exerciseGroups.map(group => ({
    ...group,
    exercises: exercises.filter(exercise => exercise.group === group.name)
  }))

  const totalMinutesThisWeek = mobilityLogs.reduce((sum, log) => {
    const logDate = new Date(log.date)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return logDate >= weekAgo ? sum + log.durationMin : sum
  }, 0)

  const uniqueExercisesThisWeek = new Set(
    mobilityLogs
      .filter(log => {
        const logDate = new Date(log.date)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return logDate >= weekAgo
      })
      .map(log => log.exerciseId)
  ).size

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mobility</h1>
          <p className="text-muted-foreground">Exercise library and movement tracking</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddExerciseOpen} onOpenChange={setIsAddExerciseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Exercise</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Body Area</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={newExercise.group}
                    onChange={(e) => setNewExercise(prev => ({ ...prev, group: e.target.value }))}
                  >
                    {exerciseGroups.map(group => (
                      <option key={group.name} value={group.name}>
                        {group.icon} {group.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Exercise Name</label>
                  <Input 
                    value={newExercise.name}
                    onChange={(e) => setNewExercise(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Cat-Cow Stretch"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">YouTube URL (optional)</label>
                  <Input 
                    value={newExercise.youtubeUrl}
                    onChange={(e) => setNewExercise(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Prescription</label>
                  <Input 
                    value={newExercise.prescription}
                    onChange={(e) => setNewExercise(prev => ({ ...prev, prescription: e.target.value }))}
                    placeholder="e.g., 10 reps, hold 5 seconds each"
                  />
                </div>
                <Button onClick={handleAddExercise} className="w-full">
                  Add Exercise
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isLogExerciseOpen} onOpenChange={setIsLogExerciseOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Log Exercise
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Exercise Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Exercise</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={newLog.exerciseId}
                    onChange={(e) => setNewLog(prev => ({ ...prev, exerciseId: e.target.value }))}
                  >
                    <option value="">Select an exercise</option>
                    {exercises.map(exercise => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name} ({exercise.group})
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
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Input 
                    value={newLog.notes}
                    onChange={(e) => setNewLog(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="How did it feel?"
                  />
                </div>
                <Button onClick={handleLogExercise} className="w-full">
                  Log Exercise
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
                <p className="text-sm font-medium">Total Exercises</p>
                <p className="text-2xl font-bold">{exercises.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">This Week</p>
                <p className="text-2xl font-bold">{totalMinutesThisWeek}m</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Exercises Done</p>
                <p className="text-2xl font-bold">{uniqueExercisesThisWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Avg Session</p>
                <p className="text-2xl font-bold">8m</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="library" className="space-y-4">
        <TabsList>
          <TabsTrigger value="library">Exercise Library</TabsTrigger>
          <TabsTrigger value="logs">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-6">
          {exercisesByGroup.map(group => (
            group.exercises.length > 0 && (
              <div key={group.name}>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-2xl">{group.icon}</span>
                  {group.label}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.exercises.map(exercise => (
                    <Card key={exercise.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{exercise.name}</CardTitle>
                          <span className="text-2xl">{exercise.thumbnail}</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">{exercise.prescription}</p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => openLogDialog(exercise)}
                            className="flex-1"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Log Session
                          </Button>
                          {exercise.youtubeUrl && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={exercise.youtubeUrl} target="_blank" rel="noopener noreferrer">
                                <BookOpen className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          ))}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <Card>
              <CardContent className="p-0">
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
                        <TableCell>{new Date(log.date).toLocaleDateString()}</TableCell>
                        <TableCell>{log.durationMin} minutes</TableCell>
                        <TableCell className="max-w-xs truncate">{log.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card className="border-accent/20 bg-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-accent-foreground">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-20 flex-col gap-2">
              <span className="text-2xl">🧘‍♀️</span>
              <span>Morning Routine</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <span className="text-2xl">🏃‍♂️</span>
              <span>Pre-Workout</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <span className="text-2xl">🛌</span>
              <span>Evening Wind-down</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

