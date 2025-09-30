"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  House,
  BookOpen,
  Dumbbell,
  Apple,
  Activity,
  User,
  Menu,
  ChevronRight,
  Zap,
  TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/", icon: House, badge: null },
  { name: "Academics", href: "/academics", icon: BookOpen, badge: "3" },
  { name: "Training", href: "/training", icon: Dumbbell, badge: null },
  { name: "Fuel", href: "/fuel", icon: Apple, badge: null },
  { name: "Mobility", href: "/mobility", icon: Activity, badge: null },
  { name: "Account", href: "/account", icon: User, badge: null },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0 glass-card border-r border-white/20">
        <div className="flex flex-col flex-grow">
          {/* Logo Section */}
          <div className="flex items-center px-8 py-8 border-b border-white/10">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow animate-pulse-slow">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Locker</h1>
                <p className="text-sm text-gray-600 font-medium">Athlete Dashboard</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-grow px-6 py-8">
            <nav className="space-y-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-300 relative overflow-hidden",
                    pathname === item.href
                      ? "gradient-primary text-white shadow-glow scale-105"
                      : "text-gray-700 hover:bg-white/50 hover:text-gray-900 hover:scale-105 hover:shadow-lg"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon
                      className={cn(
                        "h-5 w-5 transition-all duration-300",
                        pathname === item.href 
                          ? "text-white" 
                          : "text-gray-500 group-hover:text-gray-700"
                      )}
                      aria-hidden="true"
                    />
                    <span className="relative z-10">{item.name}</span>
                    {item.badge && (
                      <span className={cn(
                        "px-2 py-1 text-xs font-bold rounded-full",
                        pathname === item.href
                          ? "bg-white/20 text-white"
                          : "bg-red-100 text-red-600"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {pathname === item.href && (
                    <ChevronRight className="h-4 w-4 text-white animate-bounce" aria-hidden="true" />
                  )}
                  {pathname === item.href && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent shimmer"></div>
                  )}
                </Link>
              ))}
            </nav>
          </div>

          {/* User Profile */}
          <div className="px-6 py-6 border-t border-white/10">
            <div className="relative group">
              <div className="flex items-center space-x-4 p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-white/50 hover:from-gray-100 hover:to-white/70 transition-all duration-300 cursor-pointer">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl gradient-secondary flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    AJ
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">Alex Johnson</p>
                  <p className="text-xs text-gray-600 font-medium">Track & Field • Elite</p>
                  <div className="flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-xs text-green-600 font-semibold">+12% this week</span>
                  </div>
                </div>
                <Zap className="h-4 w-4 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between px-6 py-4 glass-card border-b border-white/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Locker</h1>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="glass-card border-white/20 hover:bg-white/50">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 glass-card">
              <div className="flex flex-col h-full">
                <div className="flex items-center px-6 py-8 border-b border-white/10">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
                      <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Locker</h1>
                      <p className="text-sm text-gray-600 font-medium">Athlete Dashboard</p>
                    </div>
                  </div>
                </div>
                <div className="flex-grow px-4 py-6">
                  <nav className="space-y-3">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "group flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-300",
                          pathname === item.href
                            ? "gradient-primary text-white shadow-glow"
                            : "text-gray-700 hover:bg-white/50 hover:text-gray-900"
                        )}
                      >
                        <div className="flex items-center space-x-3">
                          <item.icon
                            className={cn(
                              "h-5 w-5",
                              pathname === item.href ? "text-white" : "text-gray-500 group-hover:text-gray-700"
                            )}
                            aria-hidden="true"
                          />
                          <span>{item.name}</span>
                          {item.badge && (
                            <span className={cn(
                              "px-2 py-1 text-xs font-bold rounded-full",
                              pathname === item.href
                                ? "bg-white/20 text-white"
                                : "bg-red-100 text-red-600"
                            )}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {pathname === item.href && (
                          <ChevronRight className="h-4 w-4 text-white" aria-hidden="true" />
                        )}
                      </Link>
                    ))}
                  </nav>
                </div>
                <div className="px-4 py-4 border-t border-white/10">
                  <div className="flex items-center space-x-3 p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-white/50">
                    <div className="w-10 h-10 rounded-xl gradient-secondary flex items-center justify-center text-white font-bold">
                      AJ
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">Alex Johnson</p>
                      <p className="text-xs text-gray-600 font-medium">Track & Field</p>
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  )
}