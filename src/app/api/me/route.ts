import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { SESSION_COOKIE_NAME, destroySession } from "@/lib/auth"
import prisma from "@/lib/prisma"

const toPublicUser = (user: { id: number; email: string; name: string | null; role: string }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
})

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const session = await prisma.sessionToken.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  })

  if (!session || session.expiresAt <= new Date()) {
    await destroySession()
    return NextResponse.json({ error: "Session expired." }, { status: 401 })
  }

  return NextResponse.json({ user: toPublicUser(session.user) })
}
