import { google } from "googleapis"
import type { calendar_v3 } from "googleapis"
import { addMinutes, subDays } from "date-fns"

import { prisma } from "@/server/db/client"
import { withRls, withSystemAccess } from "@/server/db/rls"
import type { CalendarEvent, GoogleCalendarToken } from "@prisma/client"

export interface PersistGoogleTokensInput {
  userId: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
}

export async function persistGoogleTokens({
  userId,
  accessToken,
  refreshToken,
  expiresAt,
}: PersistGoogleTokensInput): Promise<GoogleCalendarToken> {
  const expiryDate = expiresAt ? new Date(expiresAt * 1000) : undefined
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, teamId: true },
  })

  if (!user) {
    throw new Error("User not found")
  }

  return withRls(
    { userId, role: user.role, teamId: user.teamId },
    tx =>
      tx.googleCalendarToken.upsert({
        where: {
          userId_calendarId: { userId, calendarId: "primary" },
        },
        update: {
          accessToken: accessToken ?? undefined,
          refreshToken: refreshToken ?? undefined,
          expiryDate,
        },
        create: {
          userId,
          accessToken,
          refreshToken,
          expiryDate,
        },
      }),
  )
}

export async function getOAuthClient(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, teamId: true },
  })

  if (!user) {
    throw new Error("User not found")
  }

  const token = await withRls(
    { userId, role: user.role, teamId: user.teamId },
    tx =>
      tx.googleCalendarToken.findUnique({
        where: { userId_calendarId: { userId, calendarId: "primary" } },
      }),
  )

  if (!token?.refreshToken) {
    throw new Error("Missing Google refresh token")
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )

  client.setCredentials({
    access_token: token.accessToken ?? undefined,
    refresh_token: token.refreshToken,
    expiry_date: token.expiryDate?.getTime(),
  })

  client.on("tokens", async next => {
    await prisma.googleCalendarToken.update({
      where: { id: token.id },
      data: {
        accessToken: next.access_token ?? token.accessToken,
        expiryDate: next.expiry_date ? new Date(next.expiry_date) : token.expiryDate,
      },
    })
  })

  return { client, token, auth: { userId, role: user.role, teamId: user.teamId } }
}

const calendar = google.calendar("v3")

export interface SyncOptions {
  maxWindowDays?: number
  forceFullSync?: boolean
  webhookChannelToken?: string
}

export async function syncGoogleCalendarForUser(
  userId: string,
  options: SyncOptions = {},
) {
  const { client, token, auth } = await getOAuthClient(userId)
  const maxWindowDays = options.maxWindowDays ?? 14
  const now = new Date()
  const timeMin = subDays(now, 1).toISOString()
  const timeMax = addMinutes(now, maxWindowDays * 24 * 60).toISOString()

  let pageToken: string | undefined
  let syncToken = token.syncToken ?? undefined
  const events: calendar_v3.Schema$Event[] = []

  do {
    const response = await calendar.events.list({
      calendarId: "primary",
      auth: client,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: syncToken && !options.forceFullSync ? undefined : timeMin,
      timeMax: syncToken && !options.forceFullSync ? undefined : timeMax,
      syncToken: syncToken && !options.forceFullSync ? syncToken : undefined,
      pageToken,
    })

    if (!response.data.items) {
      break
    }

    events.push(...response.data.items)
    pageToken = response.data.nextPageToken ?? undefined
    syncToken = response.data.nextSyncToken ?? syncToken
  } while (pageToken)

  await withRls(auth, async trx => {
    for (const event of events) {
      if (!event.id || !event.start?.dateTime || !event.end?.dateTime) continue

      const start = new Date(event.start.dateTime)
      const end = new Date(event.end.dateTime)

      const payload: Partial<CalendarEvent> = {
        title: event.summary ?? "Untitled Event",
        description: event.description ?? undefined,
        location: event.location ?? undefined,
        start,
        end,
        source: "GOOGLE",
        externalId: event.id,
        raw: event as unknown as Record<string, unknown>,
        lastUpdated: event.updated ? new Date(event.updated) : new Date(),
      }

      await trx.calendarEvent.upsert({
        where: {
          userId_externalId: {
            userId,
            externalId: event.id,
          },
        },
        update: payload,
        create: {
          userId,
          ...payload,
        },
      })
    }

    await trx.googleCalendarToken.update({
      where: { id: token.id },
      data: {
        syncToken,
        lastSyncedAt: new Date(),
      },
    })
  })
}

export async function ensureWatchChannel(userId: string) {
  const { client, token, auth } = await getOAuthClient(userId)
  const channelId = token.watchChannelId ?? `locker-${token.id}`
  const expiration = addMinutes(new Date(), 60 * 12)

  const response = await calendar.events.watch({
    calendarId: "primary",
    auth: client,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: `${process.env.NEXTAUTH_URL}/api/calendar/webhook`,
      token: process.env.WEBHOOK_CHANNEL_TOKEN,
      params: { ttl: "43200" },
    },
  })

  await withRls(auth, tx =>
    tx.googleCalendarToken.update({
      where: { id: token.id },
      data: {
        watchChannelId: channelId,
        watchResourceId: response.data.resourceId ?? token.watchResourceId,
        watchExpiration: expiration,
      },
    }),
  )
}

export async function listHydratedEvents(auth: {
  userId: string
  role: "ATHLETE" | "COACH"
  teamId: string | null
}) {
  return withRls(auth, async tx => {
    const [events, token] = await Promise.all([
      tx.calendarEvent.findMany({
        where: { userId: auth.userId },
        orderBy: { start: "asc" },
      }),
      tx.googleCalendarToken.findUnique({
        where: { userId_calendarId: { userId: auth.userId, calendarId: "primary" } },
        select: { lastSyncedAt: true },
      }),
    ])

    return {
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        source: event.source,
        lastUpdated: event.lastUpdated,
      })),
      lastSyncedAt: token?.lastSyncedAt ?? null,
    }
  })
}

export interface CreatePracticeInput {
  title: string
  start: Date
  end: Date
  coachId: string
  athleteIds?: string[]
}

export async function createPracticeEvent({
  title,
  start,
  end,
  coachId,
  athleteIds,
}: CreatePracticeInput) {
  const coach = await prisma.user.findUniqueOrThrow({ where: { id: coachId } })

  const athletes = await prisma.user.findMany({
    where: {
      role: "ATHLETE",
      teamId: coach.teamId,
      ...(athleteIds?.length ? { id: { in: athleteIds } } : {}),
    },
  })

  await Promise.all(
    athletes.map(async athlete => {
      try {
        const { client, auth: athleteAuth } = await getOAuthClient(athlete.id)

        const event = await calendar.events.insert({
          calendarId: "primary",
          auth: client,
          requestBody: {
            summary: title,
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
          },
        })

        if (event.data.id) {
          await withRls(athleteAuth, tx =>
            tx.calendarEvent.upsert({
              where: {
                userId_externalId: {
                  userId: athlete.id,
                  externalId: event.data.id!,
                },
              },
              update: {
                title,
                start,
                end,
                source: "GOOGLE",
                raw: event.data as unknown as Record<string, unknown>,
              },
              create: {
                userId: athlete.id,
                title,
                start,
                end,
                source: "GOOGLE",
                externalId: event.data.id!,
                raw: event.data as unknown as Record<string, unknown>,
              },
            }),
          )
        }
      } catch (error) {
        console.error(`Failed to create event for athlete ${athlete.id}`, error)
      }
    }),
  )
}

export interface WebhookPayload {
  channelId: string
  channelToken?: string
  resourceId: string
  userId: string
}

export async function handleCalendarWebhook({
  channelId,
  channelToken,
  resourceId,
  userId,
}: WebhookPayload) {
  if (channelToken !== process.env.WEBHOOK_CHANNEL_TOKEN) {
    throw new Error("Invalid channel token")
  }

  const token = await withRls(
    { userId, role: "ATHLETE", teamId: null },
    tx =>
      tx.googleCalendarToken.findFirst({
        where: {
          userId,
          watchChannelId: channelId,
          watchResourceId: resourceId,
        },
      }),
  )

  if (!token) {
    throw new Error("Unknown watch channel")
  }

  await syncGoogleCalendarForUser(userId, { forceFullSync: false })
}

export async function revokeExpiredWatchChannels() {
  const tokens = await withSystemAccess(tx =>
    tx.googleCalendarToken.findMany({
      where: {
        watchExpiration: {
          lt: addMinutes(new Date(), 5),
        },
      },
    }),
  )

  for (const token of tokens) {
    try {
      await ensureWatchChannel(token.userId)
    } catch (error) {
      console.error("Failed to refresh watch channel", error)
    }
  }
}
