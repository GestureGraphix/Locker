"use client"

import { ChangeEvent, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BookOpen,
  Plus,
  Calendar,
  FileText,
  GraduationCap,
  AlertCircle,
  CheckCircle
} from "lucide-react"

type ManualItemType = "assignment" | "exam" | "reading" | "essay"
type AcademicItemType = ManualItemType | "calendar"

type AcademicItem = {
  id: number
  courseId?: number
  course: string
  type: AcademicItemType
  title: string
  dueAt: string
  notes?: string
  completed: boolean
  source: "manual" | "ics"
  externalId?: string
}

type NewItem = {
  courseId: string
  type: ManualItemType
  title: string
  dueAt: string
  notes: string
}

type RawIcsEvent = Record<string, string>

type Course = {
  id: number
  name: string
  code: string
  professor: string
  source?: "manual" | "ics"
}

const decodeIcsText = (value: string) =>
  value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")

const parseIcsContent = (content: string): RawIcsEvent[] => {
  const unfolded = content.replace(/\r?\n[ \t]/g, "")
  const lines = unfolded.split(/\r?\n/)
  const events: RawIcsEvent[] = []
  let current: RawIcsEvent | null = null

  for (const line of lines) {
    if (!line) continue
    if (line.startsWith("BEGIN:VEVENT")) {
      current = {}
      continue
    }

    if (line.startsWith("END:VEVENT")) {
      if (current) {
        events.push(current)
      }
      current = null
      continue
    }

    if (current && line.includes(":")) {
      const [key, ...rest] = line.split(":")
      const value = rest.join(":")
      if (!value) continue
      const keyName = key.split(";")[0]
      current[keyName] = value
    }
  }

  return events
}

const parseCourseDetails = (summary: string) => {
  const cleanSummary = summary.trim()
  const match = cleanSummary.match(/^([A-Z]{2,4}\s?\d{3}[A-Z]?)/)

  if (match?.[1]) {
    const code = match[1].replace(/\s+/, " ")
    const remainder = cleanSummary.slice(match[0].length).replace(/^[-–:\s]+/, "")
    return {
      code,
      name: remainder || code
    }
  }

  const fallback = cleanSummary || "Imported Course"
  return {
    code: fallback,
    name: fallback
  }
}

const extractProfessorFromEvent = (event: RawIcsEvent) => {
  const descriptionRaw = event["DESCRIPTION"]
  if (descriptionRaw) {
    const decoded = decodeIcsText(descriptionRaw)
    const professorMatch = decoded.match(/(?:Professor|Instructor)[:\-]\s*(.+)/i)
    if (professorMatch?.[1]) {
      return professorMatch[1].trim()
    }

    const firstLine = decoded
      .split(/\n+/)
      .map(line => line.trim())
      .find(Boolean)

    if (firstLine) {
      return firstLine
    }
  }

  const locationRaw = event["LOCATION"]
  if (locationRaw) {
    const location = decodeIcsText(locationRaw).trim()
    if (location) {
      return location
    }
  }

  return "Instructor TBA"
}

const mergeIcsCourses = (rawEvents: RawIcsEvent[], existingCourses: Course[]) => {
  const existingKeys = new Set(
    existingCourses.map(course => `${course.code.toLowerCase()}|${course.name.toLowerCase()}`)
  )

  let nextId = existingCourses.reduce((max, course) => Math.max(max, course.id), 0) + 1
  const newCourses: Course[] = []

  for (const rawEvent of rawEvents) {
    const summaryRaw = rawEvent["SUMMARY"]
    if (!summaryRaw) continue

    const summary = decodeIcsText(summaryRaw).trim()
    if (!summary) continue

    const { code, name } = parseCourseDetails(summary)
    const identifier = `${code.toLowerCase()}|${name.toLowerCase()}`

    if (existingKeys.has(identifier)) {
      continue
    }

    existingKeys.add(identifier)

    newCourses.push({
      id: nextId++,
      code,
      name,
      professor: extractProfessorFromEvent(rawEvent),
      source: "ics"
    })
  }

  return { courses: [...existingCourses, ...newCourses], added: newCourses.length }
}

// Mock data
const mockCourses: Course[] = [
  { id: 1, name: "Calculus II", code: "MATH 201", professor: "Dr. Smith", source: "manual" },
  { id: 2, name: "Physics I", code: "PHYS 101", professor: "Dr. Johnson", source: "manual" },
  { id: 3, name: "Biomechanics", code: "KIN 301", professor: "Dr. Williams", source: "manual" },
  { id: 4, name: "Sports Psychology", code: "PSYC 250", professor: "Dr. Brown", source: "manual" }
]

const mockAcademicItems: AcademicItem[] = [
  {
    id: 1,
    courseId: 1,
    course: "MATH 201",
    type: "exam",
    title: "Midterm Exam",
    dueAt: "2024-01-15T14:00:00Z",
    notes: "Chapters 1-5, bring calculator",
    completed: false,
    source: "manual"
  },
  {
    id: 2,
    courseId: 2,
    course: "PHYS 101",
    type: "assignment",
    title: "Lab Report #3",
    dueAt: "2024-01-16T23:59:00Z",
    notes: "Kinematics experiment",
    completed: false,
    source: "manual"
  },
  {
    id: 3,
    courseId: 3,
    course: "KIN 301",
    type: "reading",
    title: "Chapter 5: Biomechanics",
    dueAt: "2024-01-19T09:00:00Z",
    notes: "Focus on joint mechanics",
    completed: true,
    source: "manual"
  },
  {
    id: 4,
    courseId: 4,
    course: "PSYC 250",
    type: "essay",
    title: "Motivation in Sports",
    dueAt: "2024-01-22T23:59:00Z",
    notes: "1500 words, APA format",
    completed: false,
    source: "manual"
  }
]

const getTypeIcon = (type: string) => {
  switch (type) {
    case "exam": return <FileText className="h-4 w-4" />
    case "assignment": return <BookOpen className="h-4 w-4" />
    case "reading": return <BookOpen className="h-4 w-4" />
    case "essay": return <FileText className="h-4 w-4" />
    case "calendar": return <Calendar className="h-4 w-4" />
    default: return <BookOpen className="h-4 w-4" />
  }
}

const getTypeColor = (type: string) => {
  switch (type) {
    case "exam": return "bg-[#d9e3f5] text-[#0f4d92] border-[#b3c7e6]"
    case "assignment": return "bg-[#e4f1ff] text-[#12467f] border-[#c5ddf5]"
    case "reading": return "bg-[#edf2fa] text-[#123a70] border-[#c7d7ee]"
    case "essay": return "bg-[#c7dbf3] text-[#0f2f5b] border-[#a8c2e5]"
    case "calendar": return "bg-[#f2f6fb] text-[#1c4f8f] border-[#d7e3f5]"
    default: return "bg-[#e8f0fb] text-[#123a70] border-[#c7d7ee]"
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return "Overdue"
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  return `In ${diffDays} days`
}

export default function Academics() {
  const [courses, setCourses] = useState(mockCourses)
  const [academicItems, setAcademicItems] = useState<AcademicItem[]>(mockAcademicItems)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [newItem, setNewItem] = useState<NewItem>({
    courseId: "",
    type: "assignment",
    title: "",
    dueAt: "",
    notes: ""
  })

  const handleAddItem = () => {
    if (newItem.courseId && newItem.title && newItem.dueAt) {
      setAcademicItems(prev => {
        const course = courses.find(c => c.id === parseInt(newItem.courseId))
        const nextId = prev.reduce((max, item) => Math.max(max, item.id), 0) + 1
        const item: AcademicItem = {
          id: nextId,
          courseId: parseInt(newItem.courseId),
          course: course?.code ?? "General",
          type: newItem.type,
          title: newItem.title,
          dueAt: newItem.dueAt,
          notes: newItem.notes,
          completed: false,
          source: "manual"
        }
        return [...prev, item]
      })
      setNewItem({ courseId: "", type: "assignment", title: "", dueAt: "", notes: "" })
      setIsAddDialogOpen(false)
    }
  }

  const handleScheduleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : ""
        const rawEvents = parseIcsContent(text)
        let addedCount = 0

        setCourses(prev => {
          const { courses: mergedCourses, added } = mergeIcsCourses(rawEvents, prev)
          addedCount = added
          return mergedCourses
        })

        if (addedCount > 0) {
          setImportStatus(`Imported ${addedCount} new course${addedCount > 1 ? "s" : ""}.`)
        } else {
          setImportStatus("No new courses found in the uploaded schedule.")
        }
      } catch {
        setImportStatus("We couldn't process that calendar file. Please try again.")
      }
    }

    reader.onerror = () => {
      setImportStatus("We couldn't read that file. Please try again.")
    }

    reader.readAsText(file)
    event.target.value = ""
  }

  const toggleComplete = (id: number) => {
    setAcademicItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    )
  }

  const upcomingItems = academicItems
    .filter(item => !item.completed)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())

  const overdueItems = academicItems.filter(item => 
    !item.completed && new Date(item.dueAt) < new Date()
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Academics</h1>
          <p className="text-muted-foreground">Track your courses, assignments, and exams</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog
            open={isImportDialogOpen}
            onOpenChange={(open) => {
              setIsImportDialogOpen(open)
              if (open) {
                setImportStatus(null)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Import Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Schedule (.ics)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload an iCalendar (.ics) file to automatically add courses from your schedule.
                </p>
                <Input
                  type="file"
                  accept=".ics,text/calendar"
                  onChange={handleScheduleUpload}
                />
                {importStatus && (
                  <p className="text-sm text-muted-foreground">{importStatus}</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Academic Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Course</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newItem.courseId}
                    onChange={(e) => setNewItem(prev => ({ ...prev, courseId: e.target.value }))}
                  >
                    <option value="">Select a course</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newItem.type}
                    onChange={(e) => setNewItem(prev => ({ ...prev, type: e.target.value as ManualItemType }))}
                  >
                    <option value="assignment">Assignment</option>
                    <option value="exam">Exam</option>
                    <option value="reading">Reading</option>
                    <option value="essay">Essay</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={newItem.title}
                    onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Due Date</label>
                  <Input
                    type="datetime-local"
                    value={newItem.dueAt}
                    onChange={(e) => setNewItem(prev => ({ ...prev, dueAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Input
                    value={newItem.notes}
                    onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes"
                  />
                </div>
                <Button onClick={handleAddItem} className="w-full">
                  Add Item
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
              <GraduationCap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Courses</p>
                <p className="text-2xl font-bold">{courses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-[#0f4d92]" />
              <div>
                <p className="text-sm font-medium">Total Items</p>
                <p className="text-2xl font-bold">{academicItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-[#123d73]" />
              <div>
                <p className="text-sm font-medium">Overdue</p>
                <p className="text-2xl font-bold">{overdueItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-[#1c6dd0]" />
              <div>
                <p className="text-sm font-medium">Completed</p>
                <p className="text-2xl font-bold">
                  {academicItems.filter(item => item.completed).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Courses */}
      <div>
        <h2 className="text-xl font-semibold mb-4">My Courses</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {courses.map(course => (
            <Card key={course.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{course.code}</CardTitle>
                <p className="text-sm text-muted-foreground">{course.name}</p>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{course.professor}</p>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    {academicItems.filter(item => item.courseId === course.id).length} items
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Upcoming Items */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Upcoming Items</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.course}</TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(item.type)}>
                        <span className="flex items-center gap-1">
                          {getTypeIcon(item.type)}
                          {item.type}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className={formatDate(item.dueAt) === "Overdue" ? "text-[#123d73] font-semibold" : ""}>
                          {formatDate(item.dueAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.completed ? "default" : "secondary"}>
                        {item.completed ? "Completed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleComplete(item.id)}
                      >
                        {item.completed ? "Undo" : "Complete"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Items Alert */}
      {overdueItems.length > 0 && (
        <Card className="border-[#b3c7e6] bg-[#eef5ff]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0f4d92]">
              <AlertCircle className="h-5 w-5" />
              Overdue Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#c7d7ee]">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.course}</p>
                  </div>
                  <Badge className="bg-[#d9e3f5] text-[#0f2f5b] border-[#b3c7e6]">
                    Overdue
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

