import crypto from "crypto"

import type { Role } from "@/lib/role-types"

type SessionClaims = {
  email: string
  role: Role
  iat: number
  exp: number
}

const base64UrlEncode = (input: Buffer | string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

const base64UrlDecode = (input: string) =>
  Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64")

const JWT_HEADER = base64UrlEncode(
  JSON.stringify({ alg: "HS256", typ: "JWT" })
)

const getSecret = () =>
  process.env.LOCKER_AUTH_SECRET ?? "locker-development-secret"

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

const sign = (unsignedToken: string) =>
  crypto.createHmac("sha256", getSecret()).update(unsignedToken).digest()

export const createSessionToken = (email: string, role: Role) => {
  const issuedAt = Date.now()
  const claims: SessionClaims = {
    email,
    role,
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_MS,
  }

  const payload = base64UrlEncode(JSON.stringify(claims))
  const unsignedToken = `${JWT_HEADER}.${payload}`
  const signature = base64UrlEncode(sign(unsignedToken))
  return `${unsignedToken}.${signature}`
}

export const verifySessionToken = (token: string | null | undefined): SessionClaims | null => {
  if (!token || typeof token !== "string") {
    return null
  }

  const parts = token.split(".")
  if (parts.length !== 3) {
    return null
  }

  const [header, payload, providedSignature] = parts
  if (header !== JWT_HEADER) {
    return null
  }

  const unsignedToken = `${header}.${payload}`
  const expectedDigest = sign(unsignedToken)
  let providedDigest: Buffer
  try {
    providedDigest = base64UrlDecode(providedSignature)
  } catch {
    return null
  }

  if (
    expectedDigest.length !== providedDigest.length ||
    !crypto.timingSafeEqual(expectedDigest, providedDigest)
  ) {
    return null
  }

  let claims: SessionClaims
  try {
    const decoded = base64UrlDecode(payload).toString("utf8")
    claims = JSON.parse(decoded) as SessionClaims
  } catch {
    return null
  }

  if (!claims || typeof claims !== "object") {
    return null
  }

  if (typeof claims.email !== "string" || typeof claims.role !== "string") {
    return null
  }

  if (typeof claims.exp !== "number" || typeof claims.iat !== "number") {
    return null
  }

  if (Date.now() >= claims.exp) {
    return null
  }

  return claims
}

export type { SessionClaims }
