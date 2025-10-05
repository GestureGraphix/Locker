import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { createPracticeEvent } from "@/server/services/google-calendar"

const payloadSchema = z.object({
  title: z.string().min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
  athleteIds: z.array(z.string().uuid()).optional(),
})

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "COACH") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const json = await req.json()
  const body = payloadSchema.parse(json)

  if (body.end <= body.start) {
    return NextResponse.json({ error: "End must be after start" }, { status: 400 })
  }

  await createPracticeEvent({
    coachId: session.user.id,
    title: body.title,
    start: body.start,
    end: body.end,
    athleteIds: body.athleteIds,
  })

  return NextResponse.json({ status: "ok" })
}
