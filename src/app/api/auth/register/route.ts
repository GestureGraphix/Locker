import { NextRequest, NextResponse } from "next/server"

import { Prisma } from "@prisma/client"
import { createSession, hashPassword } from "@/lib/auth"
import prisma from "@/lib/prisma"

const VALID_ROLES = ["ATHLETE", "COACH"] as const
type AllowedRole = (typeof VALID_ROLES)[number]

type RegisterBody = {
  email?: unknown
  password?: unknown
  name?: unknown
  role?: unknown
}

type NormalizedRegisterBody = {
  email: string
  password: string
  name: string | null
  role: AllowedRole
}

const normalizeRegisterBody = (body: RegisterBody): NormalizedRegisterBody | null => {
  if (!body || typeof body !== "object") {
    return null
  }

  const { email, password, name, role } = body

  if (typeof email !== "string" || !email.trim()) {
    return null
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return null
  }

  if (typeof password !== "string" || password.length < 8) {
    return null
  }

  if (name != null && typeof name !== "string") {
    return null
  }

  const providedRole = role == null ? "ATHLETE" : role
  if (typeof providedRole !== "string") {
    return null
  }

  const normalizedRole = providedRole.toUpperCase()
  if (!VALID_ROLES.includes(normalizedRole as AllowedRole)) {
    return null
  }

  return {
    email: normalizedEmail,
    password,
    name: name == null ? null : name.trim() || null,
    role: normalizedRole as AllowedRole,
  }
}

const toPublicUser = (user: { id: number; email: string; name: string | null; role: string }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
})

export async function POST(request: NextRequest) {
  let body: RegisterBody

  try {
    body = (await request.json()) as RegisterBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const normalized = normalizeRegisterBody(body)
  if (!normalized) {
    return NextResponse.json({ error: "Invalid registration details." }, { status: 400 })
  }

  const { email, password, name, role } = normalized

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        passwordCredential: {
          create: {
            passwordHash,
          },
        },
        athleteProfile:
          role === "ATHLETE"
            ? {
                create: {},
              }
            : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    await createSession(user.id)

    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      )
    }

    console.error("Failed to register user", error)
    return NextResponse.json({ error: "Unable to register user." }, { status: 500 })
  }
}
