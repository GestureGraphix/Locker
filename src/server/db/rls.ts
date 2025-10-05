import type { Prisma, PrismaClient } from "@prisma/client"

import { prisma } from "./client"

type Role = "ATHLETE" | "COACH"

export interface RlsContext {
  userId: string
  role: Role
  teamId: string | null
}

export async function withRls<T>(auth: RlsContext, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', $1, true)`, auth.userId)
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_role', $1, true)`, auth.role)
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_team_id', $1, true)`, auth.teamId ?? "")

    const result = await fn(tx)

    await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', '', true)`)
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_role', '', true)`)
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_team_id', '', true)`)

    return result
  })
}

export async function withSystemAccess<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_role', 'COACH', true)`)
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', '', true)`)
    const result = await fn(tx)
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_role', '', true)`)
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', '', true)`)
    return result
  })
}
