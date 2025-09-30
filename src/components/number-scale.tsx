"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface NumberScaleProps {
  value: number | null
  onChange: (value: number) => void
  label: string
  className?: string
}

export function NumberScale({ value, onChange, label, className }: NumberScaleProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-base font-semibold text-gray-800">{label}</h3>
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((num) => (
          <Button
            key={num}
            variant={value === num ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-12 w-12 rounded-xl text-lg font-bold transition-all duration-300 relative overflow-hidden",
              value === num
                ? "gradient-primary text-white shadow-glow scale-105 border-0"
                : "glass-card border-white/20 hover:bg-white/50 hover:scale-105 text-gray-700 hover:text-gray-900"
            )}
            onClick={() => onChange(num)}
          >
            {value === num && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent shimmer"></div>
            )}
            <span className="relative z-10">{num}</span>
          </Button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 font-medium">
        <span>Poor</span>
        <span>Excellent</span>
      </div>
    </div>
  )
}