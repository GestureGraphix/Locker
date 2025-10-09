// src/app/api/yale-menu/route.ts
import { NextRequest, NextResponse } from "next/server"

const NUTRISLICE_BASE_URL = "https://yaledining.api.nutrislice.com/menu/api" // <-- FIXED HOST
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const SCHOOL_SLUG = "jonathan-edwards-college"

type MenuItem = {
  name: string
  description?: string
  calories?: number
  nutritionFacts: { name: string; amount?: number; unit?: string; percentDailyValue?: number; display?: string }[]
}

type MenuMeal = { mealType: string; items: MenuItem[] }
type MenuLocation = { location: string; meals: MenuMeal[] }

const TARGET_MEAL_KEYS = new Set(["lunch", "dinner"])
const normalizeMealName = (m: string) =>
  m.trim().replace(/[-_]/g, " ").replace(/\s+/g, " ").replace(/(^|\s)([a-z])/g, s => s.toUpperCase())

const buildFallbackResponse = (date: string, error: string) =>
  NextResponse.json({
    date,
    source: "fallback" as const,
    menu: [
      {
        location: "Jonathan Edwards College",
        meals: [
          { mealType: "Lunch", items: [] },
          { mealType: "Dinner", items: [] },
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
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Origin: "https://yaledining.nutrislice.com",
      Referer: "https://yaledining.nutrislice.com/",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`weeks menu failed ${res.status}`)
  return res.json() as Promise<{
    days?: Array<{
      date?: string
      menu_items?: Array<{
        food?: { id?: number; name?: string; description?: string | null }
        station?: { name?: string } | null
      }>
    }>
  }>
}

// --- parse out items for the target date, skipping the null separators you saw in jq:
function buildMealsFromWeeks(day: any): MenuMeal[] {
  const buckets: Record<string, MenuItem[]> = { Lunch: [], Dinner: [] }

  for (const mi of day?.menu_items ?? []) {
    const id = mi?.food?.id
    const name = mi?.food?.name
    if (id == null || !name) continue // skip null rows
    const item: MenuItem = {
      name: String(name).trim(),
      description: mi?.food?.description?.trim() || undefined,
      calories: undefined,
      nutritionFacts: [],
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

    const meals = buildMealsFromWeeks(day)
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
