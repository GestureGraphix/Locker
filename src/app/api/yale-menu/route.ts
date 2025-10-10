import { NextRequest, NextResponse } from "next/server"

const NUTRISLICE_BASE_URL = "https://yaledining.api.nutrislice.com/menu/api"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const SCHOOL_SLUG = "jonathan-edwards-college"
const LOCATION_ID = "57753"

/* ---------------- Types ---------------- */
type WeeksFood = {
  id?: number // food id
  name?: string
  description?: string | null
}
type WeeksMenuItem = {
  id?: number // menu-item id (needed for order-settings)
  food?: WeeksFood | null
}
type WeeksDay = { date?: string; menu_items?: WeeksMenuItem[] }
type WeeksResponse = { days?: WeeksDay[] }

type NutritionFact = {
  name: string
  amount?: number
  unit?: string
  display?: string
}
type MenuItem = {
  id: number               // prefer food id if present
  menuItemId?: number      // menu-item id used for order-settings
  name: string
  description?: string
  calories: number
  proteinG: number
  sodiumMg: number
  fatG: number
  carbsG: number
  servingSize: string | undefined
  nutritionFacts: NutritionFact[]
}
type MenuMeal = { mealType: string; items: MenuItem[] }

/* ---------------- Utils ---------------- */
const TARGET_MEAL_KEYS = new Set(["lunch", "dinner"])
const normalizeMealName = (m: string) =>
  m.trim().replace(/[-_]/g, " ").replace(/\s+/g, " ").replace(/(^|\s)([a-z])/g, (s) => s.toUpperCase())

const nutritionValueToNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number.parseFloat(trimmed.replace(/[^0-9.\-]+/g, ""))
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

/* -------------- Fetch helper -------------- */
async function safeFetchJSON<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T | null> {
  const { timeoutMs = 8000, ...opts } = init
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/* ---------------- Nutrislice calls ---------------- */
async function fetchWeeksMenuByMeal(school: string, meal: string, date: string): Promise<WeeksResponse | null> {
  const [y, m, d] = date.split("-")
  const url = `${NUTRISLICE_BASE_URL}/weeks/school/${encodeURIComponent(
    school
  )}/menu-type/${encodeURIComponent(meal.toLowerCase())}/${y}/${m}/${d}/?format=json`

  return await safeFetchJSON<WeeksResponse>(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Origin: "https://yaledining.nutrislice.com",
      Referer: "https://yaledining.nutrislice.com/"
    },
    cache: "no-store",
    timeoutMs: 9000
  })
}

async function fetchOrderSettings(
  menuItemId: number,
  date: string
): Promise<{
  calories: number
  proteinG: number
  sodiumMg: number
  fatG: number
  carbsG: number
  servingSize: string | undefined
  facts: NutritionFact[]
}> {
  const url = `${NUTRISLICE_BASE_URL}/menu-items/${menuItemId}/order-settings/?location-id=${encodeURIComponent(
    LOCATION_ID
  )}&menu-date=${encodeURIComponent(date)}`

  const json = await safeFetchJSON<Record<string, unknown>>(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Origin: "https://yaledining.nutrislice.com",
      Referer: "https://yaledining.nutrislice.com/"
    },
    cache: "no-store",
    timeoutMs: 9000
  })
  if (!json) return { calories: 0, proteinG: 0, sodiumMg: 0, fatG: 0, carbsG: 0, servingSize: undefined, facts: [] }

  const tax = (json["tax_nutrition_info"] || {}) as Record<string, unknown>
  const raw = (json["raw_nutrition_info"] || {}) as Record<string, unknown>

  const calories =
    nutritionValueToNumber(tax["calories"]) ??
    nutritionValueToNumber(raw["calories"]) ??
    0

  const proteinG =
    nutritionValueToNumber(tax["g_protein"]) ??
    nutritionValueToNumber(raw["g_protein"]) ??
    0

  const sodiumMg =
    nutritionValueToNumber(tax["mg_sodium"]) ??
    nutritionValueToNumber(raw["mg_sodium"]) ??
    0

  const fatG =
    nutritionValueToNumber(tax["g_fat"]) ??
    nutritionValueToNumber(raw["g_fat"]) ??
    0

  const carbsG =
    nutritionValueToNumber(tax["g_carbs"]) ??
    nutritionValueToNumber(raw["g_carbs"]) ??
    0

  const portionSize = json["portion_size"]
  const portionUnit = json["portion_size_unit"]
  const servingSize =
    (typeof portionSize === "number" || typeof portionSize === "string") && typeof portionUnit === "string"
      ? `${portionSize} ${portionUnit}`.trim()
      : undefined

  const facts: NutritionFact[] = [
    { name: "Calories", amount: calories, display: `${calories}` },
    { name: "Protein", unit: "g", amount: proteinG, display: `${proteinG} g` },
    { name: "Sodium", unit: "mg", amount: sodiumMg, display: `${sodiumMg} mg` },
    { name: "Fat", unit: "g", amount: fatG, display: `${fatG} g` },
    { name: "Carbs", unit: "g", amount: carbsG, display: `${carbsG} g` }
  ]

  return { calories, proteinG, sodiumMg, fatG, carbsG, servingSize, facts }
}

/* ---------------- Item metadata (name/desc) ---------------- */
type ItemMeta = { id: number; name?: string; description?: string | null }
const itemMetaCache = new Map<number, ItemMeta>() // per-invocation cache

async function fetchItemMetaFromMenuItem(id: number): Promise<ItemMeta | null> {
  const url = `${NUTRISLICE_BASE_URL}/menu-items/${id}/?format=json`
  const json = await safeFetchJSON<Record<string, unknown>>(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Origin: "https://yaledining.nutrislice.com",
      Referer: "https://yaledining.nutrislice.com/"
    },
    cache: "no-store",
    timeoutMs: 9000
  })
  if (!json) return null
  const name = typeof json["name"] === "string" ? json["name"].trim() : undefined
  const description = typeof json["description"] === "string" ? json["description"].trim() : undefined
  return { id, name, description: description ?? null }
}

async function fetchItemMetaFromFood(id: number): Promise<ItemMeta | null> {
  const url = `${NUTRISLICE_BASE_URL}/foods/${id}/?format=json`
  const json = await safeFetchJSON<Record<string, unknown>>(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Origin: "https://yaledining.nutrislice.com",
      Referer: "https://yaledining.nutrislice.com/"
    },
    cache: "no-store",
    timeoutMs: 9000
  })
  if (!json) return null
  const name = typeof json["name"] === "string" ? json["name"].trim() : undefined
  const description = typeof json["description"] === "string" ? json["description"].trim() : undefined
  return { id, name, description: description ?? null }
}

async function resolveItemMeta(
  menuItemId?: number,
  foodId?: number,
  fallback?: { name?: string; description?: string | null }
) {
  const key = menuItemId ?? foodId
  if (key && itemMetaCache.has(key)) return itemMetaCache.get(key)!

  if (fallback?.name || fallback?.description) {
    const meta = { id: key ?? -1, name: fallback.name, description: fallback.description ?? null }
    if (key) itemMetaCache.set(key, meta)
    return meta
  }
  if (menuItemId) {
    const m = await fetchItemMetaFromMenuItem(menuItemId)
    if (m?.name) {
      itemMetaCache.set(menuItemId, m)
      return m
    }
  }
  if (foodId) {
    const f = await fetchItemMetaFromFood(foodId)
    if (f) {
      itemMetaCache.set(foodId, f)
      return f
    }
  }
  const fallbackMeta = { id: key ?? -1, name: undefined, description: null }
  if (key) itemMetaCache.set(key, fallbackMeta)
  return fallbackMeta
}

/* ---------------- Build meals ---------------- */
async function buildMealsFromWeeks(day: WeeksDay, date: string): Promise<MenuMeal[]> {
  const menuItems = Array.isArray(day.menu_items) ? day.menu_items : []

  const settled = await Promise.allSettled(
    menuItems.map(async (mi) => {
      const food = mi?.food
      const foodId = food?.id
      const menuItemId = mi?.id
      if (!foodId && !menuItemId) return null

      const meta = await resolveItemMeta(menuItemId, foodId, {
        name: food?.name ?? undefined,
        description: food?.description ?? null
      })
      const name = (meta.name ?? "").trim()
      const description = (typeof meta.description === "string" ? meta.description.trim() : "") || undefined

      // Skip nameless/placeholder items to avoid empty cards
      if (!name || name.toLowerCase() === "null") return null

      // default enrich shape
      let enrich: {
        calories: number
        proteinG: number
        sodiumMg: number
        fatG: number
        carbsG: number
        servingSize: string | undefined
        facts: NutritionFact[]
      } = {
        calories: 0,
        proteinG: 0,
        sodiumMg: 0,
        fatG: 0,
        carbsG: 0,
        servingSize: undefined,
        facts: []
      }

      // MUST use menu-item id for order-settings
      if (menuItemId) {
        enrich = await fetchOrderSettings(menuItemId, date)
      } else if (foodId) {
        // last-resort fallback (some deployments accept foodId)
        enrich = await fetchOrderSettings(foodId, date)
      }

      return {
        id: foodId ?? menuItemId!,
        menuItemId,
        name,
        description,
        calories: enrich.calories,
        proteinG: enrich.proteinG,
        sodiumMg: enrich.sodiumMg,
        fatG: enrich.fatG,
        carbsG: enrich.carbsG,
        servingSize: enrich.servingSize,
        nutritionFacts: enrich.facts
      } as MenuItem
    })
  )

  const items: MenuItem[] = []
  for (const s of settled) if (s.status === "fulfilled" && s.value) items.push(s.value)

  return [
    { mealType: "Lunch", items },
    { mealType: "Dinner", items }
  ]
}

/* ---------------- Fallback ---------------- */
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

/* ---------------- Route ---------------- */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10)
  const mealRaw = (url.searchParams.get("meal") ?? "dinner").toLowerCase()
  const meal = TARGET_MEAL_KEYS.has(mealRaw) ? mealRaw : "dinner"

  try {
    const weeks = await fetchWeeksMenuByMeal(SCHOOL_SLUG, meal, date)
    if (!weeks) return buildFallbackResponse(date, "weeks menu failed or returned non-JSON")

    const day: WeeksDay | undefined = weeks?.days?.find((d) => d?.date === date)
    if (!day) return buildFallbackResponse(date, `No menu found for ${SCHOOL_SLUG} ${meal} on ${date}`)

    const meals = await buildMealsFromWeeks(day, date)
    const picked =
      meals.find((m) => m.mealType.toLowerCase() === normalizeMealName(meal).toLowerCase()) ??
      meals.find((m) => m.mealType.toLowerCase() === "dinner") ??
      meals[0]

    return NextResponse.json({
      date,
      source: "live" as const,
      menu: [{ location: "Jonathan Edwards College", meals: [picked] }]
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return buildFallbackResponse(date, msg)
  }
}
