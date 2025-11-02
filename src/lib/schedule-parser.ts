export type ParsedScheduleSession = {
  day: string
  title: string
  tags: string[]
  startAt: string
  endAt: string
  type: "practice" | "lift" | "rehab"
  intensity: "low" | "medium" | "high"
  notes?: string
}

export type ParseCoachScheduleOptions = {
  weekStartDate: string
  defaultDurationMinutes?: number
}

export type ParseCoachScheduleResult = {
  sessions: ParsedScheduleSession[]
  warnings: string[]
}

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

const DEFAULT_DURATION_MINUTES = 60

const normalizeTitle = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")

const SPECIAL_TAG_NORMALIZERS: Record<string, string> = {
  "100mh": "100mh",
  "400mh": "400mh",
}

const normalizeTagValue = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return trimmed

  const lowered = trimmed.toLowerCase()
  const compact = lowered.replace(/\s+/g, "")

  if (SPECIAL_TAG_NORMALIZERS[compact]) {
    return SPECIAL_TAG_NORMALIZERS[compact]
  }

  return lowered
}

const splitTags = (title: string) => {
  const normalized = normalizeTitle(title)
  if (!normalized) return []

  const replaced = normalized
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*\+\s*/g, " and ")
    .replace(/\//g, " / ")
  const rawParts = replaced
    .split(/(?:\band\b|\/)/i)
    .map((part) => part.trim())
    .filter(Boolean)

  if (rawParts.length <= 1) {
    return [normalized]
  }

  return rawParts
}

const parseTime = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  const match = trimmed.match(/(\d{1,2}):(\d{2})(?:\s*(am|pm))?/)
  if (!match) return null

  let hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  const meridiem = match[3]

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  if (meridiem === "pm" && hours < 12) {
    hours += 12
  } else if (meridiem === "am" && hours === 12) {
    hours = 0
  } else if (!meridiem && hours < 12) {
    // Assume afternoon/evening sessions when meridiem is omitted
    if (hours === 12) {
      hours = 12
    } else {
      hours += 12
    }
  }

  return { hours, minutes }
}

const addMinutes = (date: Date, minutes: number) => {
  const copy = new Date(date)
  copy.setMinutes(copy.getMinutes() + minutes)
  return copy
}

const toIsoString = (date: Date) => date.toISOString()

const getWeekStartDate = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(`${trimmed}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const getDateForDay = (weekStart: Date, day: string) => {
  const index = DAY_ORDER.indexOf(day.toLowerCase())
  if (index === -1) return null
  const result = new Date(weekStart)
  result.setDate(result.getDate() + index)
  return result
}

const inferTypeFromTitle = (title: string): ParsedScheduleSession["type"] => {
  const lowered = title.toLowerCase()
  if (lowered.includes("lift")) return "lift"
  if (lowered.includes("rehab") || lowered.includes("recovery")) return "rehab"
  return "practice"
}

const inferIntensityFromTitle = (title: string): ParsedScheduleSession["intensity"] => {
  const lowered = title.toLowerCase()
  if (lowered.includes("test") || lowered.includes("max")) return "high"
  if (lowered.includes("tempo") || lowered.includes("recovery")) return "low"
  return "medium"
}

const parsePracticeSchedule = (
  lines: string[],
  trainingNotes: Record<string, string[]>,
  options: ParseCoachScheduleOptions,
  warnings: string[]
): ParsedScheduleSession[] => {
  const weekStart = getWeekStartDate(options.weekStartDate)
  if (!weekStart) {
    warnings.push("Invalid or missing week start date.")
    return []
  }

  const sessions: ParsedScheduleSession[] = []
  const duration = options.defaultDurationMinutes ?? DEFAULT_DURATION_MINUTES

  for (const line of lines) {
    const match = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*(.+)$/i)
    if (!match) continue

    const day = match[1]
    const rest = match[2].trim()
    if (!rest) continue

    const dayDate = getDateForDay(weekStart, day)
    if (!dayDate) continue

    const segments = rest.split(/\s*,\s*/)
    for (const segment of segments) {
      const segmentMatch = segment.match(/(.+?)\s+(\d{1,2}:\d{2}(?:\s*(?:am|pm))?)$/i)
      if (!segmentMatch) {
        warnings.push(`Unable to parse segment "${segment}" on ${day}.`)
        continue
      }

      const rawTitle = normalizeTitle(segmentMatch[1])
      const timeInfo = parseTime(segmentMatch[2])
      if (!timeInfo) {
        warnings.push(`Unable to parse time "${segmentMatch[2]}" on ${day}.`)
        continue
      }

      const startDate = new Date(dayDate)
      startDate.setHours(timeInfo.hours, timeInfo.minutes, 0, 0)
      const endDate = addMinutes(startDate, duration)

      const tags = splitTags(rawTitle)
        .map(normalizeTagValue)
        .filter(Boolean)
      if (!tags.length) {
        warnings.push(`No tags found for segment "${segment}" on ${day}.`)
        continue
      }

      const notesForDay = trainingNotes[day.toLowerCase()] ?? []

      sessions.push({
        day,
        title: rawTitle,
        tags,
        startAt: toIsoString(startDate),
        endAt: toIsoString(endDate),
        type: inferTypeFromTitle(rawTitle),
        intensity: inferIntensityFromTitle(rawTitle),
        notes: notesForDay.length ? notesForDay.join("\n") : undefined,
      })
    }
  }

  return sessions
}

const stripLeadingListMarker = (value: string) => {
  let result = value

  // Remove repeated bullet characters (e.g., -, –, •)
  result = result.replace(/^(?:[-–—•·]\s*)+/, "")

  const orderedMatch = result.match(/^\d+[.)]\s*/)
  if (orderedMatch) {
    return result.slice(orderedMatch[0].length)
  }

  const alphaMatch = result.match(/^[a-zA-Z][.)]\s*/)
  if (alphaMatch) {
    return result.slice(alphaMatch[0].length)
  }

  return result
}

const parseTrainingPlan = (lines: string[]) => {
  const notes: Record<string, string[]> = {}
  let currentDay: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const dayIndex = DAY_ORDER.indexOf(trimmed.toLowerCase())
    if (dayIndex !== -1) {
      currentDay = DAY_ORDER[dayIndex]
      if (!notes[currentDay]) {
        notes[currentDay] = []
      }
      continue
    }

    if (!currentDay) continue

    const cleaned = stripLeadingListMarker(trimmed).trim()
    if (!cleaned) continue

    if (/\bhurdles?\b/i.test(cleaned)) {
      continue
    }

    notes[currentDay].push(cleaned)
  }

  return notes
}

export const parseCoachSchedule = (
  input: string,
  options: ParseCoachScheduleOptions
): ParseCoachScheduleResult => {
  const warnings: string[] = []
  const sanitized = input.replace(/\r/g, "")
  const lines = sanitized.split("\n")

  const practiceLines: string[] = []
  const trainingLines: string[] = []

  let section: "practice" | "training" | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (/^practice schedule$/i.test(line)) {
      section = "practice"
      continue
    }

    if (/^training plan$/i.test(line)) {
      section = "training"
      continue
    }

    if (section === "practice") {
      practiceLines.push(line)
    } else if (section === "training") {
      trainingLines.push(line)
    }
  }

  const trainingNotes = parseTrainingPlan(trainingLines)
  const sessions = parsePracticeSchedule(practiceLines, trainingNotes, options, warnings)

  return { sessions, warnings }
}
