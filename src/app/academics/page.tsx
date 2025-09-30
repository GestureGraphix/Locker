"use client"

import { useState } from "react"
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
  Clock, 
  FileText,
  GraduationCap,
  AlertCircle,
  CheckCircle
} from "lucide-react"

// Mock data
const mockCourses = [
  { id: 1, name: "Calculus II", code: "MATH 201", professor: "Dr. Smith" },
  { id: 2, name: "Physics I", code: "PHYS 101", professor: "Dr. Johnson" },
  { id: 3, name: "Biomechanics", code: "KIN 301", professor: "Dr. Williams" },
  { id: 4, name: "Sports Psychology", code: "PSYC 250", professor: "Dr. Brown" }
]

const mockAcademicItems = [
  { 
    id: 1, 
    courseId: 1, 
    course: "MATH 201", 
    type: "exam", 
    title: "Midterm Exam", 
    dueAt: "2024-01-15T14:00:00Z", 
    notes: "Chapters 1-5, bring calculator",
    completed: false
  },
  { 
    id: 2, 
    courseId: 2, 
    course: "PHYS 101", 
    type: "assignment", 
    title: "Lab Report #3", 
    dueAt: "2024-01-16T23:59:00Z", 
    notes: "Kinematics experiment",
    completed: false
  },
  { 
    id: 3, 
    courseId: 3, 
    course: "KIN 301", 
    type: "reading", 
    title: "Chapter 5: Biomechanics", 
    dueAt: "2024-01-19T09:00:00Z", 
    notes: "Focus on joint mechanics",
    completed: true
  },
  { 
    id: 4, 
    courseId: 4, 
    course: "PSYC 250", 
    type: "essay", 
    title: "Motivation in Sports", 
    dueAt: "2024-01-22T23:59:00Z", 
    notes: "1500 words, APA format",
    completed: false
  }
]

const getTypeIcon = (type: string) => {
  switch (type) {
    case "exam": return <FileText className="h-4 w-4" />
    case "assignment": return <BookOpen className="h-4 w-4" />
    case "reading": return <BookOpen className="h-4 w-4" />
    case "essay": return <FileText className="h-4 w-4" />
    default: return <BookOpen className="h-4 w-4" />
  }
}

const getTypeColor = (type: string) => {
  switch (type) {
    case "exam": return "bg-red-100 text-red-800 border-red-200"
    case "assignment": return "bg-blue-100 text-blue-800 border-blue-200"
    case "reading": return "bg-green-100 text-green-800 border-green-200"
    case "essay": return "bg-purple-100 text-purple-800 border-purple-200"
    default: return "bg-gray-100 text-gray-800 border-gray-200"
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
  const [courses] = useState(mockCourses)
  const [academicItems, setAcademicItems] = useState(mockAcademicItems)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newItem, setNewItem] = useState({
    courseId: "",
    type: "assignment",
    title: "",
    dueAt: "",
    notes: ""
  })

  const handleAddItem = () => {
    if (newItem.courseId && newItem.title && newItem.dueAt) {
      const course = courses.find(c => c.id === parseInt(newItem.courseId))
      const item = {
        id: academicItems.length + 1,
        courseId: parseInt(newItem.courseId),
        course: course?.code || "",
        type: newItem.type as any,
        title: newItem.title,
        dueAt: newItem.dueAt,
        notes: newItem.notes,
        completed: false
      }
      setAcademicItems(prev => [...prev, item])
      setNewItem({ courseId: "", type: "assignment", title: "", dueAt: "", notes: "" })
      setIsAddDialogOpen(false)
    }
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
                  onChange={(e) => setNewItem(prev => ({ ...prev, type: e.target.value }))}
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
              <BookOpen className="h-5 w-5 text-blue-600" />
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
              <AlertCircle className="h-5 w-5 text-red-600" />
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
              <CheckCircle className="h-5 w-5 text-green-600" />
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
                        <span className={formatDate(item.dueAt) === "Overdue" ? "text-red-600" : ""}>
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
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              Overdue Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.course}</p>
                  </div>
                  <Badge className="bg-red-100 text-red-800 border-red-200">
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

