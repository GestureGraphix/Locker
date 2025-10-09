import { NextRequest, NextResponse } from "next/server"

const YALE_MENU_URL = "https://hospitality.yale.edu/menus"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

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

const buildFallbackResponse = (date: string, error: string) =>
  NextResponse.json({
    date,
    source: "fallback" as const,
    menu: FALLBACK_MENU_ITEMS,
    error
  })

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0]

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
      return buildFallbackResponse(date, `Failed to load Yale Hospitality menus (status ${response.status})`)
    }

    const html = await response.text()

    return NextResponse.json({
      date,
      source: "live" as const,
      html,
      fallbackMenu: FALLBACK_MENU_ITEMS
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return buildFallbackResponse(date, message)
  }
}
