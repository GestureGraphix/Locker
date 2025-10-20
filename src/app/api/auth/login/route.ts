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
  const role = payload.role === "coach" ? "coach" : payload.role === "athlete" ? "athlete" : null
  const password = typeof payload.password === "string" ? payload.password : ""

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 })
  }

  if (!role) {
    return NextResponse.json({ error: "Role is required." }, { status: 400 })
  }

  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 })
  }

  const current = await readLockerState()
  const accountIndex = current.accounts.findIndex(
    (account) => account.email === email && account.role === role
  )

  if (accountIndex === -1) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 })
  }

  const account = current.accounts[accountIndex]

  if (account.password !== password) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
  }

  let nextAccounts = current.accounts
  let nextAthletes = current.athletes
  let athleteId = account.athleteId

  if (role === "athlete") {
    if (athleteId == null) {
      athleteId = getNextAthleteId(current.athletes)
      const inferredName = account.name || email.split("@")[0] || email
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
        const inferredName = account.name || email.split("@")[0] || email
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
    name: account.name,
    role,
    ...(athleteId ? { athleteId } : {}),
  }

  return NextResponse.json({ token, user, athletes: nextAthletes })
}
