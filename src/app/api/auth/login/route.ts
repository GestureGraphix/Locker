import { NextResponse } from "next/server"

import type { UserAccount } from "@/lib/role-types"
import { createSessionToken } from "@/lib/server/auth-token"
import {
  getNextAthleteId,
  readLockerState,
  writeLockerState,
} from "@/lib/server/persistent-store"

const normalizeEmail = (email: unknown) =>
  typeof email === "string" ? email.trim().toLowerCase() : ""

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = body as {
    email?: unknown
    password?: unknown
    role?: unknown
  }

  const email = normalizeEmail(payload.email)
  const requestedRole =
    payload.role === "coach" ? "coach" : payload.role === "athlete" ? "athlete" : null
  const password = typeof payload.password === "string" ? payload.password : ""

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 })
  }

  if (!requestedRole) {
    return NextResponse.json({ error: "Role is required." }, { status: 400 })
  }

  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 })
  }

  const current = await readLockerState()
  const accountsForEmail = current.accounts.filter((account) => account.email === email)

  if (accountsForEmail.length === 0) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 })
  }

  let account =
    accountsForEmail.find((candidate) => candidate.role === requestedRole) ?? null

  if (!account) {
    account =
      accountsForEmail.find((candidate) => candidate.password === password) ?? null

    if (!account) {
      return NextResponse.json(
        { error: "Account not found. Try switching your role and signing in again." },
        { status: 404 }
      )
    }
  } else {
    // ---- Minimal TS fix: create a const so TS can safely narrow (no other logic changes) ----
    const acc = account
    if (acc.password !== password) {
      const alternativeAccount = accountsForEmail.find(
        (candidate) => candidate.role !== acc.role && candidate.password === password
      )

      if (alternativeAccount) {
        account = alternativeAccount
      }
    }
  }

  if (!account || account.password !== password) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
  }

  const resolvedAccount = account

  const accountIndex = current.accounts.findIndex(
    (candidate) =>
      candidate.email === resolvedAccount.email && candidate.role === resolvedAccount.role
  )

  if (accountIndex === -1) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 })
  }

  const role = resolvedAccount.role

  let nextAccounts = current.accounts
  let nextAthletes = current.athletes
  let athleteId = resolvedAccount.athleteId

  if (role === "athlete") {
    if (athleteId == null) {
      athleteId = getNextAthleteId(current.athletes)
      const inferredName = resolvedAccount.name || email.split("@")[0] || email
      const newAthlete = {
        id: athleteId,
        name: inferredName,
        email,
        sport: "",
        level: "",
        team: "",
        tags: [],
        sessions: [],
        calendar: [],
        workouts: [],
        hydrationLogs: [],
        mealLogs: [],
      }

      nextAthletes = [
        ...current.athletes.filter((athlete) => !athlete.isSeedData),
        newAthlete,
      ]
      nextAccounts = current.accounts.map((stored, index) =>
        index === accountIndex ? { ...stored, athleteId } : stored
      )
    } else {
      const existingAthlete = current.athletes.find((athlete) => athlete.id === athleteId)
      if (!existingAthlete) {
        const inferredName = resolvedAccount.name || email.split("@")[0] || email
        const newAthlete = {
          id: athleteId,
          name: inferredName,
          email,
          sport: "",
          level: "",
          team: "",
          tags: [],
          sessions: [],
          calendar: [],
          workouts: [],
          hydrationLogs: [],
          mealLogs: [],
        }
        nextAthletes = [
          ...current.athletes.filter((athlete) => athlete.id !== athleteId && !athlete.isSeedData),
          newAthlete,
        ]
      }
    }
  }

  if (nextAccounts !== current.accounts || nextAthletes !== current.athletes) {
    await writeLockerState({ accounts: nextAccounts, athletes: nextAthletes })
  }

  const token = createSessionToken(email, role)
  const user: UserAccount = {
    email,
    name: resolvedAccount.name,
    role,
    ...(athleteId ? { athleteId } : {}),
  }

  return NextResponse.json({ token, user, athletes: nextAthletes })
}
