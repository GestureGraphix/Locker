import { NextResponse } from "next/server"

import type { UserAccount } from "@/lib/role-types"
import { createSessionToken } from "@/lib/server/auth-token"
import {
  getNextAthleteId,
  readLockerState,
  writeLockerState,
  type LockerPersistentState,
} from "@/lib/server/persistent-store"

const normalizeEmail = (email: unknown) =>
  typeof email === "string" ? email.trim().toLowerCase() : ""

const normalizeName = (name: unknown, email: string) => {
  if (typeof name === "string" && name.trim()) {
    return name.trim()
  }
  return email.split("@")[0] ?? email
}

const isValidPassword = (password: unknown) =>
  typeof password === "string" && password.length >= 8

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
    name?: unknown
  }

  const email = normalizeEmail(payload.email)
  const role = payload.role === "coach" ? "coach" : payload.role === "athlete" ? "athlete" : null
  const password = typeof payload.password === "string" ? payload.password : ""
  const name = normalizeName(payload.name, email)

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 })
  }

  if (!role) {
    return NextResponse.json({ error: "Role is required." }, { status: 400 })
  }

  if (!isValidPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long." },
      { status: 400 }
    )
  }

  const current = await readLockerState()
  const existing = current.accounts.find(
    (account) => account.email === email && account.role === role
  )

  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    )
  }

  let athleteId: number | undefined
  let nextAthletes: LockerPersistentState["athletes"] = current.athletes

  if (role === "athlete") {
    athleteId = getNextAthleteId(current.athletes)
    const newAthlete = {
      id: athleteId,
      name,
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
  }

  const newAccount = {
    email,
    name,
    role,
    password,
    athleteId,
  }

  const nextState: LockerPersistentState = {
    accounts: [...current.accounts, newAccount],
    athletes: nextAthletes,
  }

  await writeLockerState(nextState)

  const token = createSessionToken(email, role)
  const user: UserAccount = {
    email,
    name,
    role,
    ...(athleteId ? { athleteId } : {}),
  }

  return NextResponse.json(
    {
      token,
      user,
      athletes: nextState.athletes,
    },
    { status: 201 }
  )
}
