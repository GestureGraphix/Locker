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
import { useRole } from "@/components/role-context"
import type { MealLog, NutritionFact } from "@/components/role-context"
import {
  Apple,
  Plus,
  Droplets,
  Coffee,
  GlassWater,
  Zap,
  Target,
  CalendarDays,
  Loader2,
  RefreshCcw,
  Search,
  UtensilsCrossed,
  X
} from "lucide-react"

/* ======================== Types ======================== */

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

type MenuMealSection = {
  type: string
  label: string
  locations: MenuLocation[]
  source: "live" | "fallback" | null
  error: string | null
}

type MenuSearchResult = {
  sectionType: string
  sectionLabel: string
  location: string
  mealType: string
  item: MenuItem
}

type PlateItem = {
  id: string
  mealType: string
  location: string
  sectionLabel: string
  item: MenuItem
  baseCalories: number
  baseProteinG: number
  portion: number
}
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

const LOCATION_GROUPS: { key: string; label: string; members: string[] }[] = [
  {
    key: "branford-jonathan-edwards",
    label: "Branford & Jonathan Edwards",
    members: ["branford college", "jonathan edwards college"]
  }
]

const LOCATION_GROUP_LOOKUP = new Map<string, { key: string; label: string }>(
  LOCATION_GROUPS.flatMap((group) =>
    group.members.map((member) => [member, { key: group.key, label: group.label }] as const)
  )
)

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

const roundToTwo = (value: number): number => Math.round(value * 100) / 100

const formatTwoDecimalString = (value: number): string => {
  const rounded = roundToTwo(value)
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2)
}

const formatNutritionFactValue = (fact: NutritionFact): string | null => {
  const trimmedDisplay = fact.display?.trim()
  const amount = toNumber(fact.amount)

  if (amount != null) {
    const formattedAmount = formatTwoDecimalString(amount)
    return `${formattedAmount}${fact.unit ? ` ${fact.unit}` : ""}`.trim()
  }

  if (trimmedDisplay) {
    const numericDisplay = toNumber(trimmedDisplay)
    if (numericDisplay != null) {
      const formattedAmount = formatTwoDecimalString(numericDisplay)
      const inferredUnit = fact.unit ?? trimmedDisplay.replace(/[0-9.,\s-]+/g, "").trim()
      return inferredUnit ? `${formattedAmount} ${inferredUnit}`.trim() : formattedAmount
    }
    return trimmedDisplay
  }

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

const getTodayDateString = () => new Date().toISOString().split("T")[0]

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

const formatMealTypeLabel = (value: string) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : ""

const MEAL_TYPE_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" }
]

const MENU_MEAL_SECTIONS = [
  { type: "breakfast", label: "Breakfast" },
  { type: "lunch", label: "Lunch" },
  { type: "dinner", label: "Dinner" }
]

const getSourceIcon = (source: string) => {
  switch (source) {
    case "cup": return <Coffee className="h-4 w-4" />
    case "bottle": return <GlassWater className="h-4 w-4" />
    case "shake": return <Zap className="h-4 w-4" />
    default: return <Droplets className="h-4 w-4" />
  }
}

const formatMealDate = (dateString: string) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return "Date unavailable"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

const getNextHydrationId = (logs: { id: number }[]): number =>
  logs.reduce((maxId, log) => (log.id > maxId ? log.id : maxId), 0) + 1

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
  const { primaryAthlete, updateHydrationLogs, updateMealLogs } = useRole()
  const hydrationLogs = primaryAthlete?.hydrationLogs ?? []
  const mealLogs = primaryAthlete?.mealLogs ?? []
  const [activeTab, setActiveTab] = useState("meals")
  const [isAddHydrationOpen, setIsAddHydrationOpen] = useState(false)
  const [isAddMealOpen, setIsAddMealOpen] = useState(false)
  const [todayDate, setTodayDate] = useState<string>(() => getTodayDateString())
  const [newHydration, setNewHydration] = useState({ ounces: "", source: "cup" })
  const [plateItems, setPlateItems] = useState<PlateItem[]>([])
  const [pendingPlateItemIds, setPendingPlateItemIds] = useState<string[]>([])
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
    isFromMenu: false,
    portionEditable: true
  })
  const mealTypeOptions = useMemo(() => {
    const baseOptions = MEAL_TYPE_OPTIONS
    if (!newMeal.mealType) return baseOptions
    const exists = baseOptions.some((option) => option.value === newMeal.mealType)
    return exists
      ? baseOptions
      : [...baseOptions, { value: newMeal.mealType, label: formatMealTypeLabel(newMeal.mealType) }]
  }, [newMeal.mealType])
  const [menuDate, setMenuDate] = useState(new Date().toISOString().split("T")[0])
  const [menuData, setMenuData] = useState<MenuMealSection[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [menuSource, setMenuSource] = useState<"live" | "fallback" | "mixed" | null>(null)
  const [menuSearch, setMenuSearch] = useState("")
  const normalizedMenuSearch = useMemo(() => menuSearch.trim().toLowerCase(), [menuSearch])
  const isMenuSearching = normalizedMenuSearch.length > 0

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

  useEffect(() => {
    setMenuSearch("")
  }, [menuDate])

  const hasMenuItems = useMemo(
    () =>
      menuData.some((section) =>
        section.locations.some((loc) =>
          (loc.meals || []).some((meal) => (meal.items || []).length > 0)
        )
      ),
    [menuData]
  )

  const menuSearchResults = useMemo<MenuSearchResult[]>(() => {
    if (!isMenuSearching) return []

    const query = normalizedMenuSearch
    const matchesQuery = (value?: string) => safeLower(value).includes(query)
    const dedupedResults = new Map<string, MenuSearchResult>()

    menuData.forEach((section) => {
      const locations = Array.isArray(section.locations) ? section.locations : []
      locations.forEach((location) => {
        const meals = Array.isArray(location.meals) ? location.meals : []
        meals.forEach((meal) => {
          const items = Array.isArray(meal.items) ? meal.items : []
          items.forEach((item) => {
            const facts = Array.isArray(item.nutritionFacts) ? item.nutritionFacts : []
            const rawLocationLabel = location.location ?? ""
            const normalizedLocation = safeLower(rawLocationLabel)
            const locationGroup = LOCATION_GROUP_LOOKUP.get(normalizedLocation)
            const locationKey = locationGroup?.key ?? normalizedLocation
            const displayLocation = locationGroup?.label ?? rawLocationLabel
            const matchesItem =
              matchesQuery(item.name) ||
              matchesQuery(item.description) ||
              matchesQuery(location.location) ||
              matchesQuery(meal.mealType) ||
              matchesQuery(section.label) ||
              matchesQuery(section.type) ||
              facts.some((fact) => matchesQuery(fact.name) || matchesQuery(fact.display))

            if (matchesItem) {
              const dedupeKey = [
                locationKey,
                safeLower(meal.mealType),
                safeLower(item.name),
                safeLower(item.description)
              ].join("|")

              if (!dedupedResults.has(dedupeKey)) {
                dedupedResults.set(dedupeKey, {
                  sectionType: section.type,
                  sectionLabel: section.label,
                  location: displayLocation,
                  mealType: meal.mealType,
                  item: { ...item, nutritionFacts: facts }
                })
              }
            }
          })
        })
      })
    })

    const results = Array.from(dedupedResults.values())

    results.sort((a, b) => {
      const locationCompare = safeLower(a.location).localeCompare(safeLower(b.location))
      if (locationCompare !== 0) return locationCompare

      const mealCompare = safeLower(a.mealType).localeCompare(safeLower(b.mealType))
      if (mealCompare !== 0) return mealCompare

      return safeLower(a.item.name).localeCompare(safeLower(b.item.name))
    })

    return results
  }, [isMenuSearching, menuData, normalizedMenuSearch])

  const hasMenuSearchResults = menuSearchResults.length > 0

  const plateSummary = useMemo(() => {
    if (plateItems.length === 0) {
      return {
        totalCalories: 0,
        totalProtein: 0,
        totalProteinRaw: 0,
        dominantMealType: "lunch",
        notes: "",
        nutritionFacts: [] as NutritionFact[]
      }
    }

    const totalCaloriesRaw = plateItems.reduce(
      (sum, item) => sum + item.baseCalories * item.portion,
      0
    )
    const totalProteinRaw = plateItems.reduce(
      (sum, item) => sum + item.baseProteinG * item.portion,
      0
    )

    const mealTypeCounts = new Map<string, number>()
    plateItems.forEach((item) => {
      mealTypeCounts.set(item.mealType, (mealTypeCounts.get(item.mealType) ?? 0) + 1)
    })

    const dominantMealType =
      Array.from(mealTypeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? plateItems[0]?.mealType ?? "lunch"

    const itemDescriptions = plateItems.map((plateItem) => {
      const base = `${plateItem.item.name}${plateItem.item.description ? ` — ${plateItem.item.description}` : ""}`
      const portionSuffix = plateItem.portion !== 1 ? ` × ${formatTwoDecimalString(plateItem.portion)}` : ""
      return `${base} (${plateItem.location})${portionSuffix}`
    })

    const nutritionFacts = plateItems.flatMap((plateItem) =>
      (plateItem.item.nutritionFacts ?? []).map((fact) => ({ ...fact }))
    )

    return {
      totalCalories: Math.round(totalCaloriesRaw),
      totalProtein: roundToTwo(totalProteinRaw),
      totalProteinRaw,
      dominantMealType,
      notes: itemDescriptions.join("; "),
      nutritionFacts
    }
  }, [plateItems])

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
      isFromMenu: false,
      portionEditable: true
    })
  }, [])

  /* -------- Add meal from menu (now guarantees non-zero if available) -------- */
  const handleAddFromMenu = useCallback(
    (mealTypeLabel: string, item: MenuItem, location: string, sectionLabel: string) => {
      const normalizedType = normalizeMealType(mealTypeLabel)
      const calories = getCaloriesFromItem(item)
      const protein = getProteinFromItem(item)

      const baseCalories = calories != null && Number.isFinite(calories) ? calories : 0
      const baseProtein = protein != null && Number.isFinite(protein) ? protein : 0

      let portion = 1
      if (typeof window !== "undefined") {
        const promptMessage = `How many portions of ${item.name} are you adding to the plate?`
        const response = window.prompt(promptMessage, "1")
        if (response == null) {
          return
        }
        const parsed = Number.parseFloat(response)
        if (Number.isFinite(parsed) && parsed > 0) {
          portion = parsed
        }
      }

      const clonedFacts = (Array.isArray(item.nutritionFacts) ? item.nutritionFacts : []).map((f) => ({ ...f }))
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      setPlateItems((prev) => [
        ...prev,
        {
          id,
          mealType: normalizedType,
          location,
          sectionLabel,
          item: { ...item, nutritionFacts: clonedFacts },
          baseCalories,
          baseProteinG: baseProtein,
          portion
        }
      ])
    },
    []
  )

  const handleRemovePlateItem = useCallback((id: string) => {
    setPlateItems((prev) => prev.filter((item) => item.id !== id))
    setPendingPlateItemIds((prev) => prev.filter((pendingId) => pendingId !== id))
  }, [])

  const handleClearPlate = useCallback(() => {
    setPlateItems([])
    setPendingPlateItemIds([])
  }, [])

  const handleCheckoutPlate = useCallback(() => {
    if (!primaryAthlete || plateItems.length === 0) return

    const scheduledDate = new Date(`${menuDate}T12:00:00`)
    const dateTime = Number.isNaN(scheduledDate.getTime()) ? new Date() : scheduledDate

    setNewMeal({
      mealType: plateSummary.dominantMealType,
      calories: "",
      proteinG: "",
      notes: plateSummary.notes,
      dateTime: dateTime.toISOString(),
      nutritionFacts: plateSummary.nutritionFacts,
      portion: "1",
      baseCalories: plateSummary.totalCalories,
      baseProteinG: plateSummary.totalProteinRaw,
      isFromMenu: true,
      portionEditable: false
    })

    setPendingPlateItemIds(plateItems.map((item) => item.id))
    setActiveTab("meals")
    setIsAddMealOpen(true)
  }, [menuDate, plateItems, plateSummary, primaryAthlete])

  useEffect(() => {
    if (typeof window === "undefined") return

    const updateDate = () => setTodayDate(getTodayDateString())

    let timerId: number | undefined
      const scheduleNextUpdate = () => {
      const now = new Date()
      const next = new Date(now)
      next.setUTCHours(24, 0, 0, 0)
      const delay = Math.max(next.getTime() - now.getTime(), 0)
      timerId = window.setTimeout(() => {
        updateDate()
        scheduleNextUpdate()
      }, delay)
    }

    updateDate()
    scheduleNextUpdate()

    return () => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId)
      }
    }
  }, [])

  /* -------- Fetch menu sections (breakfast, lunch, dinner) -------- */
  const fetchMenu = useCallback(async () => {
    setMenuLoading(true)
    setMenuError(null)
    try {
      const sections = await Promise.all(
        MENU_MEAL_SECTIONS.map(async ({ type, label }) => {
          try {
            const res = await fetch(`/api/yale-menu?date=${menuDate}&meal=${type}`)
            if (!res.ok) throw new Error("Unable to reach Yale Dining")

            const payload = await res.json()
            const locations: MenuLocation[] = Array.isArray(payload.menu) ? payload.menu : []

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

            const hasItems = normalized.some((loc) =>
              (loc.meals || []).some((meal) => (meal.items || []).length > 0)
            )

            const source: "live" | "fallback" | null =
              payload.source === "live" || payload.source === "fallback" ? payload.source : null

            const payloadError =
              typeof payload.error === "string" && payload.error.trim().length
                ? payload.error.trim()
                : null

            return {
              type,
              label,
              locations: normalized,
              source,
              error: payloadError ?? (!hasItems ? `No ${label.toLowerCase()} items found.` : null)
            } satisfies MenuMealSection
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error loading menu"
            return {
              type,
              label,
              locations: [],
              source: null,
              error: message
            } satisfies MenuMealSection
          }
        })
      )

      setMenuData(sections)

      const distinctSources = new Set<"live" | "fallback">(
        sections
          .map((section) => section.source)
          .filter(
            (value): value is "live" | "fallback" => value === "live" || value === "fallback"
          )
      )

      if (distinctSources.size === 0) {
        setMenuSource(null)
      } else if (distinctSources.size === 1) {
        setMenuSource(distinctSources.values().next().value ?? null)
      } else {
        setMenuSource("mixed")
      }

      const aggregatedErrors = sections
        .filter((section) => section.error)
        .map((section) => `${section.label}: ${section.error}`)

      setMenuError(aggregatedErrors.length ? aggregatedErrors.join(" ") : null)
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
    if (!isAddMealOpen) {
      resetMealForm()
      setPendingPlateItemIds([])
    }
  }, [isAddMealOpen, resetMealForm, setPendingPlateItemIds])

  /* -------- Logging hydration & manual meals -------- */

  const handleAddHydration = () => {
    if (!primaryAthlete || !newHydration.ounces) return
    const ounces = Number.parseInt(newHydration.ounces, 10)
    if (Number.isNaN(ounces)) return
    const now = new Date()
    updateHydrationLogs(primaryAthlete.id, (prev) => [
      ...prev,
      {
        id: getNextHydrationId(prev),
        date: now.toISOString().split("T")[0],
        ounces,
        source: newHydration.source,
        time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      }
    ])
    setNewHydration({ ounces: "", source: "cup" })
    setIsAddHydrationOpen(false)
  }

  const quickAddHydration = useCallback(
    (ounces: number, source: string) => {
      if (!primaryAthlete) return
      const now = new Date()
      updateHydrationLogs(primaryAthlete.id, (prev) => [
        ...prev,
        {
          id: getNextHydrationId(prev),
          date: now.toISOString().split("T")[0],
          ounces,
          source,
          time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
        }
      ])
    },
    [primaryAthlete, updateHydrationLogs]
  )

  if (!primaryAthlete) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Fuel</h1>
        <p className="text-muted-foreground">Sign in to start tracking your meals and hydration.</p>
      </div>
    )
  }

  const handleAddMeal = () => {
    if (!primaryAthlete) return
    const portionValue = Number.parseFloat(newMeal.portion)
    const portion = Number.isFinite(portionValue) && portionValue > 0 ? portionValue : 1
    const baseCalories =
      newMeal.baseCalories ?? (newMeal.calories ? Number.parseFloat(newMeal.calories) : undefined)
    if (!newMeal.mealType || baseCalories == null || Number.isNaN(baseCalories)) return

    const baseProtein = newMeal.baseProteinG ?? (newMeal.proteinG ? Number.parseFloat(newMeal.proteinG) : undefined) ?? 0
    const totalCalories = Math.round(baseCalories * portion)
    const totalProtein = roundToTwo(baseProtein * portion)

    updateMealLogs(primaryAthlete.id, (prev) => [
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
    if (pendingPlateItemIds.length > 0) {
      setPlateItems((prev) => prev.filter((item) => !pendingPlateItemIds.includes(item.id)))
    }
    setPendingPlateItemIds([])
    resetMealForm()
    setIsAddMealOpen(false)
  }

  const toggleMealComplete = (id: number) => {
    if (!primaryAthlete) return
    updateMealLogs(primaryAthlete.id, (prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
    )
  }

  /* -------- Derived totals -------- */

  const todaysHydrationLogs = hydrationLogs.filter((log) => log.date === todayDate)
  const todayHydration = todaysHydrationLogs.reduce((sum, log) => sum + log.ounces, 0)
  const nutritionGoals = primaryAthlete.nutritionGoals ?? undefined
  const hydrationGoal = nutritionGoals?.hydrationOuncesPerDay ?? 80
  const hydrationRatio = hydrationGoal > 0 ? todayHydration / hydrationGoal : 0
  const hydrationPercentage = hydrationGoal > 0 ? Math.round(hydrationRatio * 100) : 0
  const hydrationProgressValue = Number.isFinite(hydrationPercentage)
    ? Math.min(Math.max(hydrationPercentage, 0), 100)
    : 0

  const todayMeals = mealLogs.filter((m) => new Date(m.dateTime).toDateString() === new Date().toDateString())
  const totalCalories = todayMeals.reduce((sum, m) => sum + m.calories, 0)
  const totalProtein = roundToTwo(todayMeals.reduce((sum, m) => sum + m.proteinG, 0))
  const completedMeals = todayMeals.filter((m) => m.completed).length
  const baseCalorieGoal = nutritionGoals?.caloriesPerDay
  const baseProteinGoal = nutritionGoals?.proteinGramsPerDay
  const calorieTarget = baseCalorieGoal && baseCalorieGoal > 0 ? baseCalorieGoal : undefined
  const proteinTarget = baseProteinGoal && baseProteinGoal > 0 ? baseProteinGoal : undefined
  const calorieProgressValue = (() => {
    if (!calorieTarget) return 0
    const progress = Math.round((totalCalories / calorieTarget) * 100)
    return Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0
  })()
  const proteinProgressValue = (() => {
    if (!proteinTarget) return 0
    const progress = Math.round((totalProtein / proteinTarget) * 100)
    return Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0
  })()
  const proteinSuggestionTarget = proteinTarget ?? 110

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
      ? roundToTwo(effectiveBaseProtein * portionMultiplierPreview)
      : undefined
  const shouldShowPortionInput =
    newMeal.isFromMenu &&
    newMeal.portionEditable &&
    (effectiveBaseCalories != null || effectiveBaseProtein != null)

  /* ======================== UI ======================== */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fuel</h1>
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
                  <label className="text-sm font-medium">Meal Category</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newMeal.mealType}
                    onChange={(e) => setNewMeal((prev) => ({ ...prev, mealType: e.target.value }))}
                  >
                    {mealTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {shouldShowPortionInput ? (
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
                        {effectiveBaseProtein != null
                          ? ` · ${formatTwoDecimalString(effectiveBaseProtein)}g protein`
                          : ""}
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
                          {portionProteinPreview != null
                            ? `${formatTwoDecimalString(portionProteinPreview)}g protein`
                            : null}
                        </p>
                      </div>
                    )}
                  </div>
                ) : newMeal.isFromMenu && (effectiveBaseCalories != null || effectiveBaseProtein != null) ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-3">
                      <p className="text-sm font-medium text-foreground">Plate totals</p>
                      <p className="text-xs text-muted-foreground">
                        {effectiveBaseCalories != null ? `${Math.round(effectiveBaseCalories)} cal` : null}
                        {effectiveBaseCalories != null && effectiveBaseProtein != null ? " · " : null}
                        {effectiveBaseProtein != null
                          ? `${formatTwoDecimalString(effectiveBaseProtein)}g protein`
                          : null}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Portions were captured when you added each item to your plate.
                    </p>
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Hydration Today</p>
                  <p className="text-2xl font-bold">{todayHydration}oz</p>
                </div>
              </div>
              <Badge variant="secondary" className="whitespace-nowrap">
                Goal: {hydrationGoal}oz
              </Badge>
            </div>
            <Progress value={hydrationProgressValue} className="h-2" />
            <p className="text-xs text-muted-foreground">You’re at {Math.max(hydrationPercentage, 0)}% of today’s hydration goal.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Apple className="h-5 w-5 text-[#0f4d92]" />
                <div>
                  <p className="text-sm font-medium">Calories</p>
                  <p className="text-2xl font-bold">
                    {totalCalories}
                    {calorieTarget ? ` / ${calorieTarget}` : ""}
                  </p>
                </div>
              </div>
              {baseCalorieGoal && baseCalorieGoal > 0 ? (
                <Badge variant="outline" className="whitespace-nowrap">
                  Base goal: {baseCalorieGoal}
                </Badge>
              ) : null}
            </div>
            {calorieTarget ? (
              <Progress value={calorieProgressValue} className="h-2" />
            ) : (
              <p className="text-xs text-muted-foreground">Log a goal in the athlete profile to unlock guidance.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#123d73]" />
                <div>
                  <p className="text-sm font-medium">Protein</p>
                  <p className="text-2xl font-bold">
                    {formatTwoDecimalString(totalProtein)}g
                    {proteinTarget ? ` / ${formatTwoDecimalString(proteinTarget)}g` : ""}
                  </p>
                </div>
              </div>
              {baseProteinGoal && baseProteinGoal > 0 ? (
                <Badge variant="outline" className="whitespace-nowrap">
                  Base goal: {formatTwoDecimalString(baseProteinGoal)}g
                </Badge>
              ) : null}
            </div>
            {proteinTarget ? (
              <Progress value={proteinProgressValue} className="h-2" />
            ) : (
              <p className="text-xs text-muted-foreground">Add a protein goal to unlock progress tracking.</p>
            )}
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
            <Progress value={hydrationProgressValue} className="h-3" />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => quickAddHydration(8, "cup")}
              >
                +8oz
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => quickAddHydration(12, "bottle")}
              >
                +12oz
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => quickAddHydration(17, "shake")}
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
                              <CalendarDays className="h-4 w-4" />
                              {formatMealDate(meal.dateTime)}
                            </span>
                            <span>{meal.calories} cal</span>
                            <span>{formatTwoDecimalString(meal.proteinG)}g protein</span>
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
                      <TableHead>Date</TableHead>
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
                        <TableCell>{formatMealDate(meal.dateTime)}</TableCell>
                        <TableCell>{meal.calories}</TableCell>
                        <TableCell>{formatTwoDecimalString(meal.proteinG)}g</TableCell>
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
                    {todaysHydrationLogs.map((log, index) => {
                      const runningTotal = todaysHydrationLogs
                        .slice(0, index + 1)
                        .reduce((sum, l) => sum + l.ounces, 0)
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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4 lg:flex-1">
                  <div className="w-full md:w-48">
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
                  <div className="flex-1">
                    <label className="text-sm font-medium" htmlFor="menu-search">
                      Search the menu
                    </label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="menu-search"
                        type="search"
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        placeholder="Search for dishes, locations, or nutrition facts"
                        className="pl-9"
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Start typing to quickly find menu items without scrolling through every listing.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:self-end">
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
                    : menuSource === "fallback"
                      ? `Showing fallback example menu for ${menuDateStrings.long}.`
                      : `Menus retrieved from a mix of live Yale Dining data and fallback data for ${menuDateStrings.long}.`}
                </div>
              )}

              {plateItems.length > 0 && (
                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-primary/10 p-2 text-primary">
                        <UtensilsCrossed className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Plate ready for {formatMealTypeLabel(plateSummary.dominantMealType)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {plateSummary.totalCalories} cal · {formatTwoDecimalString(plateSummary.totalProtein)}g protein
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" size="sm" onClick={handleClearPlate}>
                        Clear Plate
                      </Button>
                      <Button size="sm" onClick={handleCheckoutPlate} disabled={!primaryAthlete}>
                        Checkout Plate
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {plateItems.map((plateItem) => (
                      <div
                        key={plateItem.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-dashed border-muted-foreground/30 bg-background/60 p-2 text-xs text-muted-foreground"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{plateItem.item.name}</p>
                          <p>
                            {formatMealTypeLabel(plateItem.mealType)} · {plateItem.location}
                          </p>
                          {plateItem.item.description ? <p>{plateItem.item.description}</p> : null}
                          <p>
                            {Math.round(plateItem.baseCalories * plateItem.portion)} cal ·
                            {" "}
                            {formatTwoDecimalString(plateItem.baseProteinG * plateItem.portion)}g protein
                          </p>
                          {plateItem.portion !== 1 ? (
                            <p>Portion: ×{formatTwoDecimalString(plateItem.portion)}</p>
                          ) : null}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => handleRemovePlateItem(plateItem.id)}
                          aria-label="Remove from plate"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {menuLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Fetching dining menu…
                </div>
              ) : !hasMenuItems ? (
                <div className="py-10 text-center text-muted-foreground">
                  No dining menu items found for {menuDateStrings.long}.
                </div>
              ) : !isMenuSearching ? (
                <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Use the search box above to look up specific dishes, dining halls, or nutrition facts without scrolling through the full menu.
                </div>
              ) : !hasMenuSearchResults ? (
                <div className="py-10 text-center text-muted-foreground">
                  No menu items matched “{menuSearch}” for {menuDateStrings.long}.
                </div>
              ) : (
                <div className="space-y-3">
                  {menuSearchResults.map((result, index) => {
                    const calories = getCaloriesFromItem(result.item)
                    const normalizedType = normalizeMealType(result.mealType)
                    const mealTypeLabel = formatMealTypeLabel(normalizedType)
                    const shouldShowSectionLabel = safeLower(result.sectionLabel) !== safeLower(mealTypeLabel)
                    const resultKey = `${result.location}-${result.mealType}-${result.item.name}-${index}`

                    return (
                      <div
                        key={resultKey}
                        className="rounded-lg border border-border/50 p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="rounded-md border border-border/40 bg-muted/40 p-2 text-muted-foreground">
                                {getMealTypeIcon(normalizedType)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{result.item.name}</p>
                                {result.item.description && (
                                  <p className="text-xs text-muted-foreground">{result.item.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[0.65rem] text-muted-foreground">
                              <Badge variant="outline" className="border-dashed px-2 py-0">
                                {mealTypeLabel}
                              </Badge>
                              {shouldShowSectionLabel && (
                                <Badge variant="outline" className="border-dashed px-2 py-0">
                                  {result.sectionLabel}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="px-2 py-0">
                                {result.location}
                              </Badge>
                            </div>
                            {result.item.nutritionFacts.length > 0 && (
                              <div className="flex flex-wrap gap-2 text-[0.65rem] text-muted-foreground">
                                {getFeaturedNutritionFacts(result.item.nutritionFacts).map((fact) => {
                                  const value = formatNutritionFactValue(fact)
                                  if (!value) return null
                                  return (
                                    <Badge
                                      key={`${result.item.name}-${fact.name}`}
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
                              onClick={() =>
                                handleAddFromMenu(
                                  result.mealType,
                                  result.item,
                                  result.location,
                                  result.sectionLabel
                                )
                              }
                            >
                              Add to Plate
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
            {totalProtein < proteinSuggestionTarget && (
              <div className="p-3 rounded-lg bg-[#e1ecfb] border border-[#b3c7e6]">
                <p className="text-sm text-[#0f3a78]">
                  🥩 You’ve logged {formatTwoDecimalString(totalProtein)}g protein. Aim for
                  {" "}
                  {formatTwoDecimalString(proteinSuggestionTarget)}g to stay on track.
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
