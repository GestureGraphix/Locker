import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { listHydratedEvents, syncGoogleCalendarForUser } from "@/server/services/google-calendar"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await syncGoogleCalendarForUser(session.user.id).catch(error => {
    console.error("Failed to sync calendar", error)
  })

  const payload = await listHydratedEvents({
    userId: session.user.id,
    role: session.user.role ?? "ATHLETE",
    teamId: session.user.teamId ?? null,
  })
  return NextResponse.json(payload)
}
