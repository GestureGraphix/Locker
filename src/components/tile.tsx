import Link from "next/link"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface TileProps {
  title: string
  description: string
  href: string
  icon: LucideIcon
  className?: string
}

export function Tile({ title, description, href, icon: Icon, className }: TileProps) {
  return (
    <Link href={href} className={cn("block group", className)}>
      <Card className="h-full glass-card border-0 shadow-premium hover:shadow-glow transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-2">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-glow">
              <Icon className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{title}</h3>
              <p className="text-gray-600 font-medium">{description}</p>
            </div>
            <div className="w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}