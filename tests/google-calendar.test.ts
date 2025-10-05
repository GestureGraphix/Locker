import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

const upsertMock = vi.fn()
const updateMock = vi.fn()
const findUniqueMock = vi.fn()
const listTracker = vi.fn()

class OAuth2Mock {
  setCredentials() {}
  on() {}
}

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: OAuth2Mock,
    },
    calendar: () => ({
      events: {
        list: async () => {
          listTracker()
          const response = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          )
          const data = await response.json()
          return { data }
        },
        insert: vi.fn(),
        watch: vi.fn(),
      },
    }),
  },
}))

vi.mock("../src/server/db/client", () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}))

vi.mock("../src/server/db/rls", () => ({
  withRls: vi.fn(async (_auth: unknown, fn: (tx: any) => any) =>
    fn({
      googleCalendarToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "token-1",
          userId: "user-1",
          calendarId: "primary",
          refreshToken: "refresh-123",
          accessToken: "access-123",
          syncToken: null,
        }),
        update: updateMock,
      },
      calendarEvent: {
        upsert: upsertMock,
      },
    } as any),
  ),
  withSystemAccess: vi.fn(async (fn: (tx: any) => any) => fn({
    googleCalendarToken: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as any)),
}))

const { syncGoogleCalendarForUser } = await import("../src/server/services/google-calendar")

const server = setupServer(
  http.get("https://www.googleapis.com/calendar/v3/calendars/primary/events", () =>
    HttpResponse.json({
      items: [
        {
          id: "evt-1",
          summary: "Practice",
          start: { dateTime: "2024-01-01T10:00:00Z" },
          end: { dateTime: "2024-01-01T11:00:00Z" },
          updated: "2024-01-01T00:00:00Z",
        },
      ],
      nextSyncToken: "sync-1",
    }),
  ),
)

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  listTracker.mockReset()
})
afterAll(() => server.close())

describe("syncGoogleCalendarForUser", () => {
  beforeEach(() => {
    upsertMock.mockReset()
    updateMock.mockReset()
    findUniqueMock.mockResolvedValue({ role: "ATHLETE", teamId: null })
    upsertMock.mockResolvedValue({})
    updateMock.mockResolvedValue({})
  })

  it("writes events and updates sync token", async () => {
    await syncGoogleCalendarForUser("user-1")

    expect(listTracker).toHaveBeenCalled()
    expect(upsertMock).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })
})
