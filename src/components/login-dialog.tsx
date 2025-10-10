"use client"

import { FormEvent, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRole } from "@/components/role-context"
import { cn } from "@/lib/utils"

const defaultFormState = (role: "athlete" | "coach") => ({
  role,
  email: "",
  name: "",
})

export function LoginDialog() {
  const { currentUser, login, logout, primaryAthlete } = useRole()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialRole: "athlete" | "coach" = currentUser?.role ?? "athlete"
  const [form, setForm] = useState(defaultFormState(initialRole))

  const displayName = useMemo(() => {
    if (!currentUser) return "Guest"
    if (currentUser.role === "athlete") {
      return primaryAthlete?.name ?? currentUser.name
    }
    return currentUser.name
  }, [currentUser, primaryAthlete])

  const roleLabel = currentUser?.role === "coach" ? "Coach" : "Athlete"

  const resetForm = () => {
    setForm({
      role: currentUser?.role ?? "athlete",
      email: currentUser?.email ?? "",
      name: currentUser?.name ?? "",
    })
    setError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      resetForm()
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.email.trim()) {
      setError("Email is required to sign in.")
      return
    }
    login({ role: form.role, email: form.email, name: form.name })
    setOpen(false)
  }

  const handleLogout = () => {
    logout()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {currentUser ? (
          <button
            type="button"
            className={cn(
              "w-full rounded-2xl bg-gradient-to-r from-gray-50 to-white/70 border border-white/40",
              "p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all text-left"
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#0f4d92] text-white font-bold flex items-center justify-center">
              {displayName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 font-medium truncate">{currentUser.email}</p>
              <p className="text-xs text-[#1c6dd0] font-semibold mt-1">{roleLabel}</p>
            </div>
            <span className="text-xs font-medium text-[#0f4d92]">Manage</span>
          </button>
        ) : (
          <Button className="w-full gradient-primary text-white shadow-glow">Sign In</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{currentUser ? "Manage account" : "Sign in"}</DialogTitle>
          <DialogDescription>
            {currentUser
              ? "Update your details or sign out to switch accounts."
              : "Sign in to save your meals, hydration, and training updates."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {currentUser && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-600 space-y-2">
              <div>
                <p className="font-semibold text-gray-800">Currently signed in</p>
                <p>{displayName}</p>
                <p className="text-xs text-gray-500">{currentUser.email}</p>
              </div>
              <Button variant="outline" onClick={handleLogout} className="w-full">
                Sign out
              </Button>
            </div>
          )}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase text-gray-500">Role</span>
              <Tabs
                value={form.role}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, role: value as "athlete" | "coach" }))
                }
                className="w-full"
              >
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="athlete">Athlete</TabsTrigger>
                  <TabsTrigger value="coach">Coach</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Name</label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Display name (optional)"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full">
              {currentUser ? "Save & switch" : "Sign in"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
