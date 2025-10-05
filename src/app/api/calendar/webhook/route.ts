import { NextResponse } from "next/server"

import { withSystemAccess } from "@/server/db/rls"
import { handleCalendarWebhook } from "@/server/services/google-calendar"

export async function POST(req: Request) {
  const channelToken = req.headers.get("x-goog-channel-token") ?? undefined
  const channelId = req.headers.get("x-goog-channel-id")
  const resourceId = req.headers.get("x-goog-resource-id")

  if (!channelId || !resourceId) {
    return NextResponse.json({ error: "Missing headers" }, { status: 400 })
  }

  const tokens = await withSystemAccess(tx =>
    tx.googleCalendarToken.findMany({
      where: {
        watchChannelId: channelId,
      },
    }),
  )

  await Promise.all(
    tokens.map(token =>
      handleCalendarWebhook({
        channelId,
        channelToken,
        resourceId,
        userId: token.userId,
      }).catch(error => {
        console.error("Webhook handling failed", error)
      }),
    ),
  )

  return NextResponse.json({ status: "ok" })
}

export async function GET() {
  return NextResponse.json({ status: "ok" })
}
