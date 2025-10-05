import Google from "next-auth/providers/google"
import type { NextAuthConfig } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"

import { prisma } from "@/server/db/client"
import { persistGoogleTokens } from "@/server/services/google-calendar"

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  providers: [
    Google({
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        session.user.role = user.role
        session.user.teamId = user.teamId
      }
      return session
    },
  },
  events: {
    async linkAccount({ user, account }) {
      if (account.provider === "google") {
        await persistGoogleTokens({
          userId: user.id,
          accessToken: account.access_token ?? undefined,
          refreshToken: account.refresh_token ?? undefined,
          expiresAt: account.expires_at ?? undefined,
        })
      }
    },
  },
}
