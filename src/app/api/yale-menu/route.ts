// src/app/api/yale-menu/route.ts
import { NextRequest, NextResponse } from "next/server"

/** Use the SAME host as your working curl */
const NUTRISLICE_BASE_URL = "https://yaledining.api.nutrislice.com/menu/api"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

/** JE page slug (works with the weeks/menu-type path) */
const SCHOOL_SLUG = "jonathan-edwards-college"

/** --- Response types for the weeks/menu-type endpoint --- */
type WeeksFood = {
  id?: number
  name?: string
  description?: string | null
}

type WeeksMenuItem = {
  food?: WeeksFood | null
  station?: { name?: string } | null
}

type WeeksDay = {
  date?: string
  menu_items?: WeeksMenuItem[]
}

type WeeksResponse = {
  days?: WeeksDay[]
}

/** --- Your outward API types (lightweight) --- */
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

/** Supported meal keys */
const TARGET_MEAL_KEYS = new Set(["lunch", "dinner"])

const normalizeMealName = (m: string) =>
  m.trim().replace(/[-_]/g, " ").replace(/\s+/g, " ").replace(/(^|\s)([a-z])/g, (s) => s.toUpperCase())

/** Minimal fallback so your route never 500s */
const buildFallbackResponse = (date: string, error: string) =>
  NextResponse.json({
    date,
    source: "fallback" as const,
    menu: [
      {
        location: "Jonathan Edwards College",
        meals: [
          { mealType: "Lunch", items: [] },
          { mealType: "Dinner", items: [] }
        ]
      }
    ],
    error
  })

/** Fetch the SAME URL shape as your working curl */
async function fetchWeeksMenuByMeal(school: string, meal: string, date: string): Promise<WeeksResponse> {
  const [y, m, d] = date.split("-")
  const url = `${NUTRISLICE_BASE_URL}/weeks/school/${encodeURIComponent(
    school
  )}/menu-type/${encodeURIComponent(meal.toLowerCase())}/${y}/${m}/${d}/?format=json`

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Origin: "https://yaledining.nutrislice.com",
      Referer: "https://yaledining.nutrislice.com/",
      "Accept-Language": "en-US,en;q=0.9"
    },
    cache: "no-store"
  })
  if (!res.ok) throw new Error(`weeks menu failed ${res.status}`)
  const json = (await res.json()) as unknown
  return (typeof json === "object" && json !== null ? (json as WeeksResponse) : {}) as WeeksResponse
}

/** Utilities to transform the weeks/day payload into menu items with nutrition data */
type RawMenuItem = {
  name: string
  description?: string
  foodId?: number
}

type FoodNutrition = {
  calories?: number
  nutritionFacts: NutritionFact[]
}

const toArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number.parseFloat(trimmed.replace(/[^0-9.\-]+/g, ""))
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

const parseString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }
  return undefined
}

const normalizeNutritionEntry = (entry: unknown): NutritionFact | null => {
  if (!entry || typeof entry !== "object") return null
  const record = entry as Record<string, unknown>

  const nutrient = record.nutrient
  const name =
    parseString(
      typeof nutrient === "object" && nutrient !== null
        ? (nutrient as Record<string, unknown>).name ?? (nutrient as Record<string, unknown>).short_name
        : undefined
    ) ||
    parseString(record.name) ||
    parseString(record.short_name) ||
    parseString(record.display_name)

  if (!name) return null

  const unit =
    parseString(record.unit) ||
    parseString(record.uom) ||
    parseString(record.measure_unit) ||
    parseString(record.measure)

  const percentDailyValue =
    parseNumber(record.percent_daily_value) ??
    parseNumber(record.daily_value) ??
    parseNumber(record.daily_percent)

  const valueSource =
    record.value ??
    record.amount ??
    record.quantity ??
    record.display ??
    record.measure ??
    record.formatted_value ??
    record.display_value

  const amount = parseNumber(valueSource)
  const fallbackDisplay = parseString(valueSource)
  const explicitDisplay =
    parseString(record.display) ||
    parseString(record.formatted_value) ||
    parseString(record.display_value)

  const fact: NutritionFact = { name }
  if (amount != null) {
    fact.amount = amount
  }
  if (unit) {
    fact.unit = unit
  }
  if (explicitDisplay) {
    fact.display = explicitDisplay
  } else if (fallbackDisplay && fact.amount == null) {
    fact.display = fallbackDisplay
  }
  if (percentDailyValue != null) {
    fact.percentDailyValue = percentDailyValue
  }

  if (
    fact.amount == null &&
    !fact.display &&
    fact.unit == null &&
    fact.percentDailyValue == null
  ) {
    return null
  }

  return fact
}

const normalizeFoodNutrition = (detail: unknown): FoodNutrition | null => {
  if (!detail || typeof detail !== "object") return null
  const record = detail as Record<string, unknown>

  const factsMap = new Map<string, NutritionFact>()
  let calories = parseNumber(record.calories ?? record.kcal ?? record.energy)

  const servingSizeValue =
    parseString(record.serving_size) ??
    parseString(record.portion_size) ??
    parseString(record.servingSize)
  const servingSizeUnit = parseString(record.serving_size_unit)
  let servingSize: string | undefined
  if (servingSizeValue || servingSizeUnit) {
    servingSize = [servingSizeValue, servingSizeUnit].filter(Boolean).join(" ").trim()
  }

  const nutritionCollections = [
    record.nutrition,
    record.nutrients,
    record.nutrition_facts,
    record.nutritionFacts,
    record.nutrient_data,
    record.nutrientData,
    record.nutrition_information,
    record.nutritionInformation
  ]
  for (const collection of nutritionCollections) {
    const directEntries = toArray<Record<string, unknown>>(collection)
    const nestedEntries =
      !Array.isArray(collection) &&
      collection &&
      typeof collection === "object"
        ? toArray<Record<string, unknown>>((collection as Record<string, unknown>).items)
        : []

    for (const entry of [...directEntries, ...nestedEntries]) {
      const fact = normalizeNutritionEntry(entry)
      if (!fact) continue
      const key = fact.name.toLowerCase()
      const existing = factsMap.get(key)

      if (!existing) {
        factsMap.set(key, fact)
      } else {
        const existingScore = (existing.amount != null ? 2 : 0) + (existing.percentDailyValue != null ? 1 : 0)
        const newScore = (fact.amount != null ? 2 : 0) + (fact.percentDailyValue != null ? 1 : 0)
        if (newScore > existingScore) {
          factsMap.set(key, { ...existing, ...fact })
        } else if (newScore === existingScore) {
          factsMap.set(key, {
            ...existing,
            amount: existing.amount ?? fact.amount,
            unit: existing.unit ?? fact.unit,
            percentDailyValue: existing.percentDailyValue ?? fact.percentDailyValue,
            display: existing.display ?? fact.display
          })
        }
      }

      if (
        !calories &&
        fact.amount != null &&
        fact.name.toLowerCase().includes("calorie")
      ) {
        calories = fact.amount
      }
    }
  }

  if (calories != null && !factsMap.has("calories")) {
    factsMap.set("calories", { name: "Calories", amount: calories })
  }

  const facts = Array.from(factsMap.values())
  if (servingSize && !factsMap.has("serving size")) {
    facts.unshift({ name: "Serving Size", display: servingSize })
  }

  return {
    calories,
    nutritionFacts: facts
  }
}

const fetchFoodNutrition = async (foodId: number): Promise<FoodNutrition | null> => {
  const url = `${NUTRISLICE_BASE_URL}/foods/${foodId}/?format=json`
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Origin: "https://yaledining.nutrislice.com",
        Referer: "https://yaledining.nutrislice.com/",
        "Accept-Language": "en-US,en;q=0.9"
      },
      cache: "no-store"
    })
    if (!res.ok) return null
    const json = await res.json()
    return normalizeFoodNutrition(json)
  } catch {
    return null
  }
}

async function fetchNutritionForFoodIds(foodIds: number[]): Promise<Map<number, FoodNutrition>> {
  const uniqueIds = Array.from(
    new Set(foodIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id)))
  )
  const out = new Map<number, FoodNutrition>()
  if (!uniqueIds.length) return out

  const chunkSize = 5
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize)
    const results = await Promise.allSettled(chunk.map((id) => fetchFoodNutrition(id)))
    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        out.set(chunk[idx], result.value)
      }
    })
  }

  return out
}

const collectRawMenuItems = (day: WeeksDay): RawMenuItem[] => {
  const items: RawMenuItem[] = []
  for (const mi of day.menu_items ?? []) {
    const name = mi?.food?.name
    if (!name) continue
    const rawName = String(name).trim()
    if (!rawName) continue
    const description = parseString(mi?.food?.description)
    const foodId = typeof mi?.food?.id === "number" ? mi.food.id : undefined
    items.push({ name: rawName, description, foodId })
  }
  return items
}

const enrichMenuItems = async (items: RawMenuItem[]): Promise<MenuItem[]> => {
  if (!items.length) return []
  const nutritionMap = await fetchNutritionForFoodIds(
    items
      .map((item) => item.foodId)
      .filter((id): id is number => typeof id === "number")
  )

  return items.map((item) => {
    const nutrition = item.foodId != null ? nutritionMap.get(item.foodId) : undefined
    return {
      name: item.name,
      description: item.description,
      calories: nutrition?.calories,
      nutritionFacts: nutrition ? [...nutrition.nutritionFacts] : []
    }
  })
}

const mergeMenuItems = (existing: MenuItem, incoming: MenuItem): MenuItem => {
  const existingFacts = existing.nutritionFacts
  const incomingFacts = incoming.nutritionFacts
  let chosenFacts = existingFacts
  if (incomingFacts.length > existingFacts.length && incomingFacts.length > 0) {
    chosenFacts = incomingFacts
  } else if (existingFacts.length === 0 && incomingFacts.length) {
    chosenFacts = incomingFacts
  }

  const description =
    existing.description && existing.description.length >= (incoming.description?.length ?? 0)
      ? existing.description
      : incoming.description ?? existing.description

  return {
    name: existing.name,
    description,
    calories: existing.calories ?? incoming.calories,
    nutritionFacts: [...chosenFacts]
  }
}

const dedupeMenuItems = (items: MenuItem[]): MenuItem[] => {
  const map = new Map<string, MenuItem>()
  for (const item of items) {
    const key = item.name.trim().toLowerCase()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...item, nutritionFacts: [...item.nutritionFacts] })
    } else {
      map.set(key, mergeMenuItems(existing, item))
    }
  }
  return Array.from(map.values())
}

const buildMealsFromItems = (items: MenuItem[]): MenuMeal[] => {
  const deduped = dedupeMenuItems(items)
  return [
    { mealType: "Lunch", items: deduped },
    { mealType: "Dinner", items: deduped }
  ]
}

/** GET /api/yale-menu?date=YYYY-MM-DD&meal=dinner|lunch */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10)
  const mealRaw = (url.searchParams.get("meal") ?? "dinner").toLowerCase()
  const meal = TARGET_MEAL_KEYS.has(mealRaw) ? mealRaw : "dinner"

  try {
    const weeks = await fetchWeeksMenuByMeal(SCHOOL_SLUG, meal, date)
    const day: WeeksDay | undefined = weeks?.days?.find((d) => d?.date === date)
    if (!day) return buildFallbackResponse(date, `No menu found for ${SCHOOL_SLUG} ${meal} on ${date}`)

    const rawItems = collectRawMenuItems(day)
    const enrichedItems = await enrichMenuItems(rawItems)
    const meals = buildMealsFromItems(enrichedItems)
    const picked =
      meals.find((m) => m.mealType.toLowerCase() === normalizeMealName(meal).toLowerCase()) ??
      meals.find((m) => m.mealType.toLowerCase() === "dinner") ??
      meals[0]

    const payload: { date: string; source: "live"; menu: MenuLocation[] } = {
      date,
      source: "live",
      menu: [
        {
          location: "Jonathan Edwards College",
          meals: [picked]
        }
      ]
    }
    return NextResponse.json(payload)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return buildFallbackResponse(date, msg)
  }
}
