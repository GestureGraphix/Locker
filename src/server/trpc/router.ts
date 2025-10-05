import { z } from "zod"

import { prisma } from "@/server/db/client"
import { listHydratedEvents } from "@/server/services/google-calendar"
import { router, athleteProcedure, coachProcedure } from "./trpc"

export const appRouter = router({
  calendar: router({
    list: athleteProcedure.query(async ({ ctx }) => {
      return listHydratedEvents(ctx.auth)
    }),
  }),
  coach: router({
    teamHydration: coachProcedure
      .input(z.object({ teamId: z.string().uuid().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const teamId = input?.teamId ?? ctx.auth.teamId

        if (!teamId) {
          throw new Error("Coach must belong to a team to view hydration stats")
        }

        const hydration = await prisma.user.findMany({
          where: {
            teamId,
            role: "ATHLETE",
          },
          select: {
            id: true,
            name: true,
            hydrationScore: true,
          },
        })

        return hydration.map(player => ({
          id: player.id,
          name: player.name,
          hydrationScore: player.hydrationScore ?? 0,
        }))
      }),
  }),
})

export type AppRouter = typeof appRouter
