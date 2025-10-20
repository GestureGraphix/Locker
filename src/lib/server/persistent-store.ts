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

const DEFAULT_BLOB_URL = "https://blob.vercel-storage.com"
const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim() || ""
const blobBaseUrl = (process.env.BLOB_READ_WRITE_URL?.trim() || DEFAULT_BLOB_URL).replace(/\/$/, "")
const blobKey = process.env.LOCKER_BLOB_KEY?.trim() || DATA_FILE_NAME
const fetchFn: typeof fetch | null = typeof fetch === "function" ? fetch : null
const isBlobEnabled = Boolean(blobToken && fetchFn)

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
  if (isBlobEnabled) {
    return
  }
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

const normalizeState = (state: Partial<LockerPersistentState> | null | undefined) => {
  const accounts = normalizeAccounts(state?.accounts ?? [])
  const athletes = normalizeAthletes(state?.athletes ?? [])
  return { accounts, athletes }
}

const readFromFile = async (): Promise<LockerPersistentState> => {
  await ensureDataFile()
  try {
    const { file } = await resolveDataPaths()
    const raw = await fs.readFile(file, "utf8")
    const parsed = JSON.parse(raw) as Partial<LockerPersistentState>
    return normalizeState(parsed)
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

const writeToFile = async (state: LockerPersistentState) => {
  await ensureDataFile()
  const { file } = await resolveDataPaths()
  await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8")
}

const getBlobEndpoint = () => {
  const normalizedKey = blobKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${blobBaseUrl}/${normalizedKey}`
}

const readFromBlob = async (): Promise<LockerPersistentState | null> => {
  if (!isBlobEnabled) return null
  try {
    const response = await fetchFn!(getBlobEndpoint(), {
      method: "GET",
      headers: { Authorization: `Bearer ${blobToken}` },
      cache: "no-store",
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error(`Failed to read Locker blob state: ${response.status}`)
    }

    const raw = await response.text()
    const parsed = JSON.parse(raw) as Partial<LockerPersistentState>
    return normalizeState(parsed)
  } catch (error) {
    console.error("Failed to read Locker blob state", error)
    return null
  }
}

const writeToBlob = async (state: LockerPersistentState): Promise<boolean> => {
  if (!isBlobEnabled) return false
  const payload = JSON.stringify(state, null, 2)
  const response = await fetchFn!(getBlobEndpoint(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${blobToken}`,
      "Content-Type": "application/json",
    },
    body: payload,
  })

  if (!response.ok) {
    throw new Error(`Failed to write Locker blob state: ${response.status}`)
  }

  return true
}

export const readLockerState = async (): Promise<LockerPersistentState> => {
  if (isBlobEnabled) {
    const blobState = await readFromBlob()
    if (blobState) {
      return blobState
    }
  }

  const fileState = await readFromFile()

  if (isBlobEnabled) {
    try {
      await writeToBlob(fileState)
    } catch (error) {
      console.error("Failed to seed Locker blob state", error)
    }
  }

  return fileState
}

export const writeLockerState = async (state: LockerPersistentState) => {
  const payload: LockerPersistentState = {
    accounts: state.accounts.map((account) => ({ ...account })),
    athletes: state.athletes.map((athlete) => ({ ...athlete })),
  }

  if (isBlobEnabled) {
    try {
      const wrote = await writeToBlob(payload)
      if (wrote) {
        return
      }
    } catch (error) {
      console.error("Failed to write Locker blob state", error)
    }
  }

  await writeToFile(payload)
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
