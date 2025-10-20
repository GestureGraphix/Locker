import { promises as fs } from "fs"
import path from "path"

import { initialAthletes } from "@/lib/initial-data"
import type { Athlete, StoredAccount } from "@/lib/role-types"
import { normalizeAccounts, normalizeAthletes } from "@/lib/state-normalizer"

export type LockerPersistentState = {
  accounts: StoredAccount[]
  athletes: Athlete[]
}

const clone = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T

const DATA_DIR = path.join(process.cwd(), "data")
const DATA_FILE = path.join(DATA_DIR, "locker-store.json")

const ensureDataFile = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try {
    await fs.access(DATA_FILE)
  } catch {
    const initialState: LockerPersistentState = {
      accounts: [],
      athletes: clone(initialAthletes),
    }
    await fs.writeFile(DATA_FILE, JSON.stringify(initialState, null, 2), "utf8")
  }
}

export const readLockerState = async (): Promise<LockerPersistentState> => {
  await ensureDataFile()
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8")
    const parsed = JSON.parse(raw) as Partial<LockerPersistentState>
    const accounts = normalizeAccounts(parsed?.accounts ?? [])
    const athletes = normalizeAthletes(parsed?.athletes ?? [])
    return { accounts, athletes }
  } catch {
    const fallback: LockerPersistentState = {
      accounts: [],
      athletes: clone(initialAthletes),
    }
    await fs.writeFile(DATA_FILE, JSON.stringify(fallback, null, 2), "utf8")
    return fallback
  }
}

export const writeLockerState = async (state: LockerPersistentState) => {
  await ensureDataFile()
  const payload: LockerPersistentState = {
    accounts: state.accounts.map((account) => ({ ...account })),
    athletes: state.athletes.map((athlete) => ({ ...athlete })),
  }
  await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), "utf8")
}

export const withLockerState = async (
  updater: (state: LockerPersistentState) => LockerPersistentState
): Promise<LockerPersistentState> => {
  const current = await readLockerState()
  const next = updater(current)
  await writeLockerState(next)
  return next
}

export const getNextAthleteId = (athletes: Athlete[]) => {
  const maxId = athletes.reduce((max, athlete) => Math.max(max, athlete.id), 0)
  const candidate = maxId + 1
  return candidate > 0 ? candidate : Date.now()
}
