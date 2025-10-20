import { NextResponse } from "next/server"

import type { UserAccount } from "@/lib/role-types"
import { verifySessionToken } from "@/lib/server/auth-token"
import {
  getNextAthleteId,
  readLockerState,
  writeLockerState,
} from "@/lib/server/persistent-store"

const extractToken = (headerValue: string | null) => {
  if (!headerValue) return null
  const [scheme, token] = headerValue.split(" ")
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null
  return token.trim()
}

export async function GET(request: Request) {
  const token = extractToken(request.headers.get("authorization"))
  const claims = verifySessionToken(token)

  if (!claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const current = await readLockerState()
  const accountIndex = current.accounts.findIndex(
    (account) => account.email === claims.email && account.role === claims.role
  )

  if (accountIndex === -1) {
    return NextResponse.json({ error: "Session no longer valid" }, { status: 401 })
  }

  const account = current.accounts[accountIndex]
  let nextAccounts = current.accounts
  let nextAthletes = current.athletes
  let athleteId = account.athleteId

  if (account.role === "athlete") {
    if (athleteId == null) {
      athleteId = getNextAthleteId(current.athletes)
      const inferredName = account.name || account.email.split("@")[0] || account.email
      const newAthlete = {
        id: athleteId,
        name: inferredName,
        email: account.email,
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
        const inferredName = account.name || account.email.split("@")[0] || account.email
        const newAthlete = {
          id: athleteId,
          name: inferredName,
          email: account.email,
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

  const user: UserAccount = {
    email: account.email,
    name: account.name,
    role: account.role,
    ...(athleteId ? { athleteId } : {}),
  }

  return NextResponse.json({ user, athletes: nextAthletes })
}
