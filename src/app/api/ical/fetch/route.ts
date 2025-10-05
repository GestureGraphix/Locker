import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { importIcsForUser } from "@/server/services/ical"

const schema = z.object({
  url: z.string().url(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = schema.parse(await req.json())
  const result = await importIcsForUser(session.user.id, body.url)
  return NextResponse.json(result)
}
