"use client"

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRole } from "@/components/role-context"
import {
  BookOpen,
  Plus,
  Calendar,
  FileText,
  GraduationCap,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import {
  AcademicItem,
  AcademicItemType,
  Course,
  ManualItemType,
  mockAcademicItems,
  mockCourses,
  ACADEMICS_UPDATED_EVENT,
  getAcademicsStorageKeys
} from "@/lib/academics"
import { isSqlAuth } from "@/lib/auth-mode"

type NewItem = {
  courseId: string
  type: ManualItemType
  title: string
  dueAt: string
  notes: string
}

type EditItemState = {
  id: number
  courseId: string
  courseLabel: string
  type: AcademicItemType
  title: string
  dueAt: string
  notes: string
}

type EditCourseState = {
  id: number
  code: string
  name: string
  professor: string
}

type RawIcsEvent = Record<string, string>

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
  const match = cleanSummary.match(/^([A-Z]{2,4}\s?\d{3,4}[A-Z]?)/)

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

const parseIcsDate = (value?: string) => {
  if (!value) return null
  const raw = value.trim()
  const match = raw.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z|[+-]\d{4})?)?$/
  )

  if (!match) return null

  const [, year, month, day, hour, minute, second, zone] = match
  const y = Number(year)
  const m = Number(month) - 1
  const d = Number(day)

  if (hour !== undefined && minute !== undefined) {
    const h = Number(hour)
    const min = Number(minute)
    const sec = second ? Number(second) : 0

    if (zone === "Z") {
      return new Date(Date.UTC(y, m, d, h, min, sec))
    }

    if (zone && zone !== "Z") {
      const offsetSign = zone.startsWith("+") ? 1 : -1
      const offsetHours = Number(zone.slice(1, 3))
      const offsetMinutes = Number(zone.slice(3, 5))
      const totalOffsetMinutes = offsetSign * (offsetHours * 60 + offsetMinutes)
      const utcMs = Date.UTC(y, m, d, h, min, sec) - totalOffsetMinutes * 60 * 1000
      return new Date(utcMs)
    }

    return new Date(y, m, d, h, min, sec)
  }

  if (zone === "Z") {
    return new Date(Date.UTC(y, m, d))
  }

  return new Date(y, m, d)
}

const formatCourseSchedule = (event: RawIcsEvent) => {
  const start = parseIcsDate(event["DTSTART"])
  if (!start) return null

  const end = parseIcsDate(event["DTEND"])
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" })
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  })

  const weekday = weekdayFormatter.format(start)
  const startTime = timeFormatter.format(start)
  const endTime = end ? timeFormatter.format(end) : null

  const base = `${weekday} · ${startTime}${endTime ? ` – ${endTime}` : ""}`
  const locationRaw = event["LOCATION"]
  if (locationRaw) {
    const location = decodeIcsText(locationRaw).trim()
    if (location) {
      return `${base} @ ${location}`
    }
  }

  return base
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
      schedule: formatCourseSchedule(rawEvent) ?? undefined,
      source: "ics"
    })
  }

  return { courses: [...existingCourses, ...newCourses], added: newCourses.length }
}

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

const formatDateForInput = (value: string) => {
  if (!value) return ""
  if (value.length >= 16 && value.includes("T")) {
    return value.slice(0, 16)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toISOString().slice(0, 16)
}

const manualTypeOptions: { value: ManualItemType; label: string }[] = [
  { value: "assignment", label: "Assignment" },
  { value: "exam", label: "Exam" },
  { value: "reading", label: "Reading" },
  { value: "essay", label: "Essay" }
]

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
  const { currentUser } = useRole()
  const storageKeys = useMemo(
    () => getAcademicsStorageKeys(currentUser),
    [currentUser]
  )

  const [courses, setCourses] = useState<Course[]>([])
  const [academicItems, setAcademicItems] = useState<AcademicItem[]>([])
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
  const [editingItem, setEditingItem] = useState<EditItemState | null>(null)
  const [editingCourse, setEditingCourse] = useState<EditCourseState | null>(null)
  const sqlAuthEnabled = isSqlAuth()
  const [hasInitialized, setHasInitialized] = useState(!sqlAuthEnabled)
  const lastSyncedPayload = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const fallbackCourses = currentUser ? [] : mockCourses
    const fallbackItems = currentUser ? [] : mockAcademicItems

    const storageKeysToCheck = [storageKeys.primary, ...storageKeys.fallbacks]

    const readFromLocalStorage = () => {
      for (const key of storageKeysToCheck) {
        try {
          const stored = window.localStorage.getItem(key)

          if (!stored) {
            continue
          }

          const parsed = JSON.parse(stored) as {
            courses?: Course[]
            academicItems?: AcademicItem[]
          }

          const nextCourses = Array.isArray(parsed.courses)
            ? parsed.courses
            : fallbackCourses
          const nextItems = Array.isArray(parsed.academicItems)
            ? parsed.academicItems
            : fallbackItems

          if (key !== storageKeys.primary) {
            try {
              window.localStorage.setItem(storageKeys.primary, stored)
            } catch (error) {
              console.error("Failed to migrate academics data", error)
            }
          }

          return { courses: nextCourses, items: nextItems }
        } catch (error) {
          console.error("Failed to load academics data", error)
        }
      }

      if (!currentUser) {
        const payload = JSON.stringify({
          courses: fallbackCourses,
          academicItems: fallbackItems
        })
        try {
          window.localStorage.setItem(storageKeys.primary, payload)
        } catch (error) {
          console.error("Failed to save academics data", error)
        }
      }

      return { courses: fallbackCourses, items: fallbackItems }
    }

    if (!sqlAuthEnabled || !currentUser?.id) {
      const local = readFromLocalStorage()
      setCourses(local.courses)
      setAcademicItems(local.items)
      lastSyncedPayload.current = JSON.stringify({
        courses: local.courses,
        academicItems: local.items
      })
      setHasInitialized(true)
      return
    }

    setHasInitialized(false)

    const local = readFromLocalStorage()
    setCourses(local.courses)
    setAcademicItems(local.items)
    lastSyncedPayload.current = JSON.stringify({
      courses: local.courses,
      academicItems: local.items
    })

    let cancelled = false

    const fetchAcademics = async () => {
      try {
        const response = await fetch("/api/academics", { cache: "no-store" })
        if (!response.ok) {
          console.error("Failed to fetch academics data", response.status)
          return
        }

        let payload: { courses?: Course[]; academicItems?: AcademicItem[] } | null = null
        try {
          payload = (await response.json()) as {
            courses?: Course[]
            academicItems?: AcademicItem[]
          }
        } catch {
          payload = null
        }

        if (cancelled) return

        const rawCourses = payload?.courses
        const rawItems = payload?.academicItems
        const serverCourses = Array.isArray(rawCourses) ? rawCourses : []
        const serverItems = Array.isArray(rawItems) ? rawItems : []

        setCourses(serverCourses)
        setAcademicItems(serverItems)

        const serialized = JSON.stringify({
          courses: serverCourses,
          academicItems: serverItems
        })
        lastSyncedPayload.current = serialized

        try {
          window.localStorage.setItem(storageKeys.primary, serialized)
        } catch (error) {
          console.error("Failed to save academics data", error)
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch academics data", error)
        }
      } finally {
        if (!cancelled) {
          setHasInitialized(true)
        }
      }
    }

    void fetchAcademics()

    return () => {
      cancelled = true
    }
  }, [currentUser, sqlAuthEnabled, storageKeys])

  useEffect(() => {
    if (typeof window === "undefined") return

    const payload = { courses, academicItems }
    const payloadJson = JSON.stringify(payload)

    try {
      window.localStorage.setItem(storageKeys.primary, payloadJson)
    } catch (error) {
      console.error("Failed to save academics data", error)
    }

    window.dispatchEvent(
      new CustomEvent(ACADEMICS_UPDATED_EVENT, {
        detail: { count: academicItems.length }
      })
    )

    if (!hasInitialized) {
      return
    }

    if (!sqlAuthEnabled || !currentUser?.id) {
      lastSyncedPayload.current = payloadJson
      return
    }

    if (lastSyncedPayload.current === payloadJson) {
      return
    }

    const sync = async () => {
      try {
        const response = await fetch("/api/academics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadJson
        })

        if (!response.ok) {
          console.error("Failed to sync academics data", response.status)
          return
        }

        let result: { courses?: Course[]; academicItems?: AcademicItem[] } | null = null
        try {
          result = (await response.json()) as {
            courses?: Course[]
            academicItems?: AcademicItem[]
          }
        } catch {
          result = null
        }

        const resultCourses = result?.courses
        const resultItems = result?.academicItems

        const normalizedCourses = Array.isArray(resultCourses) ? resultCourses : courses
        const normalizedItems = Array.isArray(resultItems) ? resultItems : academicItems

        const normalizedJson = JSON.stringify({
          courses: normalizedCourses,
          academicItems: normalizedItems
        })

        lastSyncedPayload.current = normalizedJson

        if (normalizedJson !== payloadJson) {
          setCourses(normalizedCourses)
          setAcademicItems(normalizedItems)
        }
      } catch (error) {
        console.error("Failed to sync academics data", error)
      }
    }

    void sync()
  }, [
    academicItems,
    courses,
    currentUser?.id,
    hasInitialized,
    sqlAuthEnabled,
    storageKeys
  ])

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

  const startEditingItem = (item: AcademicItem) => {
    setEditingItem({
      id: item.id,
      courseId: item.courseId ? String(item.courseId) : "",
      courseLabel: item.course,
      type: item.type,
      title: item.title,
      dueAt: formatDateForInput(item.dueAt),
      notes: item.notes ?? ""
    })
  }

  const handleUpdateItem = () => {
    if (!editingItem) return
    if (!editingItem.title.trim() || !editingItem.dueAt) {
      return
    }

    const selectedCourse = courses.find(course => course.id === Number(editingItem.courseId))

    setAcademicItems(prev =>
      prev.map(item =>
        item.id === editingItem.id
          ? {
              ...item,
              courseId: selectedCourse ? selectedCourse.id : undefined,
              course: selectedCourse ? selectedCourse.code : editingItem.courseLabel,
              type: editingItem.type,
              title: editingItem.title,
              dueAt: editingItem.dueAt,
              notes: editingItem.notes
            }
          : item
      )
    )

    setEditingItem(null)
  }

  const startEditingCourse = (course: Course) => {
    setEditingCourse({
      id: course.id,
      code: course.code,
      name: course.name,
      professor: course.professor
    })
  }

  const handleUpdateCourse = () => {
    if (!editingCourse) return

    const code = editingCourse.code.trim()
    const name = editingCourse.name.trim()
    const professor = editingCourse.professor.trim()

    if (!code || !name) {
      return
    }

    setCourses(prev =>
      prev.map(course =>
        course.id === editingCourse.id
          ? { ...course, code, name, professor }
          : course
      )
    )

    setAcademicItems(prev =>
      prev.map(item =>
        item.courseId === editingCourse.id
          ? { ...item, course: code }
          : item
      )
    )

    setEditingCourse(null)
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
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg whitespace-nowrap">{course.code}</CardTitle>
                    <p className="text-sm text-muted-foreground">{course.name}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => startEditingCourse(course)}>
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{course.professor}</p>
                {course.schedule && (
                  <p className="text-xs text-muted-foreground mt-1">{course.schedule}</p>
                )}
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
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingItem(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleComplete(item.id)}
                        >
                          {item.completed ? "Undo" : "Complete"}
                        </Button>
                      </div>
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

      <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Course</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={editingItem.courseId}
                  onChange={(e) => {
                    const value = e.target.value
                    setEditingItem(prev => {
                      if (!prev) return prev

                      if (!value) {
                        return { ...prev, courseId: value, courseLabel: "General" }
                      }

                      const selected = courses.find(course => course.id === Number(value))
                      return {
                        ...prev,
                        courseId: value,
                        courseLabel: selected ? selected.code : prev.courseLabel
                      }
                    })
                  }}
                >
                  <option value="">General</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                  {!editingItem.courseId &&
                    editingItem.courseLabel &&
                    editingItem.courseLabel !== "General" &&
                    !courses.find(course => course.code === editingItem.courseLabel) && (
                    <option value="" disabled>
                      {editingItem.courseLabel}
                    </option>
                  )}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={editingItem.type}
                  onChange={(e) =>
                    setEditingItem(prev =>
                      prev
                        ? {
                            ...prev,
                            type: (e.target.value as AcademicItemType) || prev.type
                          }
                        : prev
                    )
                  }
                >
                  {manualTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  {editingItem.type === "calendar" && (
                    <option value="calendar">Calendar</option>
                  )}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editingItem.title}
                  onChange={(e) =>
                    setEditingItem(prev => prev ? { ...prev, title: e.target.value } : prev)
                  }
                  placeholder="Enter title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="datetime-local"
                  value={editingItem.dueAt}
                  onChange={(e) =>
                    setEditingItem(prev => prev ? { ...prev, dueAt: e.target.value } : prev)
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input
                  value={editingItem.notes}
                  onChange={(e) =>
                    setEditingItem(prev => prev ? { ...prev, notes: e.target.value } : prev)
                  }
                  placeholder="Additional notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateItem}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editingCourse !== null} onOpenChange={(open) => !open && setEditingCourse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
          </DialogHeader>
          {editingCourse && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Course Code</label>
                <Input
                  value={editingCourse.code}
                  onChange={(e) =>
                    setEditingCourse(prev => prev ? { ...prev, code: e.target.value } : prev)
                  }
                  placeholder="e.g. MATH 2010"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Course Name</label>
                <Input
                  value={editingCourse.name}
                  onChange={(e) =>
                    setEditingCourse(prev => prev ? { ...prev, name: e.target.value } : prev)
                  }
                  placeholder="Enter course name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Professor</label>
                <Input
                  value={editingCourse.professor}
                  onChange={(e) =>
                    setEditingCourse(prev => prev ? { ...prev, professor: e.target.value } : prev)
                  }
                  placeholder="Enter professor name"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingCourse(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateCourse}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

