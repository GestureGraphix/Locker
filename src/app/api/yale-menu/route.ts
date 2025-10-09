// src/app/api/yale-menu/route.ts
import { NextRequest, NextResponse } from "next/server"

const NUTRISLICE_BASE_URL = "https://yaledining.api.nutrislice.com/menu/api" // <-- FIXED HOST
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const SCHOOL_SLUG = "jonathan-edwards-college"

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

type MenuMeal = { mealType: string; items: MenuItem[] }
type MenuLocation = { location: string; meals: MenuMeal[] }

type WeeksMenuItem = {
  food?: { id?: number; name?: string; description?: string | null }
  station?: { name?: string } | null
}

type WeeksDay = {
  date?: string
  menu_items?: WeeksMenuItem[]
}

const TARGET_MEAL_KEYS = new Set(["lunch", "dinner"])
const normalizeMealName = (m: string) =>
  m.trim().replace(/[-_]/g, " ").replace(/\s+/g, " ").replace(/(^|\s)([a-z])/g, s => s.toUpperCase())

const REQUEST_HEADERS: HeadersInit = {
  "User-Agent": USER_AGENT,
  Accept: "application/json",
  Origin: "https://yaledining.nutrislice.com",
  Referer: "https://yaledining.nutrislice.com/",
  "Accept-Language": "en-US,en;q=0.9"
}

type NutritionLookup = Map<number, { calories?: number; nutritionFacts: NutritionFact[] }>

const ensureNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.\-]+/g, ""))
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const pickString = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
}

const pickNumber = (source: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = ensureNumber(source[key])
    if (value != null) {
      return value
    }
  }
  return undefined
}

const normalizeFactList = (facts: unknown): NutritionFact[] => {
  if (!Array.isArray(facts)) return []
  return facts
    .filter(isRecord)
    .map((fact): NutritionFact | null => {
      const name = pickString(fact, ["name", "label", "title"])
      if (!name) return null
      const amount = pickNumber(fact, ["amount", "value", "quantity", "grams"])
      const unit = pickString(fact, ["unit", "unit_name", "uom", "unitShort"])
      const percentDailyValue = pickNumber(fact, ["percentDailyValue", "percent_daily_value", "pdv", "daily_value_percent"])
      const rawDisplay = pickString(fact, ["display", "display_value", "displayValue"])
      const display = rawDisplay
        ? rawDisplay
        : amount != null
          ? `${amount}${unit ? ` ${unit}` : ""}`.trim()
          : undefined

      return {
        name,
        amount,
        unit,
        percentDailyValue,
        display
      }
    })
    .filter((fact): fact is NutritionFact => Boolean(fact))
}

const extractCaloriesFromFacts = (facts: NutritionFact[]): number | undefined => {
  const calorieFact = facts.find(f => f.name.toLowerCase().includes("calorie"))
  return calorieFact?.amount ?? ensureNumber(calorieFact?.display)
}

async function fetchMenuItemNutrition(id: number) {
  const url = `${NUTRISLICE_BASE_URL}/menuitem/${id}/?format=json`
  const res = await fetch(url, {
    headers: REQUEST_HEADERS,
    cache: "no-store"
  })
  if (!res.ok) throw new Error(`menu item ${id} failed ${res.status}`)
  const data = await res.json()
  const facts = normalizeFactList(
    data?.nutrition_facts ?? data?.nutritionFacts ?? data?.full_nutrition?.facts ?? data?.facts ?? data?.nutrition?.facts
  )
  const calories =
    ensureNumber(data?.calories ?? data?.nutrition?.calories ?? data?.full_nutrition?.calories) ?? extractCaloriesFromFacts(facts)

  return { calories, nutritionFacts: facts }
}

async function buildNutritionLookup(ids: number[]): Promise<NutritionLookup> {
  const lookup: NutritionLookup = new Map()
  const uniqueIds = Array.from(new Set(ids.filter((id): id is number => typeof id === "number")))
  if (uniqueIds.length === 0) return lookup

  await Promise.all(
    uniqueIds.map(async id => {
      try {
        const info = await fetchMenuItemNutrition(id)
        lookup.set(id, info)
      } catch {
        // ignore errors so a single item failure doesn't break the menu
      }
    })
  )

  return lookup
}

const buildFallbackResponse = (date: string, error: string) =>
  NextResponse.json({
    date,
    source: "fallback" as const,
    menu: [
      {
        location: "Jonathan Edwards College",
        meals: [
          {
            mealType: "Lunch",
            items: [
              {
                name: "Grilled Chicken Bowl",
                description: "Brown rice, roasted vegetables, chimichurri",
                calories: 520,
                nutritionFacts: [
                  { name: "Calories", amount: 520, unit: "cal" },
                  { name: "Protein", amount: 42, unit: "g" },
                  { name: "Total Carbohydrate", amount: 48, unit: "g" },
                  { name: "Total Fat", amount: 16, unit: "g" }
                ]
              },
              {
                name: "Seasonal Power Salad",
                description: "Kale, quinoa, chickpeas, lemon tahini",
                calories: 360,
                nutritionFacts: [
                  { name: "Calories", amount: 360, unit: "cal" },
                  { name: "Protein", amount: 14, unit: "g" },
                  { name: "Total Carbohydrate", amount: 42, unit: "g" },
                  { name: "Dietary Fiber", amount: 8, unit: "g" }
                ]
              }
            ]
          },
          {
            mealType: "Dinner",
            items: [
              {
                name: "Herb Roasted Salmon",
                description: "Farro pilaf, citrus greens",
                calories: 480,
                nutritionFacts: [
                  { name: "Calories", amount: 480, unit: "cal" },
                  { name: "Protein", amount: 38, unit: "g" },
                  { name: "Total Fat", amount: 22, unit: "g" },
                  { name: "Total Carbohydrate", amount: 32, unit: "g" }
                ]
              },
              {
                name: "Mediterranean Grain Bowl",
                description: "Bulgar wheat, roasted vegetables, hummus",
                calories: 420,
                nutritionFacts: [
                  { name: "Calories", amount: 420, unit: "cal" },
                  { name: "Protein", amount: 18, unit: "g" },
                  { name: "Total Carbohydrate", amount: 54, unit: "g" },
                  { name: "Dietary Fiber", amount: 10, unit: "g" }
                ]
              }
            ]
          },
        ],
      },
    ],
    error,
  })

// --- NEW: fetch the same endpoint as your working curl:
async function fetchWeeksMenuByMeal(school: string, meal: string, date: string) {
  const [y, m, d] = date.split("-")
  const url = `${NUTRISLICE_BASE_URL}/weeks/school/${encodeURIComponent(
    school
  )}/menu-type/${encodeURIComponent(meal.toLowerCase())}/${y}/${m}/${d}/?format=json`

  const res = await fetch(url, {
    headers: REQUEST_HEADERS,
    cache: "no-store"
  })
  if (!res.ok) throw new Error(`weeks menu failed ${res.status}`)
  return res.json() as Promise<{
    days?: WeeksDay[]
  }>
}

// --- parse out items for the target date, skipping the null separators you saw in jq:
function buildMealsFromWeeks(day: WeeksDay | undefined, nutritionLookup: NutritionLookup): MenuMeal[] {
  const buckets: Record<string, MenuItem[]> = { Lunch: [], Dinner: [] }

  for (const mi of day?.menu_items ?? []) {
    const id = mi?.food?.id
    const name = mi?.food?.name
    if (id == null || !name) continue // skip null rows
    const nutrition = typeof id === "number" ? nutritionLookup.get(id) : undefined
    const item: MenuItem = {
      name: String(name).trim(),
      description: mi?.food?.description?.trim() || undefined,
      calories: nutrition?.calories,
      nutritionFacts: nutrition?.nutritionFacts ?? [],
    }
    // we don’t actually get the “meal” label per item in this payload,
    // but this endpoint is already scoped to a single meal (dinner/lunch).
    // We’ll just return it under a single bucket; the caller decides which one.
    // (If you call for dinner, it’ll be Dinner; for lunch, Lunch.)
    // We fill both here and pick the right one in the caller for simplicity.
    buckets.Lunch.push(item)
    buckets.Dinner.push(item)
  }

  return [
    { mealType: "Lunch", items: dedupeByName(buckets.Lunch) },
    { mealType: "Dinner", items: dedupeByName(buckets.Dinner) },
  ]
}

function dedupeByName(items: MenuItem[]) {
  const seen = new Set<string>()
  const out: MenuItem[] = []
  for (const it of items) {
    if (seen.has(it.name)) continue
    seen.add(it.name)
    out.push(it)
  }
  return out
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10)
  const meal = (url.searchParams.get("meal") ?? "dinner").toLowerCase()

  try {
    if (!TARGET_MEAL_KEYS.has(meal)) {
      return buildFallbackResponse(date, `Unsupported meal "${meal}". Use one of: ${[...TARGET_MEAL_KEYS].join(", ")}`)
    }

    // hit the exact same weeks endpoint as your curl:
    const weeks = await fetchWeeksMenuByMeal(SCHOOL_SLUG, meal, date)
    const day = weeks?.days?.find(d => d?.date === date)
    if (!day) return buildFallbackResponse(date, `No menu found for ${SCHOOL_SLUG} ${meal} on ${date}`)

    const itemIds = (day?.menu_items ?? [])
      .map(entry => (typeof entry?.food?.id === "number" ? entry.food.id : null))
      .filter((id): id is number => id !== null)
    const nutritionLookup = await buildNutritionLookup(itemIds)

    const meals = buildMealsFromWeeks(day, nutritionLookup)
    const picked = meals.find(m => m.mealType.toLowerCase() === normalizeMealName(meal).toLowerCase()) ?? meals[0]

    const payload: { date: string; source: "live"; menu: MenuLocation[] } = {
      date,
      source: "live",
      menu: [
        {
          location: "Jonathan Edwards College",
          meals: [picked],
        },
      ],
    }
    return NextResponse.json(payload)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return buildFallbackResponse(date, msg)
  }
}
