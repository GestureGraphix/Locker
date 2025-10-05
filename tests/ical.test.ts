import { describe, expect, it, vi, beforeEach } from "vitest"

import { importIcsForUser } from "../src/server/services/ical"

const upsertMock = vi.fn()
const findUniqueMock = vi.fn()

vi.mock("node-ical", () => ({
  default: {
    async: {
      fromURL: vi.fn(async () => ({
        evt1: {
          type: "VEVENT",
          uid: "evt-1",
          summary: "Workout",
          start: new Date("2024-01-01T10:00:00Z"),
          end: new Date("2024-01-01T11:00:00Z"),
        },
        evt2: {
          type: "VEVENT",
          uid: "evt-2",
          summary: "Class",
          start: new Date("2024-01-02T10:00:00Z"),
          end: new Date("2024-01-02T11:00:00Z"),
        },
      })),
    },
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
      calendarEvent: {
        upsert: upsertMock,
      },
    } as any),
  ),
}))

describe("importIcsForUser", () => {
  beforeEach(() => {
    upsertMock.mockReset()
    findUniqueMock.mockResolvedValue({ role: "ATHLETE", teamId: null })
    upsertMock
      .mockResolvedValueOnce({ createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01") })
      .mockResolvedValueOnce({ createdAt: new Date("2024-01-02"), updatedAt: new Date("2024-02-02") })
  })

  it("tracks added and updated events", async () => {
    const result = await importIcsForUser("user-1", "https://example.com/calendar.ics")

    expect(result.added).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(upsertMock).toHaveBeenCalledTimes(2)
  })
})
