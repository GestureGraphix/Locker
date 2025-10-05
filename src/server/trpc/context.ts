export interface AuthContext {
  userId: string
  role: "ATHLETE" | "COACH"
  teamId: string | null
}

export async function createTRPCContext(opts: { req: Request }) {
  const headers = opts.req.headers
  const userId = headers.get("x-locker-user-id")
  const role = (headers.get("x-locker-role") as AuthContext["role"]) ?? "ATHLETE"
  const teamId = headers.get("x-locker-team-id")

  if (!userId) {
    throw new Error("Unauthorized")
  }

  const auth: AuthContext = {
    userId,
    role,
    teamId: teamId || null,
  }

  return { auth }
}
