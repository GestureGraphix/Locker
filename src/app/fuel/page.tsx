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

type MenuItem = {
  name: string
  description?: string
  calories?: number | null
}

type MenuMeal = {
  mealType: string
  items: MenuItem[]
}

type MenuLocation = {
  location: string
  meals: MenuMeal[]
}

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
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

export default function Fuel() {
  const [hydrationLogs, setHydrationLogs] = useState(mockHydrationLogs)
  const [mealLogs, setMealLogs] = useState(mockMealLogs)
  const [activeTab, setActiveTab] = useState("meals")
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
  const [menuDate, setMenuDate] = useState(new Date().toISOString().split("T")[0])
  const [menuData, setMenuData] = useState<MenuLocation[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [menuSource, setMenuSource] = useState<"json" | "html" | "fallback" | null>(null)

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
      dateTime: new Date().toISOString()
    })
  }, [])

  const normalizeMealType = useCallback((value: string) => {
    const lower = value.toLowerCase()
    if (lower.includes("breakfast") || lower.includes("brunch")) return "breakfast"
    if (lower.includes("lunch") || lower.includes("midday")) return "lunch"
    if (lower.includes("dinner") || lower.includes("supper") || lower.includes("evening")) return "dinner"
    if (lower.includes("snack") || lower.includes("late") || lower.includes("grab")) return "snack"
    return "lunch"
  }, [])

  const handleAddFromMenu = useCallback(
    (mealTypeLabel: string, item: MenuItem, location: string) => {
      const normalizedType = normalizeMealType(mealTypeLabel)
      const scheduledDate = new Date(`${menuDate}T12:00:00`)
      const proteinMatch = item.description?.match(/protein\s+(\d{1,3})g/i)
      const inferredProtein = proteinMatch ? String(Number.parseInt(proteinMatch[1], 10)) : ""
      const locationSuffix = location ? ` (${location})` : ""
      const descriptionPart = item.description ? ` — ${item.description}` : ""
      setNewMeal({
        mealType: normalizedType,
        calories: item.calories != null ? String(item.calories) : "",
        proteinG: inferredProtein,
        notes: `${item.name}${descriptionPart}${locationSuffix}`,
        dateTime: scheduledDate.toISOString()
      })
      setIsAddMealOpen(true)
    },
    [menuDate, normalizeMealType]
  )

  const parseMenuHtml = useCallback(
    (html: string): MenuLocation[] => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, "text/html")

      const candidateDateStrings = [menuDateStrings.long, menuDateStrings.medium].filter(Boolean) as string[]
      let container: Element | Document = doc

      if (candidateDateStrings.length > 0) {
        const headings = Array.from(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"))
        const headingForDate = headings.find((heading) => {
          const text = heading.textContent?.trim() ?? ""
          return candidateDateStrings.some((target) => text.includes(target))
        })

        if (headingForDate) {
          let potentialContainer: Element | null = headingForDate.parentElement
          while (potentialContainer && potentialContainer !== doc.body) {
            if (potentialContainer.querySelector("li")) {
              container = potentialContainer
              break
            }
            potentialContainer = potentialContainer.parentElement
          }
          if (!potentialContainer && headingForDate.nextElementSibling) {
            container = headingForDate.nextElementSibling
          }
        }
      }

      const section = container instanceof Document ? container.body : container
      const nodes = Array.from(section.querySelectorAll("h1,h2,h3,h4,h5,h6,strong,b,li,p"))

      const locationPattern = /(college|hall|dining|commons|grill|kitchen|buttery|library)/i
      const mealPattern = /(breakfast|brunch|lunch|dinner|supper|snack|grab|late night|special)/i
      const skipWordPattern = /^(?:calories?|kcals?|nutrition(?:al)? facts?|allergens?)$/i

      const locationMap = new Map<string, Map<string, Map<string, MenuItem>>>()

      const ensureBucket = (location: string, meal: string) => {
        const normalizedLocation = location || "General"
        const normalizedMeal = meal || "All Day"
        if (!locationMap.has(normalizedLocation)) {
          locationMap.set(normalizedLocation, new Map())
        }
        const mealMap = locationMap.get(normalizedLocation)!
        if (!mealMap.has(normalizedMeal)) {
          mealMap.set(normalizedMeal, new Map())
        }
        return mealMap.get(normalizedMeal)!
      }

      const parseCaloriesValue = (value?: string | null) => {
        if (!value) return undefined
        const match = value.match(/(\d{2,4})/)
        if (!match) return undefined
        const numeric = Number.parseInt(match[1], 10)
        return Number.isNaN(numeric) ? undefined : numeric
      }

      const labelForMacro = (raw: string) => {
        const normalized = raw.toLowerCase()
        if (normalized.startsWith("prot") || normalized === "p") return "Protein"
        if (normalized.startsWith("carb") || normalized === "c") return "Carbs"
        if (normalized.startsWith("fat") || normalized === "f") return "Fat"
        if (normalized.startsWith("fiber") || normalized === "fib") return "Fiber"
        if (normalized.startsWith("sug")) return "Sugar"
        return raw
      }

      const normalizeDescription = (value: string) => value.replace(/\s+/g, " ").trim()

      const parseMenuItemDetails = (
        raw: string,
        context?: { explicitCalories?: string | null; inlineDetails?: string[] }
      ): MenuItem | null => {
        const trimmed = raw.replace(/\s+/g, " ").trim()
        if (!trimmed) return null

        let working = trimmed
        const descriptionParts: string[] = []
        let calories: number | undefined

        if (context?.explicitCalories) {
          const parsed = parseCaloriesValue(context.explicitCalories)
          if (typeof parsed === "number") {
            calories = parsed
          }
        }

        if (context?.inlineDetails?.length) {
          context.inlineDetails
            .map((detail) => normalizeDescription(detail))
            .filter(Boolean)
            .forEach((detail) => descriptionParts.push(detail))
        }

        const macroMatches = Array.from(
          working.matchAll(/(\d{1,3})\s*g\s*(protein|prot|p|carbs?|carb|c|fat|f|fiber|fib|sugar|sug)/gi)
        )
        if (macroMatches.length > 0) {
          const macroSummary = macroMatches
            .map((match) => {
              const amount = match[1]
              const label = labelForMacro(match[2])
              return `${label} ${amount}g`
            })
            .filter(Boolean)
            .join(" / ")
          if (macroSummary) {
            descriptionParts.push(macroSummary)
          }
          working = working
            .replace(/(\d{1,3})\s*g\s*(protein|prot|p|carbs?|carb|c|fat|f|fiber|fib|sugar|sug)/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim()
        }

        if (calories == null) {
          const caloriePatterns = [
            /(\d{2,4})\s*(?:k?cal(?:ories)?|cal|cals)\b/i,
            /\b(?:k?cal(?:ories)?|cal|cals)\s*[:=]?\s*(\d{2,4})\b/i
          ]
          for (const pattern of caloriePatterns) {
            const match = pattern.exec(working)
            if (match) {
              const numeric = Number.parseInt(match[1], 10)
              if (!Number.isNaN(numeric)) {
                calories = numeric
              }
              const before = working.slice(0, match.index).trim()
              const after = working.slice(match.index + match[0].length).trim()
              if (after) {
                descriptionParts.push(normalizeDescription(after.replace(/^[,;:/\\-]+/, "")))
              }
              working = before || working
              break
            }
          }
        } else {
          working = working
            .replace(/(\d{2,4})\s*(?:k?cal(?:ories)?|cal|cals)\b/gi, "")
            .replace(/\b(?:k?cal(?:ories)?|cal|cals)\s*[:=]?\s*(\d{2,4})\b/gi, "")
            .trim()
        }

        const trailingParenthetical = working.match(/\(([^)]+)\)\s*$/)
        if (trailingParenthetical) {
          if (trailingParenthetical[1]) {
            descriptionParts.push(normalizeDescription(trailingParenthetical[1]))
          }
          working = working.slice(0, trailingParenthetical.index).trim()
        }

        const dashMatch = working.match(/(.+?)\s[–—-]\s(.+)/)
        if (dashMatch) {
          working = dashMatch[1].trim()
          descriptionParts.push(normalizeDescription(dashMatch[2]))
        }

        const colonMatch = working.match(/(.+?):\s*(.+)/)
        if (colonMatch) {
          working = colonMatch[1].trim()
          descriptionParts.push(normalizeDescription(colonMatch[2]))
        }

        working = working.replace(/\s*[-–—:,;]+\s*$/, "").replace(/\s{2,}/g, " ").trim()

        if (!working) return null
        const normalizedName = working
        const normalizedLower = normalizedName.toLowerCase()

        if (skipWordPattern.test(normalizedLower)) return null
        if (normalizedLower.startsWith("contains ")) {
          descriptionParts.push(normalizeDescription(normalizedName))
          return null
        }
        if (normalizedLower.includes("allergen")) {
          descriptionParts.push(normalizeDescription(normalizedName))
          return null
        }
        if (locationPattern.test(normalizedLower) && normalizedName.split(" ").length <= 3) return null
        if (mealPattern.test(normalizedLower)) return null

        const uniqueDescriptions = Array.from(
          new Set(descriptionParts.map((part) => normalizeDescription(part)).filter(Boolean))
        )

        return {
          name: normalizedName,
          description: uniqueDescriptions.length > 0 ? uniqueDescriptions.join(" • ") : undefined,
          calories: typeof calories === "number" ? calories : null
        }
      }

      const upsertMenuItem = (bucket: Map<string, MenuItem>, item: MenuItem) => {
        const key = item.name.toLowerCase()
        if (!bucket.has(key)) {
          bucket.set(key, item)
          return
        }

        const existing = bucket.get(key)!
        if (item.description) {
          if (!existing.description) {
            existing.description = item.description
          } else if (!existing.description.includes(item.description)) {
            existing.description = `${existing.description} • ${item.description}`
          }
        }

        if ((existing.calories == null || Number.isNaN(existing.calories)) && item.calories != null) {
          existing.calories = item.calories
        }
      }

      const addItemsFromText = (
        raw: string,
        context?: { explicitCalories?: string | null; inlineDetails?: string[] }
      ) => {
        const segments = raw
          .split(/\n+/)
          .flatMap((segment) =>
            segment
              .split(/[•·;|]/)
              .map((piece) => piece.replace(/^\s*[-–—]\s*/, "").trim())
              .filter(Boolean)
          )

        if (segments.length === 0) return

        const bucket = ensureBucket(currentLocation, currentMeal)
        const sharedContext = segments.length === 1 ? context : undefined

        segments.forEach((segment) => {
          const parsed = parseMenuItemDetails(segment, sharedContext)
          if (!parsed) return
          upsertMenuItem(bucket, parsed)
        })
      }

      let currentLocation = "General"
      let currentMeal = "All Day"

      for (const node of nodes) {
        const tag = node.tagName.toLowerCase()
        const rawText = node.textContent ?? ""
        const text = rawText.replace(/\s+/g, " ").trim()
        if (!text) continue

        const lowerText = text.toLowerCase()

        if (tag !== "li" && locationPattern.test(lowerText)) {
          currentLocation = text
          ensureBucket(currentLocation, currentMeal)
          continue
        }

        if (mealPattern.test(lowerText)) {
          const match = lowerText.match(mealPattern)
          currentMeal = match ? match[0] : text
          currentMeal = currentMeal
            .replace(/(^|\s)([a-z])/g, (substring) => substring.toUpperCase())
            .replace(/\bLate Night\b/i, "Late Night")
          ensureBucket(currentLocation, currentMeal)
          continue
        }

        if (tag === "li") {
          let explicitCalories: string | null | undefined
          let inlineDetails: string[] = []

          if (node instanceof HTMLElement) {
            explicitCalories =
              node.dataset.calories ??
              node.dataset.cal ??
              node.dataset.kcal ??
              node.getAttribute("data-calories") ??
              node.getAttribute("data-cal") ??
              node.getAttribute("data-kcal") ??
              node.getAttribute("data-energy") ??
              undefined;

            const calorieElement = node.querySelector(
              "[data-calories],[data-cal],[data-kcal],[data-energy],[class*='calorie'],[class*='kcal']"
            )
            if (!explicitCalories && calorieElement) {
              if (calorieElement instanceof HTMLElement) {
                explicitCalories =
                  calorieElement.dataset?.calories ??
                  calorieElement.dataset?.cal ??
                  calorieElement.dataset?.kcal ??
                  calorieElement.textContent ??
                  undefined;
              } else {
                explicitCalories = calorieElement.textContent ?? undefined;
              }
            }

            inlineDetails = Array.from(
              node.querySelectorAll(
                "small,em,span.meta,span.details,span.nutrition,span.nutrients,div.meta,div.details,div.nutrition,div.nutrients"
              )
            )
              .map((detail) => detail.textContent ?? "")
              .map((detail) => detail.replace(/\s+/g, " ").trim())
              .filter(Boolean)
          }

          const context =
            explicitCalories || inlineDetails.length > 0
              ? { explicitCalories, inlineDetails }
              : undefined

          addItemsFromText(rawText, context)
          continue
        }

        if (tag === "p" && /•|-/.test(text)) {
          addItemsFromText(rawText)
          continue
        }
      }

      const menuLocations: MenuLocation[] = []

      locationMap.forEach((meals, location) => {
        const mealList: MenuMeal[] = []
        meals.forEach((items, mealType) => {
          if (items.size === 0) return
          mealList.push({
            mealType,
            items: Array.from(items.values())
          })
        })

        if (mealList.length > 0) {
          mealList.sort((a, b) => a.mealType.localeCompare(b.mealType))
          menuLocations.push({ location, meals: mealList })
        }
      })

      return menuLocations.sort((a, b) => a.location.localeCompare(b.location))
    },
    [menuDateStrings]
  )

  const fetchMenu = useCallback(async () => {
    setMenuLoading(true)
    setMenuError(null)
    try {
      const response = await fetch(`/api/yale-menu?date=${menuDate}`)
      if (!response.ok) {
        throw new Error("Unable to reach Yale Hospitality")
      }
      const payload = await response.json()

      if (payload.source === "live") {
        if (Array.isArray(payload.menu) && payload.format === "json") {
          setMenuData(payload.menu)
          setMenuSource("json")
          setMenuError(null)
          return
        }

        if (payload.html) {
          const parsedMenu = parseMenuHtml(payload.html)
          if (parsedMenu.length > 0) {
            setMenuData(parsedMenu)
            setMenuSource("html")
            if (Array.isArray(payload.jsonErrors) && payload.jsonErrors.length > 0) {
              setMenuError(
                `Structured menu feed unavailable. Parsed Yale Hospitality HTML instead (${payload.jsonErrors[0]}).`
              )
            } else {
              setMenuError(null)
            }
          } else if (Array.isArray(payload.fallbackMenu)) {
            setMenuData(payload.fallbackMenu)
            setMenuSource("fallback")
            setMenuError("We could not interpret the live menu. Showing a sample menu instead.")
          } else {
            setMenuData([])
            setMenuError("We could not find menu items for the selected date.")
            setMenuSource(null)
          }
          return
        }

        if (Array.isArray(payload.menu)) {
          setMenuData(payload.menu)
          setMenuSource("json")
          setMenuError(null)
          return
        }

        setMenuData([])
        setMenuError("Unexpected live response while loading menu data.")
        setMenuSource(null)
      } else if (payload.source === "fallback" && Array.isArray(payload.menu)) {
        setMenuData(payload.menu)
        setMenuSource("fallback")
        if (payload.error) {
          setMenuError(`Live data unavailable: ${payload.error}`)
        } else {
          setMenuError("Live data unavailable. Showing a sample menu.")
        }
      } else {
        setMenuData([])
        setMenuError("Unexpected response while loading menu data.")
        setMenuSource(null)
      }
    } catch (error) {
      setMenuData([])
      setMenuSource(null)
      setMenuError(error instanceof Error ? error.message : "Unknown error loading menu")
    } finally {
      setMenuLoading(false)
    }
  }, [menuDate, parseMenuHtml])

  useEffect(() => {
    if (activeTab === "menu") {
      fetchMenu()
    }
  }, [activeTab, fetchMenu])

  useEffect(() => {
    if (!isAddMealOpen) {
      resetMealForm()
    }
  }, [isAddMealOpen, resetMealForm])

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="meals">Meals</TabsTrigger>
          <TabsTrigger value="hydration">Hydration Log</TabsTrigger>
          <TabsTrigger value="menu">Dining Menus</TabsTrigger>
        </TabsList>

        <TabsContent value="meals" className="space-y-4">
          {/* Today’s Meals */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Today’s Meals</h2>
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
                    onChange={(event) => setMenuDate(event.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={fetchMenu} disabled={menuLoading} variant="outline">
                    {menuLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    )}
                    Refresh menu
                  </Button>
                </div>
              </div>

              {menuError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {menuError}
                </div>
              )}

              {menuSource && (
                <div className="rounded-md border border-muted p-3 text-xs text-muted-foreground">
                  {menuSource === "json"
                    ? `Menu loaded from Yale Hospitality's nutrition feed for ${menuDateStrings.long}.`
                    : menuSource === "html"
                      ? `Menu parsed from the Yale Hospitality website for ${menuDateStrings.long}.`
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
                          <Badge variant="secondary">{location.meals.length} meal{location.meals.length === 1 ? "" : "s"}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {location.meals.map((meal) => (
                          <div key={`${location.location}-${meal.mealType}`} className="space-y-2 rounded-lg border border-border/50 p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getMealTypeIcon(normalizeMealType(meal.mealType))}
                                <span className="font-medium">{meal.mealType}</span>
                              </div>
                              <Badge variant="outline">{meal.items.length} item{meal.items.length === 1 ? "" : "s"}</Badge>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              {meal.items.map((item) => (
                                <div
                                  key={`${location.location}-${meal.mealType}-${item.name}`}
                                  className="flex items-start justify-between gap-3 rounded-md border border-border/40 p-3"
                                >
                                  <div className="flex flex-1 flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                                      {typeof item.calories === "number" && (
                                        <Badge
                                          variant="outline"
                                          className="rounded-full border-primary/30 bg-primary/5 px-2 py-0.5 text-[0.625rem] font-semibold text-primary"
                                        >
                                          {item.calories} cal
                                        </Badge>
                                      )}
                                    </div>
                                    {item.description ? (
                                      <p className="text-xs text-muted-foreground">{item.description}</p>
                                    ) : (
                                      <p className="text-xs text-muted-foreground opacity-80">
                                        {typeof item.calories === "number"
                                          ? "No additional nutrition details provided"
                                          : "Calorie information unavailable"}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAddFromMenu(meal.mealType, item, location.location)}
                                  >
                                    Add
                                  </Button>
                                </div>
                              ))}
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
                  🥩 You’ve consumed {totalProtein}g protein today. Aim for 100-150g for optimal recovery.
                </p>
              </div>
            )}
            {completedMeals < 3 && (
              <div className="p-3 rounded-lg bg-[#dbe7f8] border border-[#b3c7e6]">
                <p className="text-sm text-[#0f4d92]">
                  🍽️ You’ve completed {completedMeals} meals today. Don’t forget dinner!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

