import NextAuth from "next-auth"

import { authConfig } from "./auth.config"

declare module "next-auth" {
  interface Session {
    user?: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: import("@prisma/client").Role
      teamId?: string | null
    }
  }

  interface User {
    role: import("@prisma/client").Role
    teamId: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: import("@prisma/client").Role
    teamId?: string | null
  }
}

export const { auth, handlers: { GET, POST }, signIn, signOut } = NextAuth(authConfig)
