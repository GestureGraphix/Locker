import { NextRequest, NextResponse } from "next/server"

const NUTRISLICE_BASE_URL = "https://yaledining.nutrislice.com/menu/api"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const SCHOOL_SLUG = "jonathan-edwards-college"
const MENU_SLUG_CANDIDATES = [
  "jonathan-edwards-college",
  "jonathan-edwards-college-dining-hall"
]

type MenuItem = {
  name: string
  description?: string
  calories?: number
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
        mealType: "Breakfast",
        items: [
          { name: "Steel-cut oatmeal", description: "With dried fruit and brown sugar", calories: 220 },
          { name: "Cage-free scrambled eggs", description: "Served with roasted tomatoes", calories: 180 },
          { name: "Greek yogurt parfait", description: "Fresh berries and granola", calories: 260 }
        ]
      },
      {
        mealType: "Lunch",
        items: [
          { name: "Roasted turkey sandwich", description: "Cranberry aioli on multigrain", calories: 430 },
          { name: "Butternut squash soup", description: "Toasted pepitas", calories: 210 },
          { name: "Spinach and strawberry salad", description: "Poppy seed dressing", calories: 180 }
        ]
      },
      {
        mealType: "Dinner",
        items: [
          { name: "Baked pesto pasta", description: "Mozzarella and cherry tomatoes", calories: 520 },
          { name: "Citrus roasted carrots", description: "Orange glaze and parsley", calories: 160 },
          { name: "Lemon olive oil cake", description: "With blueberry compote", calories: 340 }
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
  }
  nutrition?: {
    calories?: number | string | null
  }
  food_id?: number | string
  item_name?: string
  item_description?: string
  calories?: number | string | null
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

const parseCalories = (value: unknown): number | undefined => {
  if (value == null) return undefined
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value)
    return Number.isFinite(numeric) ? numeric : undefined
  }
  return undefined
}

const extractMenuItem = (raw: unknown): MenuItem | null => {
  if (!raw || typeof raw !== "object") return null
  const data = raw as NutrisliceMenuItem
  const primary = data.food ?? data
  const name =
    primary?.name ??
    data.name ??
    data.item_name ??
    (typeof primary === "object" && "title" in primary ? (primary as { title?: string }).title : undefined)

  if (!name) return null

  const description =
    primary?.description ??
    data.description ??
    data.item_description ??
    (typeof primary === "object" && "summary" in primary ? (primary as { summary?: string }).summary : undefined) ??
    undefined

  const calories =
    parseCalories(data.nutrition?.calories) ??
    parseCalories((primary as { nutrition?: { calories?: number | string | null } })?.nutrition?.calories) ??
    parseCalories(data.calories)

  return { name: name.trim(), description: description?.trim() || undefined, calories }
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

const fetchNutrisliceMenu = async (date: string): Promise<MenuLocation[] | null> => {
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
