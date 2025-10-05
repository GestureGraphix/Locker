import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { auth } from "./src/auth"

export default auth(async function middleware(req: NextRequest) {
  const session = req.auth
  const url = req.nextUrl

  if (!session?.user?.id) {
    if (url.pathname === "/api/calendar/webhook") {
      return NextResponse.next()
    }

    if (url.pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const signInUrl = new URL("/api/auth/signin", req.url)
    signInUrl.searchParams.set("callbackUrl", req.url)
    return NextResponse.redirect(signInUrl)
  }

  if (url.pathname.startsWith("/coach") && session.user.role !== "COACH") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-locker-user-id", session.user.id)
  requestHeaders.set("x-locker-role", session.user.role ?? "ATHLETE")
  requestHeaders.set("x-locker-team-id", session.user.teamId ?? "")

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
})

export const config = {
  matcher: ["/coach/:path*", "/api/:path*", "/account/:path*"],
}
