import ical from "node-ical"

import { prisma } from "@/server/db/client"
import { withRls } from "@/server/db/rls"

export interface ImportIcsResult {
  added: number
  updated: number
  errors: string[]
}

export async function importIcsForUser(userId: string, url: string): Promise<ImportIcsResult> {
  const components = await ical.async.fromURL(url)
  let added = 0
  let updated = 0
  const errors: string[] = []

  const events = Object.values(components).filter(
    (component): component is ical.VEvent => component.type === "VEVENT",
  )

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, teamId: true },
  })

  if (!user) {
    throw new Error("User not found")
  }

  await withRls({ userId, role: user.role, teamId: user.teamId }, async tx => {
    for (const event of events) {
      try {
        const start = event.start instanceof Date ? event.start : new Date(event.start as string)
        const end = event.end instanceof Date ? event.end : new Date(event.end as string)

        if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
          throw new Error(`Invalid start date for event ${event.uid}`)
        }

        const uid = event.uid ?? `${event.summary ?? "untitled"}-${start.getTime()}`

        const payload = {
          title: event.summary ?? "Untitled Event",
          description: event.description ?? undefined,
          location: event.location ?? undefined,
          start,
          end,
          source: "ICAL" as const,
          uid,
          dtStart: start,
          raw: event as unknown as Record<string, unknown>,
        }

        const result = await tx.calendarEvent.upsert({
          where: {
            userId_uid_dtStart: {
              userId,
              uid,
              dtStart: payload.dtStart,
            },
          },
          update: payload,
          create: {
            userId,
            ...payload,
          },
        })

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          added += 1
        } else {
          updated += 1
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }
  })

  return { added, updated, errors }
}
