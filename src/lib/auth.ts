import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'

import prisma from './prisma'

const SALT_ROUNDS = 12
export const SESSION_COOKIE_NAME = 'session_token'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

export const createSession = async (userId: number): Promise<void> => {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)

  await prisma.sessionToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  })
}

export const destroySession = async (): Promise<void> => {
  const cookieStore = await cookies()
  const existingToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (existingToken) {
    await prisma.sessionToken.deleteMany({
      where: { token: existingToken },
    })
  }

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })
}
