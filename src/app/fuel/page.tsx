"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  Clock,
  Loader2,
  RefreshCcw
} from "lucide-react"

/* ======================== Types ======================== */

type NutritionFact = {
  name: string
  amount?: number
  unit?: string
  percentDailyValue?: number
  display?: string
}

type MenuItem = {
  name: string
  description?: string
  calories?: number
  nutritionFacts: NutritionFact[]
}

type MenuMeal = {
  mealType: string
  items: MenuItem[]
}

type MenuLocation = {
  location: string
  meals: MenuMeal[]
}

type MealLog = {
  id: number
  dateTime: string
  mealType: string
  calories: number
  proteinG: number
  notes: string
  completed: boolean
  nutritionFacts: NutritionFact[]
}

/* ======================== Mocks ======================== */

const mockHydrationLogs = [
  { id: 1, date: "2024-01-15", ounces: 8, source: "cup", time: "08:00" },
  { id: 2, date: "2024-01-15", ounces: 12, source: "bottle", time: "10:30" },
  { id: 3, date: "2024-01-15", ounces: 8, source: "cup", time: "12:00" },
  { id: 4, date: "2024-01-15", ounces: 17, source: "shake", time: "14:00" },
  { id: 5, date: "2024-01-15", ounces: 8, source: "cup", time: "16:30" }
]

const mockMealLogs: MealLog[] = [
  {
    id: 1,
    dateTime: "2024-01-15T08:00:00Z",
    mealType: "breakfast",
    calories: 450,
    proteinG: 25,
    notes: "Oatmeal with berries and protein powder",
    completed: true,
    nutritionFacts: []
  },
  {
    id: 2,
    dateTime: "2024-01-15T12:30:00Z",
    mealType: "lunch",
    calories: 650,
    proteinG: 40,
    notes: "Grilled chicken salad",
    completed: true,
    nutritionFacts: []
  },
  {
    id: 3,
    dateTime: "2024-01-15T18:00:00Z",
    mealType: "dinner",
    calories: 0,
    proteinG: 0,
    notes: "Planned: Salmon with quinoa",
    completed: false,
    nutritionFacts: []
  },
  {
    id: 4,
    dateTime: "2024-01-15T15:00:00Z",
    mealType: "snack",
    calories: 200,
    proteinG: 15,
    notes: "Greek yogurt with nuts",
    completed: true,
    nutritionFacts: []
  }
]

/* ======================== Helpers ======================== */

const toNumber = (value?: number | string): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.\-]+/g, ""))
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

const safeLower = (s?: string) => (typeof s === "string" ? s.toLowerCase() : "")

const factValue = (fact?: NutritionFact): number | undefined => {
  if (!fact) return undefined
  return toNumber(fact.amount ?? fact.display)
}

const findFact = (facts: NutritionFact[], keyword: string) =>
  facts.find((f) => safeLower(f.name).includes(keyword))

const getCaloriesFromItem = (item: MenuItem): number | undefined => {
  // prefer explicit calories
  const direct = toNumber(item.calories)
  if (direct != null) return direct
  // otherwise sniff facts
  const c = findFact(item.nutritionFacts, "calorie")
  return factValue(c)
}

const getProteinFromItem = (item: MenuItem): number | undefined => {
  const p = findFact(item.nutritionFacts, "protein")
  return factValue(p)
}

const formatNutritionFactValue = (fact: NutritionFact): string | null => {
  if (fact.display && fact.display.trim()) return fact.display.trim()
  if (fact.amount != null) return `${fact.amount}${fact.unit ? ` ${fact.unit}` : ""}`.trim()
  return null
}

const normalizeMealType = (value: string) => {
  const lower = value.toLowerCase()
  if (lower.includes("breakfast") || lower.includes("brunch")) return "breakfast"
  if (lower.includes("lunch") || lower.includes("midday")) return "lunch"
  if (lower.includes("dinner") || lower.includes("supper") || lower.includes("evening")) return "dinner"
  if (lower.includes("snack") || lower.includes("late") || lower.includes("grab")) return "snack"
  return "lunch"
}

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
    case "breakfast": return "bg-[#f2f6fb] text-[#1c4f8f] border-[#d7e3f5]"
    case "lunch": return "bg-[#d9e3f5] text-[#0f4d92] border-[#b3c7e6]"
    case "dinner": return "bg-[#c7dbf3] text-[#0f2f5b] border-[#a8c2e5]"
    case "snack": return "bg-[#e4f1ff] text-[#12467f] border-[#c5ddf5]"
    default: return "bg-[#e8f0fb] text-[#123a70] border-[#c7d7ee]"
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
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

const getNextMealId = (meals: MealLog[]): number =>
  meals.reduce((maxId, meal) => (meal.id > maxId ? meal.id : maxId), 0) + 1

const PREFERRED_FACT_ORDER = ["calorie", "protein", "carbohydrate", "fat", "fiber", "sugar"]

const getFeaturedNutritionFacts = (facts: NutritionFact[]): NutritionFact[] => {
  if (!facts.length) return []
  const prioritized: NutritionFact[] = []
  for (const key of PREFERRED_FACT_ORDER) {
    const match = facts.find((f) => safeLower(f.name).includes(key))
    if (match && !prioritized.includes(match)) prioritized.push(match)
  }
  const remainder = facts.filter((f) => !prioritized.includes(f))
  return [...prioritized, ...remainder].slice(0, 4)
}

/* ======================== Component ======================== */

export default function Fuel() {
  const [hydrationLogs, setHydrationLogs] = useState(mockHydrationLogs)
  const [mealLogs, setMealLogs] = useState<MealLog[]>(mockMealLogs)
  const [activeTab, setActiveTab] = useState("meals")
  const [isAddHydrationOpen, setIsAddHydrationOpen] = useState(false)
  const [isAddMealOpen, setIsAddMealOpen] = useState(false)
  const [newHydration, setNewHydration] = useState({ ounces: "", source: "cup" })
  const [newMeal, setNewMeal] = useState({
    mealType: "breakfast",
    calories: "",
    proteinG: "",
    notes: "",
    dateTime: new Date().toISOString(),
    nutritionFacts: [] as NutritionFact[],
    portion: "1",
    baseCalories: undefined as number | undefined,
    baseProteinG: undefined as number | undefined,
    isFromMenu: false
  })
  const [menuDate, setMenuDate] = useState(new Date().toISOString().split("T")[0])
  const [menuData, setMenuData] = useState<MenuLocation[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [menuSource, setMenuSource] = useState<"live" | "fallback" | null>(null)

  const menuDateStrings = useMemo(() => {
    const baseDate = menuDate ? new Date(`${menuDate}T00:00:00`) : new Date()
    const selectedDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate
    return {
      long: selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }),
      medium: selectedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      })
    }
  }, [menuDate])

  const resetMealForm = useCallback(() => {
    setNewMeal({
      mealType: "breakfast",
      calories: "",
      proteinG: "",
      notes: "",
      dateTime: new Date().toISOString(),
      nutritionFacts: [],
      portion: "1",
      baseCalories: undefined,
      baseProteinG: undefined,
      isFromMenu: false
    })
  }, [])

  /* -------- Add meal from menu (now guarantees non-zero if available) -------- */
  const handleAddFromMenu = useCallback(
    (mealTypeLabel: string, item: MenuItem, location: string) => {
      const normalizedType = normalizeMealType(mealTypeLabel)
      const scheduledDate = new Date(`${menuDate}T12:00:00`)
      const dateTime = Number.isNaN(scheduledDate.getTime()) ? new Date() : scheduledDate

      const calories = getCaloriesFromItem(item)
      const protein = getProteinFromItem(item)

      const notes = `${item.name}${item.description ? ` — ${item.description}` : ""} (${location})`
      const clonedFacts = (Array.isArray(item.nutritionFacts) ? item.nutritionFacts : []).map((f) => ({ ...f }))

      setMealLogs((prev) => {
        const nextId = getNextMealId(prev)
        const c = calories != null && Number.isFinite(calories) ? Math.round(calories) : 0
        const p = protein != null && Number.isFinite(protein) ? Number(protein.toFixed(1)) : 0
        return [
          ...prev,
          {
            id: nextId,
            mealType: normalizedType,
            calories: c,
            proteinG: p,
            notes,
            dateTime: dateTime.toISOString(),
            nutritionFacts: clonedFacts,
            completed: true
          }
        ]
      })

      setActiveTab("meals")
    },
    [menuDate]
  )

  /* -------- Fetch menu and normalize calories/protein on the way in -------- */
  const fetchMenu = useCallback(async () => {
    setMenuLoading(true)
    setMenuError(null)
    try {
      const res = await fetch(`/api/yale-menu?date=${menuDate}`)
      if (!res.ok) throw new Error("Unable to reach Yale Dining")
      const payload = await res.json()

      const locations: MenuLocation[] = Array.isArray(payload.menu) ? payload.menu : []
      if (!locations.length) {
        setMenuData([])
        setMenuSource(null)
        if (payload.source === "live") {
          setMenuError("We could not find menu items for the selected date.")
        } else if (payload.error) {
          setMenuError(`Live data unavailable: ${payload.error}`)
        } else {
          setMenuError("Unexpected response while loading menu data.")
        }
        return
      }

      // Ensure each item has calories precomputed so buttons/labels never show 0 unless truly missing
      const normalized: MenuLocation[] = locations.map((loc) => ({
        ...loc,
        meals: (loc.meals || []).map((meal) => ({
          ...meal,
          items: (meal.items || []).map((item) => {
            const facts = Array.isArray(item.nutritionFacts) ? item.nutritionFacts : []
            const calories = getCaloriesFromItem({ ...item, nutritionFacts: facts })
            return {
              ...item,
              calories: calories ?? item.calories,
              nutritionFacts: facts
            }
          })
        }))
      }))

      setMenuData(normalized)
      setMenuSource(payload.source ?? null)

      if (payload.source === "fallback" && payload.error) {
        setMenuError(`Live data unavailable: ${payload.error}`)
      }
    } catch (err) {
      setMenuData([])
      setMenuSource(null)
      setMenuError(err instanceof Error ? err.message : "Unknown error loading menu")
    } finally {
      setMenuLoading(false)
    }
  }, [menuDate])

  useEffect(() => {
    if (activeTab === "menu") fetchMenu()
  }, [activeTab, fetchMenu])

  useEffect(() => {
    if (!isAddMealOpen) resetMealForm()
  }, [isAddMealOpen, resetMealForm])

  /* -------- Logging hydration & manual meals -------- */

  const handleAddHydration = () => {
    if (!newHydration.ounces) return
    const log = {
      id: hydrationLogs.length + 1,
      date: new Date().toISOString().split("T")[0],
      ounces: parseInt(newHydration.ounces),
      source: newHydration.source,
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    }
    setHydrationLogs((prev) => [...prev, log])
    setNewHydration({ ounces: "", source: "cup" })
    setIsAddHydrationOpen(false)
  }

  const handleAddMeal = () => {
    const portionValue = Number.parseFloat(newMeal.portion)
    const portion = Number.isFinite(portionValue) && portionValue > 0 ? portionValue : 1
    const baseCalories =
      newMeal.baseCalories ?? (newMeal.calories ? Number.parseFloat(newMeal.calories) : undefined)
    if (!newMeal.mealType || baseCalories == null || Number.isNaN(baseCalories)) return

    const baseProtein = newMeal.baseProteinG ?? (newMeal.proteinG ? Number.parseFloat(newMeal.proteinG) : undefined) ?? 0
    const totalCalories = Math.round(baseCalories * portion)
    const totalProtein = Number((baseProtein * portion).toFixed(1))

    setMealLogs((prev) => [
      ...prev,
      {
        id: getNextMealId(prev),
        mealType: newMeal.mealType,
        calories: totalCalories,
        proteinG: Number.isNaN(totalProtein) ? 0 : totalProtein,
        notes: newMeal.notes,
        dateTime: newMeal.dateTime,
        nutritionFacts: (newMeal.nutritionFacts ?? []).map((f) => ({ ...f })),
        completed: true
      }
    ])
    resetMealForm()
    setIsAddMealOpen(false)
  }

  const toggleMealComplete = (id: number) => {
    setMealLogs((prev) => prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m)))
  }

  /* -------- Derived totals -------- */

  const todayHydration = hydrationLogs.reduce((sum, log) => sum + log.ounces, 0)
  const hydrationGoal = 80
  const hydrationPercentage = Math.round((todayHydration / hydrationGoal) * 100)

  const todayMeals = mealLogs.filter((m) => new Date(m.dateTime).toDateString() === new Date().toDateString())
  const totalCalories = todayMeals.reduce((sum, m) => sum + m.calories, 0)
  const totalProtein = todayMeals.reduce((sum, m) => sum + m.proteinG, 0)
  const completedMeals = todayMeals.filter((m) => m.completed).length

  const parsedPortion = Number.parseFloat(newMeal.portion)
  const portionMultiplierPreview = Number.isFinite(parsedPortion) && parsedPortion > 0 ? parsedPortion : 1
  const effectiveBaseCalories =
    newMeal.baseCalories ?? (newMeal.calories ? Number.parseFloat(newMeal.calories) : undefined)
  const effectiveBaseProtein =
    newMeal.baseProteinG ?? (newMeal.proteinG ? Number.parseFloat(newMeal.proteinG) : undefined)
  const portionCaloriesPreview =
    newMeal.isFromMenu && effectiveBaseCalories != null && !Number.isNaN(effectiveBaseCalories)
      ? Math.round(effectiveBaseCalories * portionMultiplierPreview)
      : undefined
  const portionProteinPreview =
    newMeal.isFromMenu && effectiveBaseProtein != null && !Number.isNaN(effectiveBaseProtein)
      ? Number((effectiveBaseProtein * portionMultiplierPreview).toFixed(1))
      : undefined

  /* ======================== UI ======================== */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fuel</h1>
          <p className="text-muted-foreground">Track your hydration and nutrition</p>
        </div>
        <div className="flex gap-2">
          {/* Add Hydration */}
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
                    onChange={(e) => setNewHydration((prev) => ({ ...prev, ounces: e.target.value }))}
                    placeholder="8"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Source</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newHydration.source}
                    onChange={(e) => setNewHydration((prev) => ({ ...prev, source: e.target.value }))}
                  >
                    <option value="cup">Cup</option>
                    <option value="bottle">Bottle</option>
                    <option value="shake">Protein Shake</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setNewHydration((p) => ({ ...p, ounces: "8" }))}>
                    8oz
                  </Button>
                  <Button variant="outline" onClick={() => setNewHydration((p) => ({ ...p, ounces: "12" }))}>
                    12oz
                  </Button>
                  <Button variant="outline" onClick={() => setNewHydration((p) => ({ ...p, ounces: "17" }))}>
                    17oz
                  </Button>
                </div>
                <Button onClick={handleAddHydration} className="w-full">
                  Log Hydration
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Manual Log Meal */}
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
                    onChange={(e) => setNewMeal((prev) => ({ ...prev, mealType: e.target.value }))}
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>

                {newMeal.isFromMenu && (effectiveBaseCalories != null || effectiveBaseProtein != null) ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Portions</label>
                      <Input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={newMeal.portion}
                        onChange={(e) => setNewMeal((prev) => ({ ...prev, portion: e.target.value }))}
                        placeholder="1"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Per portion
                        {effectiveBaseCalories != null ? ` · ${Math.round(effectiveBaseCalories)} cal` : ""}
                        {effectiveBaseProtein != null ? ` · ${Number(effectiveBaseProtein.toFixed(1))}g protein` : ""}
                      </p>
                    </div>
                    {(portionCaloriesPreview != null || portionProteinPreview != null) && (
                      <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-3">
                        <p className="text-sm font-medium text-foreground">
                          Total for {portionMultiplierPreview} portion{portionMultiplierPreview === 1 ? "" : "s"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {portionCaloriesPreview != null ? `${portionCaloriesPreview} cal` : null}
                          {portionCaloriesPreview != null && portionProteinPreview != null ? " · " : null}
                          {portionProteinPreview != null ? `${portionProteinPreview}g protein` : null}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Calories</label>
                      <Input
                        type="number"
                        value={newMeal.calories}
                        onChange={(e) => setNewMeal((prev) => ({ ...prev, calories: e.target.value }))}
                        placeholder="450"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Protein (g)</label>
                      <Input
                        type="number"
                        value={newMeal.proteinG}
                        onChange={(e) => setNewMeal((prev) => ({ ...prev, proteinG: e.target.value }))}
                        placeholder="25"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    value={newMeal.notes}
                    onChange={(e) => setNewMeal((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="What did you eat?"
                  />
                </div>

                {newMeal.nutritionFacts.length > 0 && (
                  <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-3">
                    <p className="text-sm font-medium text-foreground">Nutrition snapshot</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem] text-muted-foreground">
                      {getFeaturedNutritionFacts(newMeal.nutritionFacts).map((fact) => {
                        const value = formatNutritionFactValue(fact)
                        if (!value) return null
                        return (
                          <Badge key={`dialog-${fact.name}`} variant="outline" className="border-dashed px-2 py-0">
                            {fact.name}: {value}
                          </Badge>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Auto-filled from the Yale Dining menu.
                    </p>
                  </div>
                )}

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
              <Target className="h-5 w-5 text-[#1c6dd0]" />
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
              <Apple className="h-5 w-5 text-[#0f4d92]" />
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
              <Zap className="h-5 w-5 text-[#123d73]" />
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
                    date: new Date().toISOString().split("T")[0],
                    ounces: 8,
                    source: "cup",
                    time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                  }
                  setHydrationLogs((prev) => [...prev, log])
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
                    date: new Date().toISOString().split("T")[0],
                    ounces: 12,
                    source: "bottle",
                    time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                  }
                  setHydrationLogs((prev) => [...prev, log])
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
                    date: new Date().toISOString().split("T")[0],
                    ounces: 17,
                    source: "shake",
                    time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                  }
                  setHydrationLogs((prev) => [...prev, log])
                }}
              >
                +17oz
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="meals">Meals</TabsTrigger>
          <TabsTrigger value="hydration">Hydration Log</TabsTrigger>
          <TabsTrigger value="menu">Dining Menus</TabsTrigger>
        </TabsList>

        {/* Today’s Meals */}
        <TabsContent value="meals" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Today’s Meals</h2>
            <div className="space-y-3">
              {todayMeals.map((meal) => (
                <Card key={meal.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 rounded-lg bg-primary/10">{getMealTypeIcon(meal.mealType)}</div>
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
                          {meal.notes && <p className="text-sm text-muted-foreground mt-1">{meal.notes}</p>}
                          {meal.nutritionFacts?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2 text-[0.7rem] text-muted-foreground">
                              {getFeaturedNutritionFacts(meal.nutritionFacts).map((fact) => {
                                const value = formatNutritionFactValue(fact)
                                if (!value) return null
                                return (
                                  <Badge
                                    key={`${meal.id}-${fact.name}`}
                                    variant="outline"
                                    className="border-dashed px-2 py-0 text-[0.65rem] font-medium"
                                  >
                                    {fact.name}: {value}
                                  </Badge>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getMealTypeColor(meal.mealType)}>{meal.mealType}</Badge>
                        <Button variant="outline" size="sm" onClick={() => toggleMealComplete(meal.id)}>
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
                    {mealLogs.slice(0, 10).map((meal) => (
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

        {/* Hydration Log */}
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

        {/* Dining Menus */}
        <TabsContent value="menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5 text-primary" />
                Yale Hospitality Menu Lookup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium" htmlFor="menu-date">
                    Select a day
                  </label>
                  <Input
                    id="menu-date"
                    type="date"
                    value={menuDate}
                    onChange={(e) => setMenuDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={fetchMenu} disabled={menuLoading} variant="outline">
                    {menuLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Refresh menu
                  </Button>
                </div>
              </div>

              {menuError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{menuError}</div>
              )}

              {menuSource && (
                <div className="rounded-md border border-muted p-3 text-xs text-muted-foreground">
                  {menuSource === "live"
                    ? `Menu retrieved from Yale Dining (Nutrislice) for ${menuDateStrings.long}.`
                    : `Showing fallback example menu for ${menuDateStrings.long}.`}
                </div>
              )}

              {menuLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Fetching dining menu…
                </div>
              ) : menuData.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  No dining menu items found for {menuDateStrings.long}.
                </div>
              ) : (
                <div className="space-y-4">
                  {menuData.map((location) => (
                    <Card key={location.location} className="border-primary/10">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{location.location}</span>
                          <Badge variant="secondary">
                            {location.meals.length} meal{location.meals.length === 1 ? "" : "s"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {location.meals.map((meal) => (
                          <div
                            key={`${location.location}-${meal.mealType}`}
                            className="space-y-2 rounded-lg border border-border/50 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getMealTypeIcon(normalizeMealType(meal.mealType))}
                                <span className="font-medium">{meal.mealType}</span>
                              </div>
                              <Badge variant="outline">
                                {meal.items.length} item{meal.items.length === 1 ? "" : "s"}
                              </Badge>
                            </div>

                            <div className="grid gap-2 md:grid-cols-2">
                              {meal.items.map((item, idx) => {
                                const calories = getCaloriesFromItem(item)
                                return (
                                  <div
                                    key={`${location.location}-${meal.mealType}-${item.name}-${idx}`} // unique key
                                    className="flex items-start justify-between gap-3 rounded-md border border-border/40 p-3"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                                      {item.description && (
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                      )}
                                      {item.nutritionFacts.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem] text-muted-foreground">
                                          {getFeaturedNutritionFacts(item.nutritionFacts).map((fact) => {
                                            const value = formatNutritionFactValue(fact)
                                            if (!value) return null
                                            return (
                                              <Badge
                                                key={`${item.name}-${fact.name}`}
                                                variant="outline"
                                                className="border-dashed px-2 py-0"
                                              >
                                                {fact.name}: {value}
                                              </Badge>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                                      <Badge variant="secondary" className="whitespace-nowrap">
                                        {calories != null && Number.isFinite(calories) ? Math.round(calories) : 0} cal
                                      </Badge>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAddFromMenu(meal.mealType, item, location.location)}
                                      >
                                        Add Meal
                                      </Button>
                                    </div>

                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
              <div className="p-3 rounded-lg bg-[#eef5ff] border border-[#c7d7ee]">
                <p className="text-sm text-[#0f2f5b]">
                  💧 You’re at {hydrationPercentage}% of your hydration goal. Consider drinking more water!
                </p>
              </div>
            )}
            {totalProtein < 100 && (
              <div className="p-3 rounded-lg bg-[#e1ecfb] border border-[#b3c7e6]">
                <p className="text-sm text-[#0f3a78]">
                  🥩 You’ve consumed {totalProtein}g protein today. Aim for 100–150g for optimal recovery.
                </p>
              </div>
            )}
            {completedMeals < 3 && (
              <div className="p-3 rounded-lg bg-[#dbe7f8] border border-[#b3c7e6]">
                <p className="text-sm text-[#0f4d92]">🍽️ You’ve completed {completedMeals} meals today. Don’t forget dinner!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
