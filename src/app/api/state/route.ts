import { NextRequest, NextResponse } from "next/server"

import { readLockerState, withLockerState } from "@/lib/server/persistent-store"
import { normalizeAthletes } from "@/lib/state-normalizer"

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export async function GET() {
  const state = await readLockerState()
  return NextResponse.json({
    athletes: clone(state.athletes),
  })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = body as { athletes?: unknown }

  if (!Object.prototype.hasOwnProperty.call(payload, "athletes")) {
    return NextResponse.json({ success: true })
  }

  if (!Array.isArray(payload.athletes)) {
    return NextResponse.json({ error: "Athletes must be an array" }, { status: 400 })
  }

  const normalizedAthletes = normalizeAthletes(payload.athletes)

  const nextState = await withLockerState((current) => ({
    accounts: current.accounts,
    athletes: normalizedAthletes,
  }))

  return NextResponse.json({ success: true, athletes: clone(nextState.athletes) })
}
