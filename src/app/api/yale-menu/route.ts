import { NextRequest, NextResponse } from "next/server"

const NUTRISLICE_BASE_URL = "https://yaledining.api.nutrislice.com/menu/api"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

type DiningLocationConfig = {
  slug: string
  label: string
  defaultLocationId?: string
  slugAliases?: string[]
}

const DINING_LOCATIONS: DiningLocationConfig[] = [
  { slug: "jonathan-edwards-college", label: "Jonathan Edwards College", defaultLocationId: "57753" },
  { slug: "branford-college", label: "Branford College", slugAliases: ["branford"] }
]

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
/* ---------------- Utils ---------------- */
const TARGET_MEAL_KEYS = new Set(["breakfast", "lunch", "dinner"])
const normalizeMealName = (m: string) =>
  m.trim().replace(/[-_]/g, " ").replace(/\s+/g, " ").replace(/(^|\s)([a-z])/g, (s) => s.toUpperCase())

const MEAL_SLUG_CONFIG: Record<
  string,
  { label: string; slugs: string[] }
> = {
  breakfast: { label: "Breakfast", slugs: ["breakfast"] },
  lunch: { label: "Lunch", slugs: ["lunch"] },
  dinner: { label: "Dinner", slugs: ["dinner", "additional-dinner-offerings"] }
}

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
  date: string,
  locationId: string | null
): Promise<{
  calories: number
  proteinG: number
  sodiumMg: number
  fatG: number
  carbsG: number
  servingSize: string | undefined
  facts: NutritionFact[]
}> {
  if (!locationId) {
    return { calories: 0, proteinG: 0, sodiumMg: 0, fatG: 0, carbsG: 0, servingSize: undefined, facts: [] }
  }

  const url = `${NUTRISLICE_BASE_URL}/menu-items/${menuItemId}/order-settings/?location-id=${encodeURIComponent(
    locationId
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
async function buildMenuItemsFromWeeks(day: WeeksDay, date: string, locationId: string | null): Promise<MenuItem[]> {
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
        enrich = await fetchOrderSettings(menuItemId, date, locationId)
      } else if (foodId) {
        // last-resort fallback (some deployments accept foodId)
        enrich = await fetchOrderSettings(foodId, date, locationId)
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
  return items
}

/* ---------------- Fallback ---------------- */
const buildFallbackResponse = (date: string, mealLabel: string, error: string) =>
  NextResponse.json({
    date,
    source: "fallback" as const,
    menu: [
      ...DINING_LOCATIONS.map((loc) => ({
        location: loc.label,
        meals: [
          { mealType: mealLabel, items: [] }
        ]
      }))
    ],
    error
  })

/* ---------------- Location metadata ---------------- */
type RawLocation = Record<string, unknown>

const locationIdCache = new Map<string, string | null>()
let locationDirectoryCache: RawLocation[] | null = null

const normalizeSlug = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return normalized.length ? normalized : null
}

const extractCandidateSlugs = (raw: RawLocation): string[] => {
  const candidates = new Set<string>()
  const keysToNormalize = ["slug", "school_slug", "menu_group_slug", "school"]
  for (const key of keysToNormalize) {
    const normalized = normalizeSlug(raw[key])
    if (normalized) candidates.add(normalized)
  }

  const pathValue = normalizeSlug(raw["path"])
  if (pathValue) candidates.add(pathValue)

  const arrayKeys = ["slugs", "school_slugs", "schools"]
  for (const key of arrayKeys) {
    const arr = raw[key]
    if (Array.isArray(arr)) {
      for (const value of arr) {
        const normalized = normalizeSlug(value)
        if (normalized) candidates.add(normalized)
      }
    }
  }

  return Array.from(candidates)
}

async function fetchLocationDirectory(): Promise<RawLocation[]> {
  if (locationDirectoryCache) return locationDirectoryCache

  const url = `${NUTRISLICE_BASE_URL}/locations/?format=json`
  const json = await safeFetchJSON<unknown>(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Origin: "https://yaledining.nutrislice.com",
      Referer: "https://yaledining.nutrislice.com/"
    },
    cache: "no-store",
    timeoutMs: 9000
  })

  locationDirectoryCache = Array.isArray(json) ? (json as RawLocation[]) : []
  return locationDirectoryCache
}

async function resolveLocationId(config: DiningLocationConfig): Promise<string | null> {
  if (locationIdCache.has(config.slug)) return locationIdCache.get(config.slug) ?? null

  if (config.defaultLocationId) {
    locationIdCache.set(config.slug, config.defaultLocationId)
    return config.defaultLocationId
  }

  const directory = await fetchLocationDirectory()
  const targetSlugs = new Set<string>()
  const pushNormalized = (value: string | undefined) => {
    const normalized = normalizeSlug(value)
    if (normalized) targetSlugs.add(normalized)
  }

  pushNormalized(config.slug)
  if (Array.isArray(config.slugAliases)) for (const alias of config.slugAliases) pushNormalized(alias)

  if (!targetSlugs.size) {
    locationIdCache.set(config.slug, null)
    return null
  }

  const matchesTargetSlug = (candidate: string) => {
    for (const target of targetSlugs) {
      if (candidate === target) return true
      if (candidate.includes(target) || target.includes(candidate)) return true
    }
    return false
  }

  for (const entry of directory) {
    const candidates = extractCandidateSlugs(entry)
    if (candidates.some((candidate) => matchesTargetSlug(candidate))) {
      const idValue = entry?.["id"]
      let id: number | null = null
      if (typeof idValue === "number" && Number.isFinite(idValue)) id = idValue
      else if (typeof idValue === "string") {
        const parsed = Number.parseInt(idValue, 10)
        if (!Number.isNaN(parsed)) id = parsed
      }
      if (id !== null) {
        const resolved = `${id}`
        locationIdCache.set(config.slug, resolved)
        return resolved
      }
    }
  }

  locationIdCache.set(config.slug, null)
  return null
}

/* ---------------- Route ---------------- */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10)
  const mealRaw = (url.searchParams.get("meal") ?? "dinner").toLowerCase()
  const meal = TARGET_MEAL_KEYS.has(mealRaw) ? mealRaw : "dinner"
  const mealConfig = MEAL_SLUG_CONFIG[meal] ?? { label: normalizeMealName(meal), slugs: [meal] }

  try {
    const locationResults: {
      config: DiningLocationConfig
      items: MenuItem[]
      successful: boolean
    }[] = []

    const errorMessages: string[] = []
    let successfulLocations = 0

    for (const locationConfig of DINING_LOCATIONS) {
      const aggregatedItems = new Map<number, MenuItem>()
      let successful = false
      const locationId = await resolveLocationId(locationConfig)

      for (const slug of mealConfig.slugs) {
        const weeks = await fetchWeeksMenuByMeal(locationConfig.slug, slug, date)
        if (!weeks) continue

        const day: WeeksDay | undefined = weeks?.days?.find((d) => d?.date === date)
        if (!day) continue

        successful = true
        const items = await buildMenuItemsFromWeeks(day, date, locationId)
        for (const item of items) if (!aggregatedItems.has(item.id)) aggregatedItems.set(item.id, item)
      }

      if (successful) successfulLocations += 1
      else errorMessages.push(`No menu found for ${locationConfig.label} ${meal} on ${date}`)

      locationResults.push({
        config: locationConfig,
        items: Array.from(aggregatedItems.values()),
        successful
      })
    }

    if (successfulLocations === 0) {
      const combinedError =
        errorMessages.join("; ") || `No menu found for requested meal on ${date}`
      return buildFallbackResponse(date, mealConfig.label, combinedError)
    }

    const combinedError = errorMessages.length ? errorMessages.join("; ") : undefined
    return NextResponse.json({
      date,
      source: "live" as const,
      menu: locationResults.map((result) => ({
        location: result.config.label,
        meals: [
          {
            mealType: mealConfig.label,
            items: result.items
          }
        ]
      })),
      ...(combinedError ? { error: combinedError } : {})
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return buildFallbackResponse(date, mealConfig.label, msg)
  }
}
