import vm from "node:vm"

import { NextRequest, NextResponse } from "next/server"

const NUTRISLICE_BASE_URL = "https://yaledining.nutrislice.com/menu/api"
const NUTRISLICE_BASE_PAGE_URL = "https://yaledining.nutrislice.com/menu"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const SCHOOL_SLUG = "jonathan-edwards-college"
const MENU_SLUG_CANDIDATES = [
  "jonathan-edwards-college",
  "jonathan-edwards-college-dining-hall"
]

const PAGE_MEAL_CONFIG = [
  {
    label: "Lunch",
    slug: "lunch",
    buildPath: (date: string) => `/${SCHOOL_SLUG}/lunch/${date}`,
    matchers: ["lunch"]
  },
  {
    label: "Dinner",
    slug: "dinner",
    buildPath: (date: string) => `/${SCHOOL_SLUG}/dinner/${date}`,
    matchers: ["dinner"]
  }
] as const

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

const FALLBACK_MENU_ITEMS: MenuLocation[] = [
  {
    location: "Jonathan Edwards College",
    meals: [
      {
        mealType: "Lunch",
        items: [
          {
            name: "Roasted turkey sandwich",
            description: "Cranberry aioli on multigrain",
            calories: 430,
            nutritionFacts: [
              { name: "Calories", amount: 430, unit: "kcal" },
              { name: "Protein", amount: 28, unit: "g" },
              { name: "Total Fat", amount: 12, unit: "g" },
              { name: "Carbohydrates", amount: 42, unit: "g" },
              { name: "Sodium", amount: 820, unit: "mg" }
            ]
          },
          {
            name: "Butternut squash soup",
            description: "Toasted pepitas",
            calories: 210,
            nutritionFacts: [
              { name: "Calories", amount: 210, unit: "kcal" },
              { name: "Total Fat", amount: 8, unit: "g" },
              { name: "Carbohydrates", amount: 30, unit: "g" },
              { name: "Fiber", amount: 4, unit: "g" },
              { name: "Sodium", amount: 540, unit: "mg" }
            ]
          },
          {
            name: "Spinach and strawberry salad",
            description: "Poppy seed dressing",
            calories: 180,
            nutritionFacts: [
              { name: "Calories", amount: 180, unit: "kcal" },
              { name: "Protein", amount: 6, unit: "g" },
              { name: "Total Fat", amount: 9, unit: "g" },
              { name: "Carbohydrates", amount: 20, unit: "g" },
              { name: "Fiber", amount: 3, unit: "g" }
            ]
          }
        ]
      },
      {
        mealType: "Dinner",
        items: [
          {
            name: "Baked pesto pasta",
            description: "Mozzarella and cherry tomatoes",
            calories: 520,
            nutritionFacts: [
              { name: "Calories", amount: 520, unit: "kcal" },
              { name: "Protein", amount: 22, unit: "g" },
              { name: "Total Fat", amount: 24, unit: "g" },
              { name: "Carbohydrates", amount: 58, unit: "g" },
              { name: "Sodium", amount: 880, unit: "mg" }
            ]
          },
          {
            name: "Citrus roasted carrots",
            description: "Orange glaze and parsley",
            calories: 160,
            nutritionFacts: [
              { name: "Calories", amount: 160, unit: "kcal" },
              { name: "Total Fat", amount: 6, unit: "g" },
              { name: "Carbohydrates", amount: 24, unit: "g" },
              { name: "Fiber", amount: 5, unit: "g" },
              { name: "Sodium", amount: 210, unit: "mg" }
            ]
          },
          {
            name: "Lemon olive oil cake",
            description: "With blueberry compote",
            calories: 340,
            nutritionFacts: [
              { name: "Calories", amount: 340, unit: "kcal" },
              { name: "Total Fat", amount: 14, unit: "g" },
              { name: "Carbohydrates", amount: 48, unit: "g" },
              { name: "Sugar", amount: 32, unit: "g" },
              { name: "Protein", amount: 5, unit: "g" }
            ]
          }
        ]
      }
    ]
  }
]

const buildFallbackResponse = (date: string, error: string) =>
  NextResponse.json({
    date,
    source: "fallback" as const,
    menu: FALLBACK_MENU_ITEMS,
    error
  })

type NutrisliceMenuItem = {
  id?: number | string
  name?: string
  description?: string
  food?: {
    name?: string
    description?: string
    title?: string
    summary?: string
    long_description?: string
  }
  nutrition?: {
    calories?: number | string | null
  }
  food_id?: number | string
  item_name?: string
  item_description?: string
  calories?: number | string | null
  display_name?: string
  food_name?: string
  title?: string
  summary?: string
  description_plain_text?: string
  nutrition_info?: {
    calories?: number | string | null
  }
}

type NutrisliceDay = {
  date?: string
  menu_items?: NutrisliceMenuItem[]
  menu_items_by_id?: Record<string, NutrisliceMenuItem>
  menu_items_by_meal?: Record<string, Array<number | string | NutrisliceMenuItem>>
}

type NutrisliceResponse = {
  days?: NutrisliceDay[]
}

const toIsoDate = (date: Date) => date.toISOString().split("T")[0]

const computeWeekCandidates = (date: string): string[] => {
  const target = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(target.getTime())) {
    const fallback = new Date()
    return [toIsoDate(fallback)]
  }

  const monday = new Date(target)
  const currentDay = monday.getUTCDay()
  const diff = currentDay === 0 ? -6 : 1 - currentDay
  monday.setUTCDate(monday.getUTCDate() + diff)

  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)

  const candidates = new Set<string>([toIsoDate(target), toIsoDate(monday), toIsoDate(sunday)])
  return Array.from(candidates)
}

const normalizeMealName = (meal: string) => {
  const trimmed = meal.trim()
  if (!trimmed) return meal
  return trimmed
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(^|\s)([a-z])/g, (match) => match.toUpperCase())
}

const TARGET_MEAL_KEYS = new Set(["lunch", "dinner"])

const isTargetMealType = (meal: string) => TARGET_MEAL_KEYS.has(normalizeMealName(meal).toLowerCase())

const parseNumericValue = (value: unknown): number | undefined => {
  if (value == null) return undefined
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value)
    return Number.isFinite(numeric) ? numeric : undefined
  }
  return undefined
}

const parseCalories = (value: unknown): number | undefined => parseNumericValue(value)

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return undefined
}

const formatNutritionName = (value: string): string => {
  const normalized = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  if (!normalized) return value
  return normalized.replace(/(^|\s)([a-z])/g, (segment) => segment.toUpperCase())
}

const buildNutritionFactFromRecord = (
  record: Record<string, unknown>,
  fallbackName?: string
): NutritionFact | null => {
  const rawName =
    coerceString(record["name"]) ??
    coerceString(record["label"]) ??
    coerceString(record["title"]) ??
    coerceString(record["nutrient"]) ??
    coerceString(record["nutrient_name"]) ??
    coerceString(record["display_name"]) ??
    fallbackName

  const amount =
    parseNumericValue(record["value"]) ??
    parseNumericValue(record["amount"]) ??
    parseNumericValue(record["quantity"]) ??
    parseNumericValue(record["qty"]) ??
    parseNumericValue(record["nutrient_value"]) ??
    parseNumericValue(record["nutrientValue"]) ??
    parseNumericValue(record["grams"]) ??
    parseNumericValue(record["g"]) ??
    parseNumericValue(record["serving_size"]) ??
    parseNumericValue(record["per_serving"]) ??
    parseNumericValue(record["value_per_serving"])

  const unit =
    coerceString(record["unit"]) ??
    coerceString(record["uom"]) ??
    coerceString(record["unit_name"]) ??
    coerceString(record["unitName"]) ??
    coerceString(record["measure"]) ??
    coerceString(record["measurement"]) ??
    coerceString(record["amount_uom"]) ??
    coerceString(record["amount_unit"]) ??
    coerceString(record["per_unit"])

  const percentDailyValue =
    parseNumericValue(record["percent_daily_value"]) ??
    parseNumericValue(record["percentDailyValue"]) ??
    parseNumericValue(record["percent_dv"]) ??
    parseNumericValue(record["percentDV"]) ??
    parseNumericValue(record["daily_value_percent"]) ??
    parseNumericValue(record["percent"]) ??
    parseNumericValue(record["dv"])

  const display =
    coerceString(record["display"]) ??
    coerceString(record["display_value"]) ??
    coerceString(record["value_display"]) ??
    coerceString(record["amount_with_unit"]) ??
    coerceString(record["displayAmount"])

  const resolvedName = rawName ? formatNutritionName(rawName) : fallbackName ? formatNutritionName(fallbackName) : undefined

  if (!resolvedName) return null

  if (
    amount === undefined &&
    percentDailyValue === undefined &&
    (unit == null || unit === "") &&
    (display == null || display === "")
  ) {
    return null
  }

  return {
    name: resolvedName,
    amount,
    unit: unit ?? undefined,
    percentDailyValue,
    display: display ?? undefined
  }
}

const collectNutritionFacts = (data: NutrisliceMenuItem): NutritionFact[] => {
  type StackEntry = { value: unknown; fallbackName?: string }
  const stack: StackEntry[] = []
  const visited = new Set<object>()

  const push = (value: unknown, fallbackName?: string) => {
    if (value == null) return
    stack.push({ value, fallbackName })
  }

  const registerSources = (value: unknown) => {
    if (!value || typeof value !== "object") return
    const record = value as Record<string, unknown>
    push(record["nutrition"], undefined)
    push(record["nutrition_info"], undefined)
    push(record["nutritionInfo"], undefined)
    push(record["nutrition_facts"], undefined)
    push(record["nutritionFacts"], undefined)
    push(record["full_nutrition"], undefined)
    push(record["fullNutrition"], undefined)
    push(record["nutrients"], undefined)
    push(record["serving_size"], "Serving Size")
    push(record["servingSize"], "Serving Size")
    push(record["portion_size"], "Portion Size")
    push(record["portionSize"], "Portion Size")
  }

  registerSources(data)
  if (data.food) {
    registerSources(data.food)
  }

  const facts = new Map<string, NutritionFact>()

  const mergeFact = (fact: NutritionFact | null) => {
    if (!fact) return
    const key = fact.name.trim().toLowerCase()
    const existing = facts.get(key)
    if (!existing) {
      facts.set(key, { ...fact })
      return
    }

    if (existing.amount === undefined && fact.amount !== undefined) {
      existing.amount = fact.amount
    }
    if (!existing.unit && fact.unit) {
      existing.unit = fact.unit
    }
    if (existing.percentDailyValue === undefined && fact.percentDailyValue !== undefined) {
      existing.percentDailyValue = fact.percentDailyValue
    }
    if (!existing.display && fact.display) {
      existing.display = fact.display
    }
  }

  while (stack.length > 0) {
    const current = stack.pop()!
    const { value, fallbackName } = current

    if (value == null) continue

    if (typeof value === "number") {
      if (fallbackName) {
        mergeFact({ name: formatNutritionName(fallbackName), amount: value })
      }
      continue
    }

    if (typeof value === "string") {
      if (!fallbackName) continue
      const amount = parseNumericValue(value)
      if (amount !== undefined) {
        mergeFact({ name: formatNutritionName(fallbackName), amount })
      } else {
        mergeFact({ name: formatNutritionName(fallbackName), display: value.trim() })
      }
      continue
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        stack.push({ value: entry, fallbackName })
      }
      continue
    }

    if (typeof value === "object") {
      const objectValue = value as Record<string, unknown>
      if (visited.has(objectValue)) continue
      visited.add(objectValue)

      mergeFact(buildNutritionFactFromRecord(objectValue, fallbackName))

      for (const [key, nested] of Object.entries(objectValue)) {
        if (key === "name" || key === "label" || key === "title") continue
        stack.push({ value: nested, fallbackName: fallbackName ?? key })
      }
    }
  }

  return Array.from(facts.values()).sort((a, b) => a.name.localeCompare(b.name))
}

const extractMenuItem = (raw: unknown): MenuItem | null => {
  if (!raw || typeof raw !== "object") return null
  const data = raw as NutrisliceMenuItem
  const primary = data.food ?? data
  const name =
    primary?.name ??
    data.name ??
    data.item_name ??
    data.display_name ??
    data.food_name ??
    data.title ??
    (typeof primary === "object" && "title" in primary ? (primary as { title?: string }).title : undefined)

  if (!name) return null

  const description =
    primary?.description ??
    data.description ??
    data.item_description ??
    data.summary ??
    data.description_plain_text ??
    (typeof primary === "object" && "summary" in primary ? (primary as { summary?: string }).summary : undefined) ??
    (typeof primary === "object" && "long_description" in primary
      ? (primary as { long_description?: string }).long_description
      : undefined) ??
    undefined

  const calories =
    parseCalories(data.nutrition?.calories) ??
    parseCalories((primary as { nutrition?: { calories?: number | string | null } })?.nutrition?.calories) ??
    parseCalories(data.calories) ??
    parseCalories(data.nutrition_info?.calories)

  const nutritionFacts = collectNutritionFacts(data)

  return {
    name: name.trim(),
    description: description?.trim() || undefined,
    calories,
    nutritionFacts
  }
}

const buildMealsFromDay = (day: NutrisliceDay): MenuMeal[] => {
  const itemsById = new Map<string, MenuItem>()

  const registerItem = (key: string | number | undefined, raw: unknown) => {
    if (!key) return
    const normalizedKey = String(key)
    if (itemsById.has(normalizedKey)) return
    const parsed = extractMenuItem(raw)
    if (parsed) {
      itemsById.set(normalizedKey, parsed)
    }
  }

  if (Array.isArray(day.menu_items)) {
    for (const item of day.menu_items) {
      registerItem(item.id ?? item.food_id, item)
    }
  }

  if (day.menu_items_by_id) {
    for (const [id, item] of Object.entries(day.menu_items_by_id)) {
      registerItem(id, item)
    }
  }

  const meals: MenuMeal[] = []
  const mealBuckets = day.menu_items_by_meal ?? {}

  for (const [mealName, rawItems] of Object.entries(mealBuckets)) {
    if (!Array.isArray(rawItems)) continue
    if (!isTargetMealType(mealName)) continue

    const collected: MenuItem[] = []
    const seenNames = new Set<string>()

    for (const entry of rawItems) {
      let parsed: MenuItem | null = null
      if (typeof entry === "string" || typeof entry === "number") {
        parsed = itemsById.get(String(entry)) ?? null
      } else {
        parsed = extractMenuItem(entry)
      }

      if (parsed && !seenNames.has(parsed.name)) {
        collected.push(parsed)
        seenNames.add(parsed.name)
      }
    }

    if (collected.length > 0) {
      meals.push({
        mealType: normalizeMealName(mealName),
        items: collected
      })
    }
  }

  meals.sort((a, b) => a.mealType.localeCompare(b.mealType))
  return meals
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const extractNuxtStateFromHtml = (html: string): unknown => {
  const inlineMatch = html.match(/<script[^>]*>\s*window\.__NUXT__=(.*?);\s*<\/script>/s)
  if (inlineMatch) {
    const scriptContent = inlineMatch[1]
    const context = { window: {} as Record<string, unknown> }
    try {
      vm.createContext(context)
      vm.runInContext(`window.__NUXT__=${scriptContent}`, context)
      return context.window.__NUXT__
    } catch (error) {
      console.error("Failed to evaluate inline __NUXT__ state", error)
    }
  }

  const jsonMatch = html.match(/<script[^>]*id=["']__NUXT_DATA__["'][^>]*>(.*?)<\/script>/s)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1])
    } catch (error) {
      console.error("Failed to parse __NUXT_DATA__ JSON", error)
    }
  }

  return null
}

const coerceMenuItemsByMeal = (
  value: unknown
): Record<string, Array<number | string | NutrisliceMenuItem>> | undefined => {
  if (!isRecord(value)) return undefined
  const result: Record<string, Array<number | string | NutrisliceMenuItem>> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (Array.isArray(raw)) {
      result[key] = raw as Array<number | string | NutrisliceMenuItem>
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

const coerceMenuItemsById = (value: unknown): Record<string, NutrisliceMenuItem> | undefined => {
  if (!isRecord(value)) return undefined
  const result: Record<string, NutrisliceMenuItem> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (raw && typeof raw === "object") {
      result[key] = raw as NutrisliceMenuItem
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

const coerceMenuItemsArray = (value: unknown): NutrisliceMenuItem[] | undefined => {
  if (!Array.isArray(value)) return undefined
  return value as NutrisliceMenuItem[]
}

const collectNutrisliceDays = (state: unknown): NutrisliceDay[] => {
  const days: NutrisliceDay[] = []
  const visited = new Set<unknown>()
  const stack: unknown[] = [state]

  while (stack.length > 0) {
    const current = stack.pop()
    if (current == null) continue

    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item)
      }
      continue
    }

    if (!isRecord(current)) continue
    if (visited.has(current)) continue
    visited.add(current)

    const rawMenuItemsByMeal =
      current["menu_items_by_meal"] ?? current["menuItemsByMeal"] ?? current["menu_itemsByMeal"]
    const menuItemsByMeal = coerceMenuItemsByMeal(rawMenuItemsByMeal)

    if (menuItemsByMeal) {
      const rawMenuItems = current["menu_items"] ?? current["menuItems"]
      const rawMenuItemsById = current["menu_items_by_id"] ?? current["menuItemsById"]
      const rawDate =
        typeof current["date"] === "string"
          ? (current["date"] as string)
          : typeof current["service_date"] === "string"
          ? (current["service_date"] as string)
          : undefined

      days.push({
        date: rawDate,
        menu_items: coerceMenuItemsArray(rawMenuItems),
        menu_items_by_id: coerceMenuItemsById(rawMenuItemsById),
        menu_items_by_meal: menuItemsByMeal
      })
    }

    for (const value of Object.values(current)) {
      stack.push(value)
    }
  }

  return days
}

const findDayForDate = (days: NutrisliceDay[], date: string): NutrisliceDay | null => {
  const exact = days.find((day) => day.date === date)
  if (exact) return exact

  const loose = days.find((day) => day.date?.startsWith(date))
  if (loose) return loose

  return days[0] ?? null
}

const normalizeForComparison = (value: string) => normalizeMealName(value).toLowerCase()

const mergeMealCollections = (target: Map<string, MenuMeal>, incoming: MenuMeal[]) => {
  for (const meal of incoming) {
    if (!isTargetMealType(meal.mealType)) continue
    const key = normalizeForComparison(meal.mealType)
    const existing = target.get(key)
    if (!existing) {
      target.set(key, {
        mealType: normalizeMealName(meal.mealType),
        items: [...meal.items]
      })
      continue
    }

    const seen = new Set(existing.items.map((item) => item.name))
    for (const item of meal.items) {
      if (!seen.has(item.name)) {
        existing.items.push(item)
        seen.add(item.name)
      }
    }
  }
}

const fetchMealsFromPage = async (
  date: string,
  config: (typeof PAGE_MEAL_CONFIG)[number]
): Promise<MenuMeal[]> => {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${NUTRISLICE_BASE_PAGE_URL}/${SCHOOL_SLUG}`
  }

  const path = config.buildPath(date)
  const url = `${NUTRISLICE_BASE_PAGE_URL}${path}`
  const response = await fetch(url, {
    headers,
    cache: "no-store"
  })

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`)
  }

  const html = await response.text()
  const state = extractNuxtStateFromHtml(html)
  if (!state) {
    throw new Error(`Unable to locate __NUXT__ state in response from ${url}`)
  }

  const days = collectNutrisliceDays(state)
  if (days.length === 0) {
    throw new Error(`Unable to locate menu data in response from ${url}`)
  }

  const targetDay = findDayForDate(days, date)
  if (!targetDay) {
    throw new Error(`Unable to find menu day for ${date} in response from ${url}`)
  }

  const meals = buildMealsFromDay(targetDay)
  const targetMatchers = new Set(config.matchers.map((matcher) => normalizeForComparison(matcher)))
  const filtered = meals.filter((meal) => {
    const normalized = normalizeForComparison(meal.mealType)
    for (const matcher of targetMatchers) {
      if (normalized.includes(matcher)) {
        return true
      }
    }
    return false
  })

  return filtered.length > 0 ? filtered : meals
}

const fetchNutrisliceMenuFromPages = async (date: string): Promise<MenuLocation[] | null> => {
  const mealMap = new Map<string, MenuMeal>()
  const errors: string[] = []

  await Promise.all(
    PAGE_MEAL_CONFIG.map(async (config) => {
      try {
        const meals = await fetchMealsFromPage(date, config)
        mergeMealCollections(mealMap, meals)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`[${config.slug}] ${message}`)
      }
    })
  )

  if (mealMap.size > 0) {
    const meals = Array.from(mealMap.values())
    meals.sort((a, b) => a.mealType.localeCompare(b.mealType))
    return [
      {
        location: "Jonathan Edwards College",
        meals
      }
    ]
  }

  if (errors.length > 0) {
    console.error("Unable to load Nutrislice menu via page scraping", errors)
  }

  return null
}

const fetchNutrisliceMenuFromApi = async (date: string): Promise<MenuLocation[] | null> => {
  const startCandidates = computeWeekCandidates(date)

  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9"
  }

  const errors: string[] = []

  for (const start of startCandidates) {
    for (const menuSlug of MENU_SLUG_CANDIDATES) {
      const url = `${NUTRISLICE_BASE_URL}/weeks/school/${SCHOOL_SLUG}/menu/${menuSlug}?start=${start}`
      try {
        const response = await fetch(url, {
          headers,
          cache: "no-store"
        })

        if (!response.ok) {
          errors.push(`Request to ${url} failed with status ${response.status}`)
          continue
        }

        const json = (await response.json()) as NutrisliceResponse
        const days = Array.isArray(json.days) ? json.days : []
        const targetDay = days.find((day) => day.date === date)

        if (!targetDay) {
          errors.push(`No menu data found for ${date} in response from ${url}`)
          continue
        }

        const meals = buildMealsFromDay(targetDay)
        if (meals.length === 0) {
          errors.push(`Menu day for ${date} did not contain any meals in response from ${url}`)
          continue
        }

        return [
          {
            location: "Jonathan Edwards College",
            meals
          }
        ]
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`Error requesting ${url}: ${message}`)
      }
    }
  }

  console.error("Unable to load Nutrislice menu", errors)
  return null
}

const fetchNutrisliceMenu = async (date: string): Promise<MenuLocation[] | null> => {
  const scraped = await fetchNutrisliceMenuFromPages(date)
  if (scraped && scraped.length > 0) {
    return scraped
  }

  return fetchNutrisliceMenuFromApi(date)
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0]

  try {
    const liveMenu = await fetchNutrisliceMenu(date)
    if (liveMenu) {
      return NextResponse.json({
        date,
        source: "live" as const,
        menu: liveMenu
      })
    }

    return buildFallbackResponse(date, "Unable to load Jonathan Edwards menu from Nutrislice.")
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return buildFallbackResponse(date, message)
  }
}
