"use client"

import { useEffect, useMemo, useState } from "react"
import { useRole } from "@/components/role-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Edit,
  Save,
  X,
  Calendar,
  Target,
  Award,
  Activity,
  Droplets,
  BookOpen,
  Dumbbell,
  Settings,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Flame,
} from "lucide-react"



const formatHeight = (cm?: number | null) => {
  if (!cm || Number.isNaN(cm)) return "Add your height"
  const feet = Math.floor(cm / 30.48)
  const inches = Math.round((cm % 30.48) / 2.54)
  return `${feet}'${inches}"`
}

const formatWeight = (kg?: number | null) => {
  if (!kg || Number.isNaN(kg)) return "Add your weight"
  const lbs = Math.round(kg * 2.205)
  return `${lbs} lbs`
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || "TBD"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const formatTwoDecimalString = (value: number): string => {
  if (!Number.isFinite(value)) return "0"
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2)
}

const formatTimeRange = (start?: string, end?: string) => {
  if (!start) return ""
  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) return ""
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
  if (!end) {
    return formatter.format(startDate)
  }
  const endDate = new Date(end)
  if (Number.isNaN(endDate.getTime())) return formatter.format(startDate)
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
}

type PrimaryAthlete = ReturnType<typeof useRole>["primaryAthlete"]

// Concrete shape for nutrition goals (allow undefined/null from backend)
type NutritionGoals = {
  hydrationOuncesPerDay?: number | null
  caloriesPerDay?: number | null
  proteinGramsPerDay?: number | null
  carbsGramsPerDay?: number | null
  fatsGramsPerDay?: number | null
}

type EditableProfile = {
  name: string
  sport: string
  position: string
  level: string
  team: string
  heightCm: string
  weightKg: string
  allergies: string
  email: string
  phone: string
  location: string
  university: string
  graduationYear: string
}

const toEditableProfile = (athlete: PrimaryAthlete, email: string | undefined): EditableProfile => ({
  name: athlete?.name ?? "",
  sport: athlete?.sport ?? "",
  position: athlete?.position ?? "",
  level: athlete?.level ?? "",
  team: athlete?.team ?? "",
  heightCm: athlete?.heightCm != null ? String(athlete.heightCm) : "",
  weightKg: athlete?.weightKg != null ? String(athlete.weightKg) : "",
  allergies: (athlete?.allergies ?? []).join(", "),
  email: email ?? athlete?.email ?? "",
  phone: athlete?.phone ?? "",
  location: athlete?.location ?? "",
  university: athlete?.university ?? "",
  graduationYear: athlete?.graduationYear ?? "",
})

type EditableNutritionGoals = {
  hydrationOuncesPerDay: string
  caloriesPerDay: string
  proteinGramsPerDay: string
  carbsGramsPerDay: string
  fatsGramsPerDay: string
}

const toEditableNutritionGoals = (goals?: NutritionGoals | null): EditableNutritionGoals => ({
  hydrationOuncesPerDay:
    goals?.hydrationOuncesPerDay != null ? String(goals.hydrationOuncesPerDay) : "",
  caloriesPerDay:
    goals?.caloriesPerDay != null ? String(goals.caloriesPerDay) : "",
  proteinGramsPerDay:
    goals?.proteinGramsPerDay != null ? String(goals.proteinGramsPerDay) : "",
  carbsGramsPerDay:
    goals?.carbsGramsPerDay != null ? String(goals.carbsGramsPerDay) : "",
  fatsGramsPerDay:
    goals?.fatsGramsPerDay != null ? String(goals.fatsGramsPerDay) : "",
})


const parseGoalInput = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return parsed
}

export default function Account() {
  const { currentUser, primaryAthlete, updateAthleteProfile } = useRole()
  const [isEditing, setIsEditing] = useState(false)
  const [editedProfile, setEditedProfile] = useState<EditableProfile>(() =>
    toEditableProfile(primaryAthlete, currentUser?.email)
  )
  const [isEditingNutrition, setIsEditingNutrition] = useState(false)
  const [editedNutritionGoals, setEditedNutritionGoals] = useState<EditableNutritionGoals>(() =>
    toEditableNutritionGoals(primaryAthlete?.nutritionGoals)
  )

  useEffect(() => {
    setEditedProfile(toEditableProfile(primaryAthlete, currentUser?.email))
    setIsEditing(false)
  }, [primaryAthlete, currentUser?.email])

  useEffect(() => {
    setEditedNutritionGoals(toEditableNutritionGoals(primaryAthlete?.nutritionGoals))
    setIsEditingNutrition(false)
  }, [primaryAthlete])

  const handleSave = () => {
    if (!primaryAthlete) return

    updateAthleteProfile(primaryAthlete.id, {
      name: editedProfile.name.trim() || primaryAthlete.name,
      sport: editedProfile.sport.trim(),
      position: editedProfile.position.trim() || undefined,
      level: editedProfile.level.trim(),
      team: editedProfile.team.trim(),
      heightCm: editedProfile.heightCm ? Number(editedProfile.heightCm) : undefined,
      weightKg: editedProfile.weightKg ? Number(editedProfile.weightKg) : undefined,
      allergies: editedProfile.allergies
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
      email: editedProfile.email.trim().toLowerCase(),
      phone: editedProfile.phone.trim() || undefined,
      location: editedProfile.location.trim() || undefined,
      university: editedProfile.university.trim() || undefined,
      graduationYear: editedProfile.graduationYear.trim() || undefined,
    })

    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedProfile(toEditableProfile(primaryAthlete, currentUser?.email))
    setIsEditing(false)
  }

  const handleSaveNutrition = () => {
    if (!primaryAthlete) return

    updateAthleteProfile(primaryAthlete.id, {
      nutritionGoals: {
        hydrationOuncesPerDay: parseGoalInput(editedNutritionGoals.hydrationOuncesPerDay),
        caloriesPerDay: parseGoalInput(editedNutritionGoals.caloriesPerDay),
        proteinGramsPerDay: parseGoalInput(editedNutritionGoals.proteinGramsPerDay),
        carbsGramsPerDay: parseGoalInput(editedNutritionGoals.carbsGramsPerDay),
        fatsGramsPerDay: parseGoalInput(editedNutritionGoals.fatsGramsPerDay),
      },
    })

    setIsEditingNutrition(false)
  }

  const handleCancelNutrition = () => {
    setEditedNutritionGoals(toEditableNutritionGoals(primaryAthlete?.nutritionGoals))
    setIsEditingNutrition(false)
  }

  const stats = useMemo(() => {
    if (!primaryAthlete) {
      return {
        checkInsCompleted: 0,
        sessionsThisMonth: 0,
        hydrationAverage: 0,
        academicItemsCompleted: 0,
        prsThisMonth: 0,
        mobilityMinutesThisWeek: 0,
      }
    }

    const now = new Date()
    const sessions = primaryAthlete.sessions ?? []
    const completedSessions = sessions.filter((session) => session.completed)
    const sessionsThisMonth = sessions.filter((session) => {
      const date = new Date(session.startAt)
      if (Number.isNaN(date.getTime())) return false
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })

    const workouts = primaryAthlete.workouts ?? []
    const prsThisMonth = workouts.filter((workout) => {
      if (workout.status !== "Completed") return false
      const date = new Date(workout.dueDate)
      if (Number.isNaN(date.getTime())) return false
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })

    const hydrationLogs = primaryAthlete.hydrationLogs ?? []
    const hydrationAverage = hydrationLogs.length
      ? Math.round(
          hydrationLogs.reduce((total, log) => total + (log.ounces ?? 0), 0) / hydrationLogs.length
        )
      : 0

    const mobilityMinutesThisWeek = 0
    const academicItems = primaryAthlete.academicItems ?? []
    const academicItemsCompleted = academicItems.filter((item) => item.completed).length

    return {
      checkInsCompleted: completedSessions.length,
      sessionsThisMonth: sessionsThisMonth.length,
      hydrationAverage,
      academicItemsCompleted,
      prsThisMonth: prsThisMonth.length,
      mobilityMinutesThisWeek,
    }
  }, [primaryAthlete])

  const recentSessions = useMemo(() => {
    if (!primaryAthlete) return []
    return [...(primaryAthlete.sessions ?? [])]
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
      .slice(0, 5)
  }, [primaryAthlete])

  const recentHydration = useMemo(() => {
    if (!primaryAthlete) return []
    return [...(primaryAthlete.hydrationLogs ?? [])]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [primaryAthlete])

  const recentMeals = useMemo(() => {
    if (!primaryAthlete) return []
    return [...(primaryAthlete.mealLogs ?? [])]
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
      .slice(0, 5)
  }, [primaryAthlete])

  const todaysNutrition = useMemo(() => {
    if (!primaryAthlete) {
      return {
        hydrationOunces: 0,
        calories: 0,
        protein: 0,
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const hydrationOunces = (primaryAthlete.hydrationLogs ?? [])
      .filter((log) => log.date === today)
      .reduce((total, log) => total + (log.ounces ?? 0), 0)

    const todaysMeals = (primaryAthlete.mealLogs ?? []).filter((meal) => {
      if (!meal.completed) return false
      const date = new Date(meal.dateTime)
      if (Number.isNaN(date.getTime())) return false
      return date.toISOString().slice(0, 10) === today
    })

    const calories = todaysMeals.reduce((total, meal) => total + (meal.calories ?? 0), 0)
    const protein = todaysMeals.reduce((total, meal) => total + (meal.proteinG ?? 0), 0)

    return {
      hydrationOunces,
      calories,
      protein,
    }
  }, [primaryAthlete])

  if (!currentUser) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Account</h1>
        <p className="text-muted-foreground">Sign in to create your athlete profile and track your progress.</p>
      </div>
    )
  }

  if (currentUser.role === "coach") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Account</h1>
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-muted-foreground">
              Coach accounts are focused on athlete management. Switch to an athlete profile to customize personal
              information.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!primaryAthlete) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Account</h1>
        <p className="text-muted-foreground">Loading your athlete profile...</p>
      </div>
    )
  }

  const profile = primaryAthlete
  const allergies = profile.allergies ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Account</h1>
          <p className="text-muted-foreground">Manage your profile and view your progress</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start space-x-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src="/placeholder-avatar.jpg" />
              <AvatarFallback className="text-2xl">
                {profile.name ? profile.name.split(" ").map((n) => n[0]).join("") : "A"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{profile.name || "Add your name"}</h2>
                <p className="text-muted-foreground">
                  {[profile.sport, profile.position].filter(Boolean).join(" • ") || "Add your sport"}
                </p>
                {profile.university && <p className="text-sm text-muted-foreground">{profile.university}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{currentUser.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{profile.phone}</span>
                  </div>
                )}
                {profile.location && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{profile.location}</span>
                  </div>
                )}
                {profile.graduationYear && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Class of {profile.graduationYear}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="nutrition">Diet</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.name}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.name || "Add your name"}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Sport</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.sport}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, sport: e.target.value }))}
                      placeholder="Track & Field"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.sport || "Add your sport"}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Position</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.position}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, position: e.target.value }))}
                      placeholder="Sprint Specialist"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.position || "Add your position"}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Level</label>
                    {isEditing ? (
                      <Input
                        value={editedProfile.level}
                        onChange={(e) => setEditedProfile((prev) => ({ ...prev, level: e.target.value }))}
                        placeholder="Collegiate"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{profile.level || "Add your level"}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Team</label>
                    {isEditing ? (
                      <Input
                        value={editedProfile.team}
                        onChange={(e) => setEditedProfile((prev) => ({ ...prev, team: e.target.value }))}
                        placeholder="Sprints"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{profile.team || "Add your team"}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Height</label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedProfile.heightCm}
                        onChange={(e) => setEditedProfile((prev) => ({ ...prev, heightCm: e.target.value }))}
                        placeholder="175"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{formatHeight(profile.heightCm)}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Weight</label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedProfile.weightKg}
                        onChange={(e) => setEditedProfile((prev) => ({ ...prev, weightKg: e.target.value }))}
                        placeholder="70"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{formatWeight(profile.weightKg)}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Allergies</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.allergies}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, allergies: e.target.value }))}
                      placeholder="Peanuts, Shellfish"
                    />
                  ) : allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {allergies.map((allergy, index) => (
                        <Badge key={index} variant="outline" className="bg-[#eef5ff] text-[#0f2f5b] border-[#c7d7ee]">
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Add any allergies you want your staff to know.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editedProfile.email}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.phone}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 (555) 123-4567"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.phone || "Add a phone number"}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.location}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="City, State"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.location || "Add your location"}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">University</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.university}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, university: e.target.value }))}
                      placeholder="University name"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.university || "Add your university"}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Graduation Year</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editedProfile.graduationYear}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, graduationYear: e.target.value }))}
                      placeholder="2026"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.graduationYear || "Add your graduation year"}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nutrition" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">Daily Nutrition Goals</h3>
              <p className="text-sm text-muted-foreground">
                Dial in your fueling plan by setting realistic daily targets.
              </p>
            </div>
            <div className="flex gap-2 self-end sm:self-auto">
              {isEditingNutrition ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancelNutrition}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNutrition}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Goals
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditingNutrition(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Goals
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-primary" />
                    Hydration (oz / day)
                  </label>
                  {isEditingNutrition ? (
                    <Input
                      type="number"
                      min="0"
                      value={editedNutritionGoals.hydrationOuncesPerDay}
                      onChange={(e) =>
                        setEditedNutritionGoals((prev) => ({
                          ...prev,
                          hydrationOuncesPerDay: e.target.value,
                        }))
                      }
                      placeholder="110"
                      className="mt-2"
                    />
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {profile.nutritionGoals?.hydrationOuncesPerDay != null
                        ? `${profile.nutritionGoals.hydrationOuncesPerDay} oz per day`
                        : "Add a hydration goal to build consistent habits."}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Flame className="h-4 w-4 text-primary" />
                    Calories (kcal / day)
                  </label>
                  {isEditingNutrition ? (
                    <Input
                      type="number"
                      min="0"
                      value={editedNutritionGoals.caloriesPerDay}
                      onChange={(e) =>
                        setEditedNutritionGoals((prev) => ({
                          ...prev,
                          caloriesPerDay: e.target.value,
                        }))
                      }
                      placeholder="2800"
                      className="mt-2"
                    />
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {profile.nutritionGoals?.caloriesPerDay != null
                        ? `${profile.nutritionGoals.caloriesPerDay} kcal per day`
                        : "Set a calorie range to match your training load."}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    Protein (g / day)
                  </label>
                  {isEditingNutrition ? (
                    <Input
                      type="number"
                      min="0"
                      value={editedNutritionGoals.proteinGramsPerDay}
                      onChange={(e) =>
                        setEditedNutritionGoals((prev) => ({
                          ...prev,
                          proteinGramsPerDay: e.target.value,
                        }))
                      }
                      placeholder="160"
                      className="mt-2"
                    />
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {profile.nutritionGoals?.proteinGramsPerDay != null
                        ? `${profile.nutritionGoals.proteinGramsPerDay} grams per day`
                        : "Prioritize protein to support recovery."}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Carbs (g / day)
                  </label>
                  {isEditingNutrition ? (
                    <Input
                      type="number"
                      min="0"
                      value={editedNutritionGoals.carbsGramsPerDay}
                      onChange={(e) =>
                        setEditedNutritionGoals((prev) => ({
                          ...prev,
                          carbsGramsPerDay: e.target.value,
                        }))
                      }
                      placeholder="325"
                      className="mt-2"
                    />
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {profile.nutritionGoals?.carbsGramsPerDay != null
                        ? `${profile.nutritionGoals.carbsGramsPerDay} grams per day`
                        : "Map out carb targets for training and recovery."}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    Fats (g / day)
                  </label>
                  {isEditingNutrition ? (
                    <Input
                      type="number"
                      min="0"
                      value={editedNutritionGoals.fatsGramsPerDay}
                      onChange={(e) =>
                        setEditedNutritionGoals((prev) => ({
                          ...prev,
                          fatsGramsPerDay: e.target.value,
                        }))
                      }
                      placeholder="80"
                      className="mt-2"
                    />
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {profile.nutritionGoals?.fatsGramsPerDay != null
                        ? `${profile.nutritionGoals.fatsGramsPerDay} grams per day`
                        : "Balance fats for long-lasting energy."}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-primary/30 bg-secondary/40 p-4">
                <p className="text-sm font-medium text-foreground">Today&apos;s Progress</p>
                <p className="text-xs text-muted-foreground">
                  Totals are calculated from today&apos;s completed hydration and meal logs.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="rounded-lg bg-background/90 p-3 shadow-sm border">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-2 text-foreground">
                        <Droplets className="h-4 w-4 text-primary" /> Hydration
                      </span>
                      {profile.nutritionGoals?.hydrationOuncesPerDay != null && (
                        <span>Goal {profile.nutritionGoals.hydrationOuncesPerDay} oz</span>
                      )}
                    </div>
                    <p className="text-2xl font-semibold mt-2">
                      {formatTwoDecimalString(todaysNutrition.hydrationOunces)} oz
                    </p>
                  </div>
                  <div className="rounded-lg bg-background/90 p-3 shadow-sm border">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-2 text-foreground">
                        <Flame className="h-4 w-4 text-primary" /> Calories
                      </span>
                      {profile.nutritionGoals?.caloriesPerDay != null && (
                        <span>Goal {profile.nutritionGoals.caloriesPerDay}</span>
                      )}
                    </div>
                    <p className="text-2xl font-semibold mt-2">
                      {formatTwoDecimalString(todaysNutrition.calories)} kcal
                    </p>
                  </div>
                  <div className="rounded-lg bg-background/90 p-3 shadow-sm border">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-2 text-foreground">
                        <Dumbbell className="h-4 w-4 text-primary" /> Protein
                      </span>
                      {profile.nutritionGoals?.proteinGramsPerDay != null && (
                        <span>Goal {profile.nutritionGoals.proteinGramsPerDay} g</span>
                      )}
                    </div>
                    <p className="text-2xl font-semibold mt-2">
                      {formatTwoDecimalString(todaysNutrition.protein)} g
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">Check-ins Completed</p>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.checkInsCompleted}</p>
                <p className="text-xs text-muted-foreground">Completed training sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">Sessions This Month</p>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.sessionsThisMonth}</p>
                <p className="text-xs text-muted-foreground">Scheduled sessions in the current month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Droplets className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">Avg. Hydration (oz)</p>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.hydrationAverage}</p>
                <p className="text-xs text-muted-foreground">Average intake per log</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">Academic Items Completed</p>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.academicItemsCompleted}</p>
                <p className="text-xs text-muted-foreground">Track assignments from the academics tab</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Award className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">Workouts Completed</p>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.prsThisMonth}</p>
                <p className="text-xs text-muted-foreground">Completed plans this month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">Mobility Minutes</p>
                </div>
                <p className="text-2xl font-bold mt-2">{stats.mobilityMinutesThisWeek}</p>
                <p className="text-xs text-muted-foreground">Log mobility work in the mobility tab</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions logged yet. Schedule one from the training tab.</p>
                ) : (
                  recentSessions.map((session) => (
                    <div key={session.id} className="flex items-start justify-between rounded-lg bg-secondary/40 p-3">
                      <div>
                        <p className="font-medium">{session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(session.startAt)} • {formatTimeRange(session.startAt, session.endAt)}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" /> {session.type}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" /> {session.intensity}
                          </span>
                        </div>
                      </div>
                      <Badge variant={session.completed ? "default" : "outline"} className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {session.completed ? "Completed" : "Scheduled"}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hydration Logs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentHydration.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Track your hydration from the fuel tab to see it here.</p>
                ) : (
                  recentHydration.map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-lg bg-secondary/40 p-3">
                      <div>
                        <p className="font-medium">{log.ounces}oz</p>
                        <p className="text-xs text-muted-foreground">{formatDate(log.date)}</p>
                      </div>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Droplets className="h-3 w-3" /> {log.source}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Meal Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentMeals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add meals from the fuel tab to build your nutrition history.</p>
              ) : (
                recentMeals.map((meal) => (
                  <div key={meal.id} className="flex items-center justify-between rounded-lg bg-secondary/40 p-3">
                    <div>
                      <p className="font-medium capitalize">{meal.mealType}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(meal.dateTime)}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{meal.calories} kcal</p>
                      <p>{formatTwoDecimalString(meal.proteinG)}g protein</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                App Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Get reminders for check-ins and sessions</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Hydration Reminders</p>
                  <p className="text-sm text-muted-foreground">Daily reminders to stay hydrated</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Reports</p>
                  <p className="text-sm text-muted-foreground">Email summaries of your progress</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Help us improve Locker by sharing your feedback, suggestions, or reporting issues.
              </p>
              <Button variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Send Feedback
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
