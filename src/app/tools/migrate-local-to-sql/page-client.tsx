"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type { StoredAccount } from "@/lib/role-types"
import { normalizeAccounts } from "@/lib/state-normalizer"

const STORAGE_KEY = "locker-app-state-v1"

type MigrationState = "idle" | "running" | "finished"

type MigrationResult = {
  key: string
  email: string
  role: StoredAccount["role"]
  name: string
  status: "pending" | "running" | "success" | "failed"
  message?: string
}

const toResultKey = (account: StoredAccount) => `${account.email}:${account.role}`

const formatRole = (role: StoredAccount["role"]) =>
  role === "coach" ? "Coach" : role === "athlete" ? "Athlete" : role

export function MigrateLocalToSqlClient() {
  const [accounts, setAccounts] = useState<StoredAccount[]>([])
  const [loadState, setLoadState] = useState<"loading" | "ready" | "empty" | "error">(
    "loading"
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [migrationState, setMigrationState] = useState<MigrationState>("idle")
  const [results, setResults] = useState<MigrationResult[]>([])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY)
      if (!storedValue) {
        setAccounts([])
        setLoadState("empty")
        return
      }

      const parsed = JSON.parse(storedValue) as { accounts?: unknown }
      const normalizedAccounts = normalizeAccounts(parsed.accounts)

      setAccounts(normalizedAccounts)
      setLoadState(normalizedAccounts.length > 0 ? "ready" : "empty")
    } catch (error) {
      console.error("Failed to read Locker local state", error)
      setLoadState("error")
      setLoadError(error instanceof Error ? error.message : "Unknown error")
    }
  }, [])

  const hasFailures = useMemo(
    () => results.some((result) => result.status === "failed"),
    [results]
  )

  const successfulCount = useMemo(
    () => results.filter((result) => result.status === "success").length,
    [results]
  )

  const failedCount = useMemo(
    () => results.filter((result) => result.status === "failed").length,
    [results]
  )

  const startMigration = useCallback(async () => {
    if (migrationState === "running" || accounts.length === 0) {
      return
    }

    setMigrationState("running")
    setResults(
      accounts.map((account) => ({
        key: toResultKey(account),
        email: account.email,
        role: account.role,
        name: account.name,
        status: "pending",
      }))
    )

    for (const account of accounts) {
      const key = toResultKey(account)

      setResults((prev) =>
        prev.map((result) =>
          result.key === key
            ? { ...result, status: "running", message: undefined }
            : result
        )
      )

      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: account.email,
            password: account.password,
            name: account.name,
            role: account.role.toUpperCase(),
          }),
          credentials: "include",
        })

        let responseText = ""
        try {
          responseText = await response.text()
        } catch (error) {
          console.error("Failed to read registration response", error)
        }

        let parsed: unknown = null
        if (responseText) {
          try {
            parsed = JSON.parse(responseText) as unknown
          } catch {
            parsed = null
          }
        }

        if (response.ok) {
          const message =
            parsed &&
            typeof parsed === "object" &&
            parsed !== null &&
            "user" in parsed &&
            parsed.user &&
            typeof (parsed as { user?: { email?: string } }).user?.email === "string"
              ? `Migrated as ${(parsed as { user?: { email?: string } }).user?.email}`
              : "Account migrated."

          setResults((prev) =>
            prev.map((result) =>
              result.key === key
                ? {
                    ...result,
                    status: "success",
                    message,
                  }
                : result
            )
          )
        } else {
          const errorMessage = (() => {
            if (
              parsed &&
              typeof parsed === "object" &&
              parsed !== null &&
              "error" in parsed &&
              typeof (parsed as { error?: unknown }).error === "string"
            ) {
              return (parsed as { error: string }).error
            }
            if (responseText) {
              return responseText
            }
            return `Request failed with status ${response.status}`
          })()

          console.error("Failed to migrate account", {
            email: account.email,
            role: account.role,
            status: response.status,
            error: errorMessage,
          })

          setResults((prev) =>
            prev.map((result) =>
              result.key === key
                ? {
                    ...result,
                    status: "failed",
                    message: errorMessage,
                  }
                : result
            )
          )
        }
      } catch (error) {
        console.error("Unexpected error migrating account", {
          email: account.email,
          role: account.role,
          error,
        })

        setResults((prev) =>
          prev.map((result) =>
            result.key === key
              ? {
                  ...result,
                  status: "failed",
                  message:
                    error instanceof Error
                      ? error.message
                      : "Unknown error during migration.",
                }
              : result
          )
        )
      }
    }

    setMigrationState("finished")
  }, [accounts, migrationState])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Local account migration</h1>
        <p className="text-muted-foreground">
          This dev-only tool reads accounts from <code>{STORAGE_KEY}</code> in local
          storage and replays them against the SQL-backed registration endpoint.
        </p>
        <p className="text-sm text-muted-foreground">
          Use this when switching from localStorage auth to SQL auth during
          development. Check the console for detailed logs.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Discovered accounts</h2>
        {loadState === "loading" && <p>Loading accounts from localStorage…</p>}
        {loadState === "error" && (
          <p className="text-destructive">
            Failed to load accounts: {loadError ?? "Unknown error"}
          </p>
        )}
        {loadState === "empty" && <p>No stored accounts were found.</p>}
        {loadState === "ready" && (
          <ul className="space-y-2">
            {accounts.map((account) => (
              <li
                key={toResultKey(account)}
                className="rounded-md border border-border p-3"
              >
                <div className="font-medium">{account.email}</div>
                <div className="text-sm text-muted-foreground">
                  {formatRole(account.role)} · Password length {account.password.length}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <button
          type="button"
          onClick={startMigration}
          disabled={
            migrationState === "running" ||
            loadState !== "ready" ||
            accounts.length === 0
          }
          className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {migrationState === "running" ? "Migrating…" : "Start migration"}
        </button>

        {results.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {`Migration ${
                migrationState === "running" ? "in progress" : "complete"
              }. ${successfulCount} succeeded, ${failedCount} failed.`}
            </div>
            <ul className="space-y-2">
              {results.map((result) => (
                <li
                  key={result.key}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{result.email}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatRole(result.role)}
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        result.status === "success"
                          ? "text-emerald-600"
                          : result.status === "failed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {result.status === "success" && "Success"}
                      {result.status === "failed" && "Failed"}
                      {result.status === "running" && "Running"}
                      {result.status === "pending" && "Pending"}
                    </span>
                  </div>
                  {result.message && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {result.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-md border border-dashed border-border p-4">
        <h2 className="text-lg font-medium">Clean up local storage</h2>
        <p className="text-sm text-muted-foreground">
          Once all accounts have been migrated, remove the legacy state to avoid
          confusion:
        </p>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-sm">
          <code>{`localStorage.removeItem("${STORAGE_KEY}")`}</code>
        </pre>
        {hasFailures && (
          <p className="text-sm text-destructive">
            One or more accounts failed to migrate. Review the console logs above
            before clearing local storage.
          </p>
        )}
      </section>
    </main>
  )
}
