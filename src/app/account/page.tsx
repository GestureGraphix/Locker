"use client"

import { useState } from "react"
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
  MapPin
} from "lucide-react"

// Mock data
const mockProfile = {
  name: "Alex Johnson",
  email: "alex.johnson@university.edu",
  sport: "Track & Field",
  position: "Sprint Specialist",
  heightCm: 175,
  weightKg: 70,
  allergies: ["Peanuts", "Shellfish"],
  phone: "+1 (555) 123-4567",
  location: "San Francisco, CA",
  university: "University of California",
  graduationYear: "2025"
}

const mockStats = {
  checkInsCompleted: 28,
  sessionsThisMonth: 45,
  hydrationAverage: 78,
  academicItemsCompleted: 23,
  prsThisMonth: 4,
  mobilityMinutesThisWeek: 120
}

const mockHistory = {
  weeklyCheckIns: [
    { week: "Week 1", mental: 4.2, physical: 3.8 },
    { week: "Week 2", mental: 4.5, physical: 4.1 },
    { week: "Week 3", mental: 4.0, physical: 3.9 },
    { week: "Week 4", mental: 4.3, physical: 4.2 }
  ],
  monthlyStats: [
    { month: "Dec 2023", sessions: 42, hydration: 75, academics: 18 },
    { month: "Jan 2024", sessions: 45, hydration: 78, academics: 23 }
  ]
}

export default function Account() {
  const [isEditing, setIsEditing] = useState(false)
  const [profile, setProfile] = useState(mockProfile)
  const [editedProfile, setEditedProfile] = useState(mockProfile)

  const handleSave = () => {
    setProfile(editedProfile)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedProfile(profile)
    setIsEditing(false)
  }

  const formatHeight = (cm: number) => {
    const feet = Math.floor(cm / 30.48)
    const inches = Math.round((cm % 30.48) / 2.54)
    return `${feet}'${inches}"`
  }

  const formatWeight = (kg: number) => {
    const lbs = Math.round(kg * 2.205)
    return `${lbs} lbs`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start space-x-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src="/placeholder-avatar.jpg" />
              <AvatarFallback className="text-2xl">
                {profile.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{profile.name}</h2>
                <p className="text-muted-foreground">{profile.sport} • {profile.position}</p>
                <p className="text-sm text-muted-foreground">{profile.university}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{profile.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{profile.phone}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{profile.location}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Class of {profile.graduationYear}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Info */}
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
                      onChange={(e) => setEditedProfile(prev => ({ ...prev, name: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Sport</label>
                  {isEditing ? (
                    <Input 
                      value={editedProfile.sport}
                      onChange={(e) => setEditedProfile(prev => ({ ...prev, sport: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.sport}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Position</label>
                  {isEditing ? (
                    <Input 
                      value={editedProfile.position}
                      onChange={(e) => setEditedProfile(prev => ({ ...prev, position: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.position}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Height</label>
                    {isEditing ? (
                      <Input 
                        type="number"
                        value={editedProfile.heightCm}
                        onChange={(e) => setEditedProfile(prev => ({ ...prev, heightCm: parseInt(e.target.value) }))}
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
                        onChange={(e) => setEditedProfile(prev => ({ ...prev, weightKg: parseInt(e.target.value) }))}
                        placeholder="70"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{formatWeight(profile.weightKg)}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Allergies</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profile.allergies.map((allergy, index) => (
                      <Badge key={index} variant="outline" className="bg-[#eef5ff] text-[#0f2f5b] border-[#c7d7ee]">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
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
                      onChange={(e) => setEditedProfile(prev => ({ ...prev, email: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  {isEditing ? (
                    <Input 
                      value={editedProfile.phone}
                      onChange={(e) => setEditedProfile(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.phone}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  {isEditing ? (
                    <Input 
                      value={editedProfile.location}
                      onChange={(e) => setEditedProfile(prev => ({ ...prev, location: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.location}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">University</label>
                  {isEditing ? (
                    <Input 
                      value={editedProfile.university}
                      onChange={(e) => setEditedProfile(prev => ({ ...prev, university: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.university}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Graduation Year</label>
                  {isEditing ? (
                    <Input 
                      type="number"
                      value={editedProfile.graduationYear}
                      onChange={(e) => setEditedProfile(prev => ({ ...prev, graduationYear: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{profile.graduationYear}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Check-ins Completed</p>
                    <p className="text-2xl font-bold">{mockStats.checkInsCompleted}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Dumbbell className="h-5 w-5 text-[#0f4d92]" />
                  <div>
                    <p className="text-sm font-medium">Sessions This Month</p>
                    <p className="text-2xl font-bold">{mockStats.sessionsThisMonth}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Droplets className="h-5 w-5 text-[#1c6dd0]" />
                  <div>
                    <p className="text-sm font-medium">Hydration Average</p>
                    <p className="text-2xl font-bold">{mockStats.hydrationAverage}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-[#123d73]" />
                  <div>
                    <p className="text-sm font-medium">Academic Items</p>
                    <p className="text-2xl font-bold">{mockStats.academicItemsCompleted}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Award className="h-5 w-5 text-[#0f2f5b]" />
                  <div>
                    <p className="text-sm font-medium">PRs This Month</p>
                    <p className="text-2xl font-bold">{mockStats.prsThisMonth}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-[#1c4f8f]" />
                  <div>
                    <p className="text-sm font-medium">Mobility Minutes</p>
                    <p className="text-2xl font-bold">{mockStats.mobilityMinutesThisWeek}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Check-ins */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Check-in Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockHistory.weeklyCheckIns.map((week, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium">{week.week}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>Mental: {week.mental}/5</span>
                          <span>Physical: {week.physical}/5</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {(week.mental + week.physical) / 2}/5
                        </p>
                        <p className="text-xs text-muted-foreground">Average</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockHistory.monthlyStats.map((month, index) => (
                    <div key={index} className="p-4 rounded-lg bg-secondary/50">
                      <h3 className="font-semibold mb-3">{month.month}</h3>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-[#0f4d92]">{month.sessions}</p>
                          <p className="text-xs text-muted-foreground">Sessions</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#1c6dd0]">{month.hydration}%</p>
                          <p className="text-xs text-muted-foreground">Hydration</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#123d73]">{month.academics}</p>
                          <p className="text-xs text-muted-foreground">Academic Items</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
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

