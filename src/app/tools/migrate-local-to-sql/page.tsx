import { notFound } from "next/navigation"

import { MigrateLocalToSqlClient } from "./page-client"

export const dynamic = "force-dynamic"

export default function MigrateLocalToSqlPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound()
  }

  return <MigrateLocalToSqlClient />
}
