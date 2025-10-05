import { initTRPC } from "@trpc/server"
import superjson from "superjson"

import type { AuthContext } from "./context"

const t = initTRPC.context<{ auth: AuthContext }>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape
  },
})

const isCoach = t.middleware(({ ctx, next }) => {
  if (ctx.auth.role !== "COACH") {
    throw new Error("Forbidden")
  }

  return next()
})

const isAthlete = t.middleware(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new Error("Unauthorized")
  }

  return next()
})

export const router = t.router
export const publicProcedure = t.procedure
export const athleteProcedure = t.procedure.use(isAthlete)
export const coachProcedure = t.procedure.use(isCoach)
