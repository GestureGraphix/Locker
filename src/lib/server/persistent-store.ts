import { promises as fs, constants as fsConstants } from "fs"
import os from "os"
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

const DATA_FILE_NAME = "locker-store.json"

type DataPaths = { dir: string; file: string }

let resolvedDataPathsPromise: Promise<DataPaths> | null = null

const resolveDataPaths = async (): Promise<DataPaths> => {
  if (!resolvedDataPathsPromise) {
    resolvedDataPathsPromise = (async () => {
      const candidateDirs: string[] = []
      const configuredDir = process.env.LOCKER_DATA_DIR?.trim()
      if (configuredDir) {
        candidateDirs.push(configuredDir)
      }
      candidateDirs.push(path.join(process.cwd(), "data"))
      candidateDirs.push(path.join(os.tmpdir(), "locker-data"))

      for (const candidate of candidateDirs) {
        const dir = path.resolve(candidate)
        try {
          await fs.mkdir(dir, { recursive: true })
          await fs.access(dir, fsConstants.W_OK)
          return { dir, file: path.join(dir, DATA_FILE_NAME) }
        } catch {
          // Try the next candidate directory
        }
      }

      throw new Error("Unable to resolve writable data directory for Locker state")
    })()
  }

  return resolvedDataPathsPromise
}

const ensureDataFile = async () => {
  const { file } = await resolveDataPaths()
  try {
    await fs.access(file)
  } catch {
    const initialState: LockerPersistentState = {
      accounts: [],
      athletes: clone(initialAthletes),
    }
    await fs.writeFile(file, JSON.stringify(initialState, null, 2), "utf8")
  }
}

export const readLockerState = async (): Promise<LockerPersistentState> => {
  await ensureDataFile()
  try {
    const { file } = await resolveDataPaths()
    const raw = await fs.readFile(file, "utf8")
    const parsed = JSON.parse(raw) as Partial<LockerPersistentState>
    const accounts = normalizeAccounts(parsed?.accounts ?? [])
    const athletes = normalizeAthletes(parsed?.athletes ?? [])
    return { accounts, athletes }
  } catch {
    const fallback: LockerPersistentState = {
      accounts: [],
      athletes: clone(initialAthletes),
    }
    const { file } = await resolveDataPaths()
    await fs.writeFile(file, JSON.stringify(fallback, null, 2), "utf8")
    return fallback
  }
}

export const writeLockerState = async (state: LockerPersistentState) => {
  await ensureDataFile()
  const { file } = await resolveDataPaths()
  const payload: LockerPersistentState = {
    accounts: state.accounts.map((account) => ({ ...account })),
    athletes: state.athletes.map((athlete) => ({ ...athlete })),
  }
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8")
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
