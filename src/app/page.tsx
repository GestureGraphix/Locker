"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { NumberScale } from "@/components/number-scale"
import { Tile } from "@/components/tile"
import {
  BookOpen,
  Dumbbell,
  Apple,
  Activity,
  User,
  Calendar,
  Clock,
  Droplets,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Plus,
  Zap,
  Award,
  Sparkles,
  BarChart3,
  Flame,
  Heart,
  Brain,
  Star,
  Trophy,
  Timer,
  Battery,
  Activity as ActivityIcon,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  RotateCcw
} from "lucide-react"
import { cn } from "@/lib/utils"

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
  },
  performanceMetrics: {
    strength: 85,
    endurance: 78,
    flexibility: 65,
    mental: 92
  }
}

export default function DashboardPage() {
  const [mentalState, setMentalState] = useState<number | null>(mockData.checkIn.mental)
  const [physicalState, setPhysicalState] = useState<number | null>(mockData.checkIn.physical)
  const [checkInCompleted, setCheckInCompleted] = useState(mockData.checkIn.completed)

  const handleCheckIn = () => {
    if (mentalState && physicalState) {
      setCheckInCompleted(true)
      console.log("Daily Check-in completed:", { mentalState, physicalState })
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 px-3 py-1">High</Badge>
      case "medium":
        return <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 px-3 py-1">Medium</Badge>
      case "low":
        return <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 px-3 py-1">Low</Badge>
      default:
        return <Badge variant="secondary">{priority}</Badge>
    }
  }

  const getSessionIntensityBadge = (intensity: string) => {
    switch (intensity) {
      case "high":
        return <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 px-3 py-1">High</Badge>
      case "medium":
        return <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 px-3 py-1">Medium</Badge>
      case "low":
        return <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 px-3 py-1">Low</Badge>
      default:
        return <Badge variant="secondary">{intensity}</Badge>
    }
  }

  const hydrationProgress = (mockData.todayStats.hydration / mockData.todayStats.hydrationGoal) * 100

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-3xl blur-3xl"></div>
            <div className="relative glass-card rounded-3xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-2">
                    Good morning, Alex! 👋
                  </h1>
                  <p className="text-xl text-gray-600 font-medium">Ready to tackle another day?</p>
                  <div className="flex items-center mt-4 space-x-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-600 font-medium">All systems optimal</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Battery className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-600 font-medium">87% energy</span>
                    </div>
                  </div>
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
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 px-4 py-2">
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
            <Button
              onClick={handleCheckIn}
              disabled={checkInCompleted || !mentalState || !physicalState}
              className="w-full h-14 text-lg font-bold gradient-primary hover:shadow-glow text-white border-0 rounded-2xl transition-all duration-300 hover:scale-105"
            >
              {checkInCompleted ? (
                <>
                  <CheckCircle2 className="h-6 w-6 mr-3" />
                  Check-in Complete! 🎉
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-6 w-6 mr-3" />
                  Complete Check-in
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Performance Metrics
            </h2>
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
                <p className="text-sm font-semibold text-gray-600 mb-2">Strength</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">{mockData.performanceMetrics.strength}%</p>
                <Progress value={mockData.performanceMetrics.strength} className="h-2" />
                <p className="text-xs text-green-600 font-semibold mt-2">+5% this week</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-success flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <ActivityIcon className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Endurance</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">{mockData.performanceMetrics.endurance}%</p>
                <Progress value={mockData.performanceMetrics.endurance} className="h-2" />
                <p className="text-xs text-green-600 font-semibold mt-2">+3% this week</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-warning flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <Activity className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Flexibility</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">{mockData.performanceMetrics.flexibility}%</p>
                <Progress value={mockData.performanceMetrics.flexibility} className="h-2" />
                <p className="text-xs text-yellow-600 font-semibold mt-2">Needs attention</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-secondary flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Mental</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">{mockData.performanceMetrics.mental}%</p>
                <Progress value={mockData.performanceMetrics.mental} className="h-2" />
                <p className="text-xs text-green-600 font-semibold mt-2">Excellent!</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* What's in your locker? */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              What&apos;s in your locker?
            </h2>
            <Button variant="outline" className="glass-card border-white/20 hover:bg-white/50">
              View all <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Tile
              title="Academics"
              description="Track assignments and exams"
              href="/academics"
              icon={BookOpen}
            />
            <Tile
              title="Training"
              description="Log sessions and PRs"
              href="/training"
              icon={Dumbbell}
            />
            <Tile
              title="Fuel"
              description="Hydration and nutrition"
              href="/fuel"
              icon={Apple}
            />
            <Tile
              title="Mobility"
              description="Exercise library"
              href="/mobility"
              icon={Activity}
            />
            <Tile
              title="Account"
              description="Profile and settings"
              href="/account"
              icon={User}
            />
          </div>
        </div>

        {/* Today's Progress & Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Zap className="h-6 w-6 text-blue-600" />
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
                      <p className="text-3xl font-bold text-gray-900">{mockData.todayStats.hydration}oz</p>
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
                    <p className="text-3xl font-bold text-gray-900">{mockData.todayStats.mealsLogged}</p>
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
                    <p className="text-3xl font-bold text-gray-900">{mockData.todayStats.sessionsCompleted}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              Upcoming
            </h3>
            
            <Card className="glass-card border-0 shadow-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-gray-900 flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                  Academics Due
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockData.upcomingItems.map((item) => (
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
                  View All ({mockData.todayStats.academicItemsDue})
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-gray-900 flex items-center gap-3">
                  <Dumbbell className="h-6 w-6 text-blue-600" />
                  Today&apos;s Training
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockData.todaysSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-5 rounded-2xl glass-card border border-white/20 hover:bg-white/50 transition-all duration-300">
                    <div className="flex items-center space-x-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        session.completed ? "gradient-success" : "bg-gray-100"
                      )}>
                        <Dumbbell className={cn(
                          "h-6 w-6",
                          session.completed ? "text-white" : "text-gray-400"
                        )} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{session.title}</p>
                        <p className="text-sm text-gray-600">{session.time}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-500">{session.calories} cal</span>
                          <span className="text-xs text-gray-500">{session.heartRate} bpm</span>
                        </div>
                      </div>
                    </div>
                    {getSessionIntensityBadge(session.intensity)}
                  </div>
                ))}
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
                <p className="text-4xl font-bold text-gray-900 mb-2">{mockData.weeklyStats.sessions}</p>
                <p className="text-xs text-green-600 font-semibold">+2 from last week</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-warning flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <Award className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">PRs Set</p>
                <p className="text-4xl font-bold text-gray-900 mb-2">{mockData.weeklyStats.prsSet}</p>
                <p className="text-xs text-green-600 font-semibold">New records!</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-success flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <Droplets className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Hydration Avg</p>
                <p className="text-4xl font-bold text-gray-900 mb-2">{mockData.weeklyStats.hydrationAvg}%</p>
                <p className="text-xs text-green-600 font-semibold">Good consistency</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-secondary flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <BookOpen className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Assignments</p>
                <p className="text-4xl font-bold text-gray-900 mb-2">{mockData.weeklyStats.assignments}</p>
                <p className="text-xs text-green-600 font-semibold">5 completed</p>
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
                <span className="font-bold text-gray-900">{mockData.todayStats.hydration}oz consumed</span>
                <span className="text-gray-600">{mockData.todayStats.hydrationGoal}oz goal</span>
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