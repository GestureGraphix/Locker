import { NextRequest, NextResponse } from "next/server"

const YALE_MENU_URL = "https://hospitality.yale.edu/menus"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

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
    location: "Commons",
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
          { name: "Lemon herb roasted chicken", description: "With thyme pan sauce", calories: 420 },
          { name: "Quinoa & vegetable pilaf", description: "Carrots, peas, and herbs", calories: 310 },
          { name: "Roasted broccoli", description: "Garlic and olive oil", calories: 120 }
        ]
      },
      {
        mealType: "Dinner",
        items: [
          { name: "Grilled Atlantic salmon", description: "Citrus glaze and wild rice", calories: 480 },
          { name: "Farro and roasted vegetables", description: "Sweet potatoes and kale", calories: 350 },
          { name: "Seasonal fruit crisp", description: "Served warm with oats", calories: 260 }
        ]
      }
    ]
  },
  {
    location: "Jonathan Edwards College",
    meals: [
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
      },
      {
        mealType: "Late Night",
        items: [
          { name: "Veggie hummus wrap", description: "Whole-wheat tortilla", calories: 290 },
          { name: "Fresh fruit cups", description: "Seasonal selection", calories: 110 }
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
