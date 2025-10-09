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
type MenuItem = {
  name: string
  description?: string
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

/** Convert the weeks/day payload to your MenuMeal[] (skip null separators, de-dupe by name) */
function buildMealsFromWeeks(day: WeeksDay): MenuMeal[] {
  const items: MenuItem[] = []

  for (const mi of day.menu_items ?? []) {
    const name = mi?.food?.name
    if (!name) continue // skip the null rows you saw in jq
    const description = mi?.food?.description?.trim() || undefined
    items.push({ name: String(name).trim(), description })
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
  const seen = new Set<string>()
  const out: MenuItem[] = []
  for (const it of items) {
    if (seen.has(it.name)) continue
    seen.add(it.name)
    out.push(it)
  }
  return out
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
