import { NextRequest, NextResponse } from "next/server"

const YALE_MENU_URL = "https://hospitality.yale.edu/menus"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

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

const FALLBACK_MENU_ITEMS: MenuLocation[] = [
  {
    location: "Commons",
    meals: [
      {
        mealType: "Breakfast",
        items: [
          { name: "Steel-cut oatmeal", description: "With dried fruit and brown sugar" },
          { name: "Cage-free scrambled eggs" },
          { name: "Greek yogurt parfait" }
        ]
      },
      {
        mealType: "Lunch",
        items: [
          { name: "Lemon herb roasted chicken" },
          { name: "Quinoa & vegetable pilaf" },
          { name: "Roasted broccoli" }
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
          { name: "Maple glazed salmon" },
          { name: "Garlic mashed potatoes" },
          { name: "Seasonal greens" }
        ]
      },
      {
        mealType: "Late Night",
        items: [
          { name: "Grilled vegetable panini" },
          { name: "Fresh fruit cups" }
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
