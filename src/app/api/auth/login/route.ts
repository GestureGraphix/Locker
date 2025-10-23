import { NextRequest, NextResponse } from "next/server"

import { createSession, verifyPassword } from "@/lib/auth"
import prisma from "@/lib/prisma"

const toPublicUser = (user: { id: number; email: string; name: string | null; role: string }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
})

type LoginBody = {
  email?: unknown
  password?: unknown
}

const normalizeLoginBody = (body: LoginBody): { email: string; password: string } | null => {
  if (!body || typeof body !== "object") {
    return null
  }

  const { email, password } = body

  if (typeof email !== "string" || !email.trim()) {
    return null
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return null
  }

  if (typeof password !== "string" || password.length === 0) {
    return null
  }

  return { email: normalizedEmail, password }
}

export async function POST(request: NextRequest) {
  let body: LoginBody
  try {
    body = (await request.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const normalized = normalizeLoginBody(body)
  if (!normalized) {
    return NextResponse.json({ error: "Invalid login credentials." }, { status: 400 })
  }

  const { email, password } = normalized

  const user = await prisma.user.findUnique({
    where: { email },
    include: { passwordCredential: true },
  })

  if (!user || !user.passwordCredential) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
  }

  const isValid = await verifyPassword(password, user.passwordCredential.passwordHash)
  if (!isValid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
  }

  await createSession(user.id)

  return NextResponse.json({ user: toPublicUser(user) })
}
