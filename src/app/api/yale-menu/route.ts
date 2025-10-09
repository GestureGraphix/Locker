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
  nutrition?: unknown
  nutrition_facts?: unknown
  nutritionFacts?: unknown
  nutrients?: unknown
  attributes?: Record<string, unknown> | null
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

const nutritionValueToNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number.parseFloat(trimmed.replace(/[^0-9.\-]+/g, ""))
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return undefined
}

const normalizeFactName = (name: string): string =>
  name
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(^|\s)([a-z])/g, (match) => match.toUpperCase())

const mergeNutritionFacts = (existing: NutritionFact[], incoming: NutritionFact[]): NutritionFact[] => {
  if (!incoming.length) return existing
  if (!existing.length) return incoming
  const map = new Map<string, NutritionFact>()

  const upsert = (fact: NutritionFact) => {
    const normalizedName = normalizeFactName(fact.name)
    const key = normalizedName.toLowerCase()
    const current = map.get(key)
    if (!current) {
      map.set(key, { ...fact, name: normalizedName })
      return
    }

    if (!current.display && fact.display) current.display = fact.display
    if (current.amount == null && fact.amount != null) current.amount = fact.amount
    if (!current.unit && fact.unit) current.unit = fact.unit
    if (current.percentDailyValue == null && fact.percentDailyValue != null) {
      current.percentDailyValue = fact.percentDailyValue
    }
  }

  existing.forEach(upsert)
  incoming.forEach(upsert)

  return Array.from(map.values())
}

const parseNutritionEntry = (entry: unknown, fallbackName?: string): NutritionFact | null => {
  if (!entry) return null

  if (typeof entry === "string" || typeof entry === "number") {
    const display = String(entry).trim()
    if (!display) return null
    const amount = nutritionValueToNumber(entry)
    const name = fallbackName?.trim()
    if (!name) return null
    return {
      name: normalizeFactName(name),
      display,
      amount
    }
  }

  if (typeof entry !== "object") return null

  const record = entry as Record<string, unknown>

  const rawName = record.name ?? record.label ?? record.title ?? fallbackName
  const nameCandidate =
    typeof rawName === "string" && rawName.trim().length > 0 ? rawName.trim() : fallbackName?.trim()
  if (!nameCandidate) return null
  const name = normalizeFactName(nameCandidate)

  const unitCandidates = [record.unit, record.units, record.uom, record.measureUnit, record.measure]
  const displayCandidates = [
    record.display,
    record.display_value,
    record.displayValue,
    record.text,
    record.value,
    record.amount,
    record.quantity,
    record.measure
  ]
  const amountCandidates = [
    record.amount,
    record.value,
    record.quantity,
    record.number,
    record.mass,
    record.grams,
    record.milligrams
  ]
  const percentCandidates = [
    record.percentDailyValue,
    record.percent_dv,
    record.percentDV,
    record.dailyValuePercent,
    record.daily_value_percent,
    record.percent,
    record.pct,
    record.dv
  ]

  let unit: string | undefined
  for (const candidate of unitCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      unit = candidate.trim()
      break
    }
  }

  let amount: number | undefined
  for (const candidate of amountCandidates) {
    amount = nutritionValueToNumber(candidate)
    if (amount != null) break
  }

  let display: string | undefined
  for (const candidate of displayCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      display = candidate.trim()
      break
    }
  }

  if (!display && amount != null) {
    display = unit ? `${amount} ${unit}`.trim() : `${amount}`
  }

  let percentDailyValue: number | undefined
  for (const candidate of percentCandidates) {
    percentDailyValue = nutritionValueToNumber(candidate)
    if (percentDailyValue != null) break
  }

  if (!display && amount == null) return null

  return {
    name,
    amount,
    unit,
    percentDailyValue,
    display
  }
}

const extractNutritionFacts = (food: WeeksFood | null | undefined): NutritionFact[] => {
  if (!food) return []

  const seen = new Map<string, NutritionFact>()

  const upsert = (fact: NutritionFact | null) => {
    if (!fact) return
    const normalizedName = normalizeFactName(fact.name)
    const key = normalizedName.toLowerCase()
    if (!key) return
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, { ...fact, name: normalizedName })
      return
    }

    if (!existing.display && fact.display) existing.display = fact.display
    if (existing.amount == null && fact.amount != null) existing.amount = fact.amount
    if (!existing.unit && fact.unit) existing.unit = fact.unit
    if (existing.percentDailyValue == null && fact.percentDailyValue != null) {
      existing.percentDailyValue = fact.percentDailyValue
    }
  }

  const processSource = (source: unknown, fallbackName?: string) => {
    if (!source) return

    if (Array.isArray(source)) {
      source.forEach((entry) => processSource(entry, fallbackName))
      return
    }

    if (typeof source === "string" || typeof source === "number") {
      upsert(parseNutritionEntry(source, fallbackName))
      return
    }

    if (typeof source !== "object") return

    const record = source as Record<string, unknown>

    const directFact = parseNutritionEntry(record, fallbackName)
    if (directFact) {
      upsert(directFact)
    }

    for (const [key, value] of Object.entries(record)) {
      if (key === "name" || key === "label" || key === "title") continue
      const label =
        typeof value === "object" && value && typeof (value as Record<string, unknown>).name === "string"
          ? ((value as Record<string, unknown>).name as string)
          : key
      processSource(value, label)
    }
  }

  const potentialSources = [
    (food as Record<string, unknown>).nutrition,
    (food as Record<string, unknown>).nutrition_facts,
    (food as Record<string, unknown>).nutritionFacts,
    (food as Record<string, unknown>).nutrients,
    (food as Record<string, unknown>).nutrient_list,
    (food as Record<string, unknown>).nutrientInfo,
    (food as Record<string, unknown>).nutrition_info,
    (food as Record<string, unknown>).analysis,
    (food as Record<string, unknown>).full_nutrition,
    (food as Record<string, unknown>).additional_nutrition,
    (food as Record<string, unknown>).attributes &&
      typeof (food as Record<string, unknown>).attributes === "object"
      ? ((food as Record<string, unknown>).attributes as Record<string, unknown>).nutrition
      : undefined,
    (food as Record<string, unknown>).attributes &&
      typeof (food as Record<string, unknown>).attributes === "object"
      ? ((food as Record<string, unknown>).attributes as Record<string, unknown>).nutrients
      : undefined
  ]

  for (const source of potentialSources) {
    processSource(source)
  }

  return Array.from(seen.values())
}

const extractCalories = (food: WeeksFood | null | undefined, facts: NutritionFact[]): number | undefined => {
  const calorieCandidates: unknown[] = []

  if (food && typeof food === "object") {
    const record = food as Record<string, unknown>
    calorieCandidates.push(record.calories, record.calorie, record.kcal)

    const directNutrition = record.nutrition as Record<string, unknown> | undefined
    if (directNutrition && typeof directNutrition === "object") {
      calorieCandidates.push(
        (directNutrition as Record<string, unknown>).calories,
        (directNutrition as Record<string, unknown>).calorie,
        (directNutrition as Record<string, unknown>).kcal
      )
    }

    const attributes = record.attributes as Record<string, unknown> | undefined
    if (attributes && typeof attributes === "object") {
      calorieCandidates.push(attributes.calories, attributes.calorie, attributes.kcal)
      const attrNutrition = attributes.nutrition as Record<string, unknown> | undefined
      if (attrNutrition && typeof attrNutrition === "object") {
        calorieCandidates.push(
          attrNutrition.calories,
          attrNutrition.calorie,
          attrNutrition.kcal
        )
      }
    }
  }

  for (const candidate of calorieCandidates) {
    const parsed = nutritionValueToNumber(candidate)
    if (parsed != null) return parsed
  }

  for (const fact of facts) {
    if (fact.name.toLowerCase().includes("calorie")) {
      if (fact.amount != null) return fact.amount
      const parsed = nutritionValueToNumber(fact.display)
      if (parsed != null) return parsed
    }
  }

  return undefined
}

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

/** Convert the weeks/day payload to your MenuMeal[] (skip null separators, de-dupe by name) */
function buildMealsFromWeeks(day: WeeksDay): MenuMeal[] {
  const items: MenuItem[] = []

  for (const mi of day.menu_items ?? []) {
    const food = mi?.food
    const name = food?.name
    if (!name) continue // skip the null rows you saw in jq
    const description = food?.description?.trim() || undefined
    const nutritionFacts = extractNutritionFacts(food)
    const calories = extractCalories(food, nutritionFacts)

    items.push({
      name: String(name).trim(),
      description,
      calories,
      nutritionFacts
    })
  }

  const deduped = dedupeByName(items)
  // The weeks/menu-type endpoint is scoped to a single meal,
  // but to keep the outward shape stable, return both buckets.
  return [
    { mealType: "Lunch", items: deduped },
    { mealType: "Dinner", items: deduped }
  ]
}

function dedupeByName(items: MenuItem[]): MenuItem[] {
  const map = new Map<string, MenuItem>()
  for (const it of items) {
    const key = it.name
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...it, nutritionFacts: [...it.nutritionFacts] })
      continue
    }

    if (!existing.description && it.description) existing.description = it.description
    if (existing.calories == null && it.calories != null) existing.calories = it.calories
    existing.nutritionFacts = mergeNutritionFacts(existing.nutritionFacts, it.nutritionFacts)
  }
  return Array.from(map.values())
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

    const meals = buildMealsFromWeeks(day)
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
