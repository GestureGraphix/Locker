import { NextRequest, NextResponse } from "next/server"

import { initialAthletes } from "@/lib/initial-data"
import { normalizeAccounts, normalizeAthletes } from "@/lib/state-normalizer"
import type { Athlete, StoredAccount } from "@/lib/role-types"

type LockerServerState = {
  accounts: StoredAccount[]
  athletes: Athlete[]
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const globalForLocker = globalThis as typeof globalThis & {
  __LOCKER_SERVER_STATE__?: LockerServerState
}

const getInitialState = (): LockerServerState => ({
  accounts: [],
  athletes: clone(initialAthletes),
})

const getServerState = (): LockerServerState => {
  if (!globalForLocker.__LOCKER_SERVER_STATE__) {
    globalForLocker.__LOCKER_SERVER_STATE__ = getInitialState()
  }
  return globalForLocker.__LOCKER_SERVER_STATE__
}

export async function GET() {
  const state = getServerState()
  return NextResponse.json({
    accounts: clone(state.accounts),
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

  const payload = body as { accounts?: unknown; athletes?: unknown }
  const current = getServerState()
  const nextState: LockerServerState = {
    accounts: current.accounts,
    athletes: current.athletes,
  }

  if (Object.prototype.hasOwnProperty.call(payload, "accounts")) {
    nextState.accounts = Array.isArray(payload.accounts)
      ? normalizeAccounts(payload.accounts)
      : current.accounts
  }

  if (Object.prototype.hasOwnProperty.call(payload, "athletes")) {
    nextState.athletes = Array.isArray(payload.athletes)
      ? normalizeAthletes(payload.athletes)
      : current.athletes
  }

  globalForLocker.__LOCKER_SERVER_STATE__ = {
    accounts: clone(nextState.accounts),
    athletes: clone(nextState.athletes),
  }

  return NextResponse.json({ success: true })
}
