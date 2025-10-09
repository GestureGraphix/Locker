import { NextRequest, NextResponse } from "next/server"

const YALE_MENU_URL = "https://hospitality.yale.edu/menus"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const JSON_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9"
}

type MenuItem = {
  name: string
  description?: string
  calories?: number | null
}

type MenuMeal = {
  mealType: string
  items: MenuItem[]
}

type MenuLocation = {
  location: string
  meals: MenuMeal[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim()

const toTitleCase = (value: string) =>
  normalizeWhitespace(value)
    .split(" ")
    .map((segment) =>
      segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : segment
    )
    .join(" ")

const buildJsonCandidateUrls = (date: string) => {
  const [year, month, day] = date.split("-")
  const compact = year && month && day ? `${year}${month}${day}` : date.replace(/-/g, "")
  const usFormat = year && month && day ? `${month}-${day}-${year}` : date

  const variants = [
    `https://hospitality.yale.edu/sites/default/files/files/json/menu-${date}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menus-${date}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menu_${date}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menus_${date}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menu-${usFormat}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menus-${usFormat}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menu_${usFormat}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menus_${usFormat}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menu-${compact}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menus-${compact}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menu_${compact}.json`,
    `https://hospitality.yale.edu/sites/default/files/files/json/menus_${compact}.json`
  ]

  return Array.from(new Set(variants))
}

const pickString = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string") {
      const normalized = normalizeWhitespace(value)
      if (normalized) return normalized
    }
  }
  return undefined
}

const parseCaloriesValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value)
  }

  if (typeof value === "string") {
    const match = value.match(/(\d{2,4})/)
    if (match) {
      const numeric = Number.parseInt(match[1], 10)
      if (!Number.isNaN(numeric)) {
        return numeric
      }
    }
  }

  if (isRecord(value)) {
    const nested = value.value ?? value.amount ?? value.calories
    return parseCaloriesValue(nested)
  }

  return undefined
}

const ITEM_KEYS = [
  "items",
  "menuItems",
  "menu_items",
  "menuitems",
  "dishes",
  "foods",
  "entries",
  "options",
  "entrees",
  "recipes",
  "choices",
  "stations",
  "selections",
  "menu"
]

const MEAL_NAME_KEYS = [
  "mealType",
  "meal",
  "meal_name",
  "mealName",
  "period",
  "name",
  "title",
  "label"
]

const LOCATION_NAME_KEYS = [
  "location",
  "locationName",
  "location_name",
  "name",
  "title",
  "hall",
  "college",
  "venue",
  "diningHall"
]

const DESCRIPTION_KEYS = [
  "description",
  "desc",
  "details",
  "notes",
  "summary",
  "ingredients",
  "comment"
]

const CALORIE_KEYS = [
  "calories",
  "calorie",
  "cal",
  "kcals",
  "kcal",
  "calories_kcal",
  "energy"
]

const parseMenuItemCandidate = (raw: unknown): MenuItem | null => {
  if (typeof raw === "string") {
    const normalized = normalizeWhitespace(raw)
    if (!normalized) return null
    return { name: normalized }
  }

  if (!isRecord(raw)) return null

  const candidateObjects: Record<string, unknown>[] = [raw]

  const nestedKeys = ["item", "menu_item", "menuItem", "dish", "food"]
  for (const key of nestedKeys) {
    const candidate = raw[key]
    if (isRecord(candidate)) {
      candidateObjects.push(candidate)
    }
  }

  let name: string | undefined
  let description: string | undefined
  let calories: number | undefined

  for (const candidate of candidateObjects) {
    if (!name) {
      name = pickString(candidate, [
        "name",
        "title",
        "item",
        "menuItem",
        "menu_item",
        "label",
        "dish",
        "food",
        "text",
        "displayName"
      ])
    }

    if (!description) {
      description = pickString(candidate, DESCRIPTION_KEYS)
    }

    if (calories == null) {
      for (const key of CALORIE_KEYS) {
        if (key in candidate) {
          const parsed = parseCaloriesValue(candidate[key])
          if (typeof parsed === "number") {
            calories = parsed
            break
          }
        }
      }

      if (calories == null && "nutrition" in candidate && isRecord(candidate.nutrition)) {
        const nutrition = candidate.nutrition
        const parsed = parseCaloriesValue(
          (nutrition.calories ?? nutrition.kcal ?? nutrition.energy) as unknown
        )
        if (typeof parsed === "number") {
          calories = parsed
        }
      }
    }
  }

  if (!name) return null

  const normalizedName = normalizeWhitespace(name)
  if (!normalizedName) return null

  const normalizedDescription = description ? normalizeWhitespace(description) : undefined

  return {
    name: normalizedName,
    description: normalizedDescription,
    calories: typeof calories === "number" ? calories : undefined
  }
}

type ItemBucket = Map<string, MenuItem>
type MealBucket = Map<string, ItemBucket>
type MenuBuckets = Map<string, MealBucket>

const ensureItemBucket = (buckets: MenuBuckets, location: string, meal: string) => {
  const normalizedLocation = normalizeWhitespace(location || "General") || "General"
  const normalizedMeal = normalizeWhitespace(meal || "All Day") || "All Day"

  if (!buckets.has(normalizedLocation)) {
    buckets.set(normalizedLocation, new Map())
  }

  const mealMap = buckets.get(normalizedLocation)!

  if (!mealMap.has(normalizedMeal)) {
    mealMap.set(normalizedMeal, new Map())
  }

  return mealMap.get(normalizedMeal)!
}

const upsertItem = (bucket: ItemBucket, item: MenuItem) => {
  const key = item.name.toLowerCase()
  if (!bucket.has(key)) {
    bucket.set(key, { ...item })
    return
  }

  const existing = bucket.get(key)!

  if (item.description) {
    if (!existing.description) {
      existing.description = item.description
    } else if (!existing.description.includes(item.description)) {
      existing.description = `${existing.description} • ${item.description}`
    }
  }

  if ((existing.calories == null || Number.isNaN(existing.calories)) && item.calories != null) {
    existing.calories = item.calories
  }
}

const addItemsToBucket = (buckets: MenuBuckets, location: string, meal: string, raw: unknown) => {
  if (raw == null) return

  const bucket = ensureItemBucket(buckets, location, meal)

  const entries = Array.isArray(raw) ? raw : [raw]
  for (const entry of entries) {
    const parsed = parseMenuItemCandidate(entry)
    if (parsed) {
      upsertItem(bucket, parsed)
    }
  }
}

const handleMealsCollection = (buckets: MenuBuckets, location: string, meals: unknown) => {
  if (!meals) return

  if (Array.isArray(meals)) {
    for (const entry of meals) {
      if (Array.isArray(entry)) {
        addItemsToBucket(buckets, location, "All Day", entry)
        continue
      }

      if (!isRecord(entry)) {
        addItemsToBucket(buckets, location, "All Day", entry)
        continue
      }

      if (Array.isArray(entry.meals) || isRecord(entry.meals)) {
        handleMealsCollection(buckets, location, entry.meals)
        continue
      }

      const mealName =
        pickString(entry, MEAL_NAME_KEYS) ||
        pickString(entry, ["station", "stationName", "station_name"])

      let itemsSource: unknown
      for (const key of ITEM_KEYS) {
        if (key in entry && entry[key] != null) {
          itemsSource = entry[key]
          break
        }
      }

      if (itemsSource != null) {
        addItemsToBucket(buckets, location, mealName ?? "All Day", itemsSource)
        continue
      }

      addItemsToBucket(buckets, location, mealName ?? "All Day", entry)
    }
    return
  }

  if (isRecord(meals)) {
    for (const [key, value] of Object.entries(meals)) {
      if (value == null) continue

      if (Array.isArray(value) || isRecord(value)) {
        const mealName = toTitleCase(key)
        addItemsToBucket(buckets, location, mealName, value)
      }
    }
  }
}

const processLocationValue = (buckets: MenuBuckets, locationName: string, value: unknown) => {
  if (!value) return

  if (Array.isArray(value)) {
    handleMealsCollection(buckets, locationName, value)
    return
  }

  if (!isRecord(value)) {
    addItemsToBucket(buckets, locationName, "All Day", value)
    return
  }

  if (Array.isArray(value.meals) || isRecord(value.meals)) {
    handleMealsCollection(buckets, locationName, value.meals)
  }

  for (const key of ITEM_KEYS) {
    if (key in value && value[key] != null) {
      addItemsToBucket(buckets, locationName, "All Day", value[key])
    }
  }

  const mealLikeKeys = Object.keys(value).filter((key) =>
    /breakfast|brunch|lunch|dinner|supper|snack|grab|late|all\s*day|special/i.test(key)
  )

  for (const key of mealLikeKeys) {
    if (value[key] != null) {
      addItemsToBucket(buckets, locationName, toTitleCase(key), value[key])
    }
  }
}

const normalizeJsonMenu = (payload: unknown): MenuLocation[] => {
  const buckets: MenuBuckets = new Map()

  const handleLocationEntry = (entry: unknown) => {
    if (!isRecord(entry)) return

    const locationName =
      pickString(entry, LOCATION_NAME_KEYS) || pickString(entry, ["shortName", "displayName"]) || "General"

    if (Array.isArray(entry.meals) || isRecord(entry.meals)) {
      handleMealsCollection(buckets, locationName, entry.meals)
    }

    for (const key of ITEM_KEYS) {
      if (key in entry && entry[key] != null) {
        addItemsToBucket(buckets, locationName, "All Day", entry[key])
      }
    }

    const mealCandidates = Object.keys(entry).filter((key) =>
      /breakfast|brunch|lunch|dinner|supper|snack|grab|late|all\s*day|special/i.test(key)
    )

    for (const key of mealCandidates) {
      if (entry[key] != null) {
        addItemsToBucket(buckets, locationName, toTitleCase(key), entry[key])
      }
    }
  }

  const explore = (value: unknown) => {
    if (!value) return

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (Array.isArray(entry) || !entry) {
          addItemsToBucket(buckets, "General", "All Day", entry)
        } else {
          handleLocationEntry(entry)
        }
      })
      return
    }

    if (!isRecord(value)) return

    if (Array.isArray(value.locations)) {
      explore(value.locations)
    }

    if (Array.isArray(value.data)) {
      explore(value.data)
    }

    if (isRecord(value.data)) {
      explore(value.data)
    }

    if (isRecord(value.menu)) {
      explore(value.menu)
    }

    if (Array.isArray(value.menu)) {
      explore(value.menu)
    }

    const skipKeys = new Set([
      "locations",
      "data",
      "menu",
      "date",
      "status",
      "error",
      "success"
    ])

    for (const [key, entry] of Object.entries(value)) {
      if (skipKeys.has(key)) continue

      if (Array.isArray(entry) || isRecord(entry)) {
        const looksLikeLocation =
          /college|hall|dining|commons|grill|kitchen|buttery|library|house|center/i.test(key)

        if (looksLikeLocation) {
          processLocationValue(buckets, toTitleCase(key), entry)
        } else {
          handleLocationEntry(entry)
        }
      }
    }
  }

  explore(payload)

  const menuLocations: MenuLocation[] = []

  buckets.forEach((mealMap, location) => {
    const meals: MenuMeal[] = []
    mealMap.forEach((itemsMap, mealType) => {
      const items = Array.from(itemsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      if (items.length > 0) {
        meals.push({ mealType, items })
      }
    })

    if (meals.length > 0) {
      meals.sort((a, b) => a.mealType.localeCompare(b.mealType))
      menuLocations.push({ location, meals })
    }
  })

  return menuLocations.sort((a, b) => a.location.localeCompare(b.location))
}

type JsonFetchSuccess = {
  success: true
  menu: MenuLocation[]
  resolvedUrl: string
}

type JsonFetchFailure = {
  success: false
  errors: string[]
}

const fetchJsonMenu = async (date: string): Promise<JsonFetchSuccess | JsonFetchFailure> => {
  const errors: string[] = []

  for (const url of buildJsonCandidateUrls(date)) {
    try {
      const response = await fetch(url, {
        headers: JSON_HEADERS,
        cache: "no-store"
      })

      if (!response.ok) {
        errors.push(`${url} (status ${response.status})`)
        continue
      }

      const contentType = response.headers.get("content-type") ?? ""
      if (!/json|javascript|text\/plain/i.test(contentType)) {
        errors.push(`${url} (unexpected content-type ${contentType || "unknown"})`)
        continue
      }

      const payload = await response.json()
      const menu = normalizeJsonMenu(payload)

      if (menu.length === 0) {
        errors.push(`${url} (no menu entries found in payload)`)
        continue
      }

      return { success: true, menu, resolvedUrl: url }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error"
      errors.push(`${url} (${message})`)
    }
  }

  return { success: false, errors }
}

const FALLBACK_MENU_ITEMS: MenuLocation[] = [
  {
    location: "Commons",
    meals: [
      {
        mealType: "Breakfast",
        items: [
          { name: "Steel-cut oatmeal", description: "With dried fruit and brown sugar", calories: 210 },
          { name: "Cage-free scrambled eggs", calories: 160 },
          { name: "Greek yogurt parfait", description: "Granola, berries, local honey", calories: 280 }
        ]
      },
      {
        mealType: "Lunch",
        items: [
          { name: "Lemon herb roasted chicken", calories: 320 },
          { name: "Quinoa & vegetable pilaf", calories: 260 },
          { name: "Roasted broccoli", calories: 80 }
        ]
      }
    ]
  },
  {
    location: "Berkeley College",
    meals: [
      {
        mealType: "Dinner",
        items: [
          { name: "Maple glazed salmon", calories: 410 },
          { name: "Garlic mashed potatoes", calories: 230 },
          { name: "Seasonal greens", description: "Lemon vinaigrette", calories: 90 }
        ]
      },
      {
        mealType: "Late Night",
        items: [
          { name: "Grilled vegetable panini", calories: 360 },
          { name: "Fresh fruit cups", calories: 120 }
        ]
      }
    ]
  }
]

const buildFallbackResponse = (date: string, error: string, jsonErrors?: string[]) =>
  NextResponse.json({
    date,
    source: "fallback" as const,
    format: "fallback" as const,
    menu: FALLBACK_MENU_ITEMS,
    error,
    jsonErrors: jsonErrors && jsonErrors.length > 0 ? jsonErrors : undefined
  })

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0]

  const jsonResult = await fetchJsonMenu(date)
  const jsonErrors = jsonResult.success ? [] : jsonResult.errors

  if (jsonResult.success) {
    return NextResponse.json({
      date,
      source: "live" as const,
      format: "json" as const,
      menu: jsonResult.menu,
      provider: { type: "json" as const, url: jsonResult.resolvedUrl }
    })
  }

  try {
    const response = await fetch(YALE_MENU_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml",
        "Accept-Language": "en-US,en;q=0.9"
      },
      cache: "no-store"
    })

    if (!response.ok) {
      const message = `Failed to load Yale Hospitality menus (status ${response.status})`
      const combined = [message, ...jsonErrors].filter(Boolean).join("; ")
      return buildFallbackResponse(date, combined || message, jsonErrors)
    }

    const html = await response.text()

    return NextResponse.json({
      date,
      source: "live" as const,
      format: "html" as const,
      html,
      fallbackMenu: FALLBACK_MENU_ITEMS,
      provider: { type: "html" as const, url: YALE_MENU_URL },
      jsonErrors: jsonErrors.length > 0 ? jsonErrors : undefined
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const combined = [message, ...jsonErrors].filter(Boolean).join("; ")
    return buildFallbackResponse(date, combined || message, jsonErrors)
  }
}
