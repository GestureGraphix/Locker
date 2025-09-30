"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  Apple, 
  Plus, 
  Droplets, 
  Coffee,
  GlassWater,
  Zap,
  Target,
  TrendingUp,
  Calendar,
  Clock
} from "lucide-react"

// Mock data
const mockHydrationLogs = [
  { id: 1, date: "2024-01-15", ounces: 8, source: "cup", time: "08:00" },
  { id: 2, date: "2024-01-15", ounces: 12, source: "bottle", time: "10:30" },
  { id: 3, date: "2024-01-15", ounces: 8, source: "cup", time: "12:00" },
  { id: 4, date: "2024-01-15", ounces: 17, source: "shake", time: "14:00" },
  { id: 5, date: "2024-01-15", ounces: 8, source: "cup", time: "16:30" }
]

const mockMealLogs = [
  { 
    id: 1, 
    dateTime: "2024-01-15T08:00:00Z", 
    mealType: "breakfast", 
    calories: 450, 
    proteinG: 25, 
    notes: "Oatmeal with berries and protein powder",
    completed: true
  },
  { 
    id: 2, 
    dateTime: "2024-01-15T12:30:00Z", 
    mealType: "lunch", 
    calories: 650, 
    proteinG: 40, 
    notes: "Grilled chicken salad",
    completed: true
  },
  { 
    id: 3, 
    dateTime: "2024-01-15T18:00:00Z", 
    mealType: "dinner", 
    calories: 0, 
    proteinG: 0, 
    notes: "Planned: Salmon with quinoa",
    completed: false
  },
  { 
    id: 4, 
    dateTime: "2024-01-15T15:00:00Z", 
    mealType: "snack", 
    calories: 200, 
    proteinG: 15, 
    notes: "Greek yogurt with nuts",
    completed: true
  }
]

const getMealTypeIcon = (type: string) => {
  switch (type) {
    case "breakfast": return <Coffee className="h-4 w-4" />
    case "lunch": return <Apple className="h-4 w-4" />
    case "dinner": return <Apple className="h-4 w-4" />
    case "snack": return <Zap className="h-4 w-4" />
    default: return <Apple className="h-4 w-4" />
  }
}

const getMealTypeColor = (type: string) => {
  switch (type) {
    case "breakfast": return "bg-orange-100 text-orange-800 border-orange-200"
    case "lunch": return "bg-blue-100 text-blue-800 border-blue-200"
    case "dinner": return "bg-purple-100 text-purple-800 border-purple-200"
    case "snack": return "bg-green-100 text-green-800 border-green-200"
    default: return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getSourceIcon = (source: string) => {
  switch (source) {
    case "cup": return <Coffee className="h-4 w-4" />
    case "bottle": return <GlassWater className="h-4 w-4" />
    case "shake": return <Zap className="h-4 w-4" />
    default: return <Droplets className="h-4 w-4" />
  }
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

export default function Fuel() {
  const [hydrationLogs, setHydrationLogs] = useState(mockHydrationLogs)
  const [mealLogs, setMealLogs] = useState(mockMealLogs)
  const [isAddHydrationOpen, setIsAddHydrationOpen] = useState(false)
  const [isAddMealOpen, setIsAddMealOpen] = useState(false)
  const [newHydration, setNewHydration] = useState({
    ounces: "",
    source: "cup"
  })
  const [newMeal, setNewMeal] = useState({
    mealType: "breakfast",
    calories: "",
    proteinG: "",
    notes: "",
    dateTime: new Date().toISOString()
  })

  const handleAddHydration = () => {
    if (newHydration.ounces) {
      const log = {
        id: hydrationLogs.length + 1,
        date: new Date().toISOString().split('T')[0],
        ounces: parseInt(newHydration.ounces),
        source: newHydration.source,
        time: new Date().toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })
      }
      setHydrationLogs(prev => [...prev, log])
      setNewHydration({ ounces: "", source: "cup" })
      setIsAddHydrationOpen(false)
    }
  }

  const handleAddMeal = () => {
    if (newMeal.mealType && newMeal.calories) {
      const log = {
        id: mealLogs.length + 1,
        ...newMeal,
        calories: parseInt(newMeal.calories),
        proteinG: parseInt(newMeal.proteinG) || 0,
        completed: true
      }
      setMealLogs(prev => [...prev, log])
      setNewMeal({
        mealType: "breakfast",
        calories: "",
        proteinG: "",
        notes: "",
        dateTime: new Date().toISOString()
      })
      setIsAddMealOpen(false)
    }
  }

  const toggleMealComplete = (id: number) => {
    setMealLogs(prev => 
      prev.map(meal => 
        meal.id === id ? { ...meal, completed: !meal.completed } : meal
      )
    )
  }

  const todayHydration = hydrationLogs.reduce((sum, log) => sum + log.ounces, 0)
  const hydrationGoal = 80 // oz
  const hydrationPercentage = Math.round((todayHydration / hydrationGoal) * 100)

  const todayMeals = mealLogs.filter(meal => 
    new Date(meal.dateTime).toDateString() === new Date().toDateString()
  )
  const totalCalories = todayMeals.reduce((sum, meal) => sum + meal.calories, 0)
  const totalProtein = todayMeals.reduce((sum, meal) => sum + meal.proteinG, 0)
  const completedMeals = todayMeals.filter(meal => meal.completed).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fuel</h1>
          <p className="text-muted-foreground">Track your hydration and nutrition</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddHydrationOpen} onOpenChange={setIsAddHydrationOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Hydration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Hydration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Amount (oz)</label>
                  <Input 
                    type="number"
                    value={newHydration.ounces}
                    onChange={(e) => setNewHydration(prev => ({ ...prev, ounces: e.target.value }))}
                    placeholder="8"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Source</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={newHydration.source}
                    onChange={(e) => setNewHydration(prev => ({ ...prev, source: e.target.value }))}
                  >
                    <option value="cup">Cup</option>
                    <option value="bottle">Bottle</option>
                    <option value="shake">Protein Shake</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setNewHydration(prev => ({ ...prev, ounces: "8" }))}
                  >
                    8oz
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setNewHydration(prev => ({ ...prev, ounces: "12" }))}
                  >
                    12oz
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setNewHydration(prev => ({ ...prev, ounces: "17" }))}
                  >
                    17oz
                  </Button>
                </div>
                <Button onClick={handleAddHydration} className="w-full">
                  Log Hydration
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddMealOpen} onOpenChange={setIsAddMealOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Log Meal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Meal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Meal Type</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={newMeal.mealType}
                    onChange={(e) => setNewMeal(prev => ({ ...prev, mealType: e.target.value }))}
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Calories</label>
                    <Input 
                      type="number"
                      value={newMeal.calories}
                      onChange={(e) => setNewMeal(prev => ({ ...prev, calories: e.target.value }))}
                      placeholder="450"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Protein (g)</label>
                    <Input 
                      type="number"
                      value={newMeal.proteinG}
                      onChange={(e) => setNewMeal(prev => ({ ...prev, proteinG: e.target.value }))}
                      placeholder="25"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Input 
                    value={newMeal.notes}
                    onChange={(e) => setNewMeal(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="What did you eat?"
                  />
                </div>
                <Button onClick={handleAddMeal} className="w-full">
                  Log Meal
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
              <Droplets className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Hydration Today</p>
                <p className="text-2xl font-bold">{todayHydration}oz</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Hydration Goal</p>
                <p className="text-2xl font-bold">{hydrationPercentage}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Apple className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Calories Today</p>
                <p className="text-2xl font-bold">{totalCalories}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Protein Today</p>
                <p className="text-2xl font-bold">{totalProtein}g</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hydration Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Hydration Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{todayHydration}oz consumed</span>
              <span>{hydrationGoal}oz goal</span>
            </div>
            <Progress value={hydrationPercentage} className="h-3" />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  const log = {
                    id: hydrationLogs.length + 1,
                    date: new Date().toISOString().split('T')[0],
                    ounces: 8,
                    source: "cup",
                    time: new Date().toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })
                  }
                  setHydrationLogs(prev => [...prev, log])
                }}
              >
                +8oz
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  const log = {
                    id: hydrationLogs.length + 1,
                    date: new Date().toISOString().split('T')[0],
                    ounces: 12,
                    source: "bottle",
                    time: new Date().toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })
                  }
                  setHydrationLogs(prev => [...prev, log])
                }}
              >
                +12oz
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  const log = {
                    id: hydrationLogs.length + 1,
                    date: new Date().toISOString().split('T')[0],
                    ounces: 17,
                    source: "shake",
                    time: new Date().toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })
                  }
                  setHydrationLogs(prev => [...prev, log])
                }}
              >
                +17oz
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="meals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="meals">Meals</TabsTrigger>
          <TabsTrigger value="hydration">Hydration Log</TabsTrigger>
        </TabsList>

        <TabsContent value="meals" className="space-y-4">
          {/* Today's Meals */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Today's Meals</h2>
            <div className="space-y-3">
              {todayMeals.map(meal => (
                <Card key={meal.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {getMealTypeIcon(meal.mealType)}
                        </div>
                        <div>
                          <h3 className="font-semibold capitalize">{meal.mealType}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatTime(meal.dateTime)}
                            </span>
                            <span>{meal.calories} cal</span>
                            <span>{meal.proteinG}g protein</span>
                          </div>
                          {meal.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{meal.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getMealTypeColor(meal.mealType)}>
                          {meal.mealType}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toggleMealComplete(meal.id)}
                        >
                          {meal.completed ? "Undo" : "Complete"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Meal History */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Meals</h2>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Calories</TableHead>
                      <TableHead>Protein</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mealLogs.slice(0, 10).map(meal => (
                      <TableRow key={meal.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMealTypeIcon(meal.mealType)}
                            <span className="capitalize">{meal.mealType}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatTime(meal.dateTime)}</TableCell>
                        <TableCell>{meal.calories}</TableCell>
                        <TableCell>{meal.proteinG}g</TableCell>
                        <TableCell className="max-w-xs truncate">{meal.notes}</TableCell>
                        <TableCell>
                          <Badge variant={meal.completed ? "default" : "secondary"}>
                            {meal.completed ? "Completed" : "Planned"}
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

        <TabsContent value="hydration" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Hydration Log</h2>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Running Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hydrationLogs.map((log, index) => {
                      const runningTotal = hydrationLogs.slice(0, index + 1).reduce((sum, l) => sum + l.ounces, 0)
                      return (
                        <TableRow key={log.id}>
                          <TableCell>{log.time}</TableCell>
                          <TableCell>{log.ounces}oz</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getSourceIcon(log.source)}
                              <span className="capitalize">{log.source}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{runningTotal}oz</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Smart Suggestions */}
      <Card className="border-accent/20 bg-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-accent-foreground">
            <Target className="h-5 w-5" />
            Smart Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {hydrationPercentage < 70 && (
              <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  💧 You're at {hydrationPercentage}% of your hydration goal. Consider drinking more water!
                </p>
              </div>
            )}
            {totalProtein < 100 && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-800">
                  🥩 You've consumed {totalProtein}g protein today. Aim for 100-150g for optimal recovery.
                </p>
              </div>
            )}
            {completedMeals < 3 && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm text-green-800">
                  🍽️ You've completed {completedMeals} meals today. Don't forget dinner!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

