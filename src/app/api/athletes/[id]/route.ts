// app/api/athletes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

// --- helpers ---------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseId(s: string): number | null {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const hasOwn = (o: Record<string, unknown>, k: string) =>
  Object.prototype.hasOwnProperty.call(o, k);

function sanitizeOptionalString(
  rec: Record<string, unknown>,
  key: string
):
  | { present: false }
  | { present: true; value: string | null }
  | { present: true; error: string } {
  if (!hasOwn(rec, key)) return { present: false };
  const raw = rec[key];
  if (raw == null) return { present: true, value: null };
  if (typeof raw !== "string") return { present: true, error: `Invalid ${key}.` };
  const t = raw.trim();
  return { present: true, value: t.length ? t : null };
}

function sanitizeEmail(
  rec: Record<string, unknown>,
  key: string
):
  | { present: false }
  | { present: true; value: string }
  | { present: true; error: string } {
  if (!hasOwn(rec, key)) return { present: false };
  const raw = rec[key];
  if (typeof raw !== "string" || !raw.trim()) {
    return { present: true, error: "Email is required." };
  }
  const e = raw.trim().toLowerCase();
  if (!EMAIL_REGEX.test(e)) {
    return { present: true, error: "Invalid email address." };
  }
  return { present: true, value: e };
}

// normalize payload (only user.name / user.email to keep it simple & safe)
function normalizeUpdatePayload(
  payload: unknown
):
  | { ok: true; value: { user: { name?: string | null; email?: string } } }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid request payload." };
  }

  const rec = payload as Record<string, unknown>;
  const out: { user: { name?: string | null; email?: string } } = { user: {} };

  const name = sanitizeOptionalString(rec, "name");
  if (name.present) {
    if ("error" in name) return { ok: false, error: name.error };
    out.user.name = name.value;
  }

  const email = sanitizeEmail(rec, "email");
  if (email.present) {
    if ("error" in email) return { ok: false, error: email.error };
    out.user.email = email.value;
  }

  if (!("name" in out.user) && !("email" in out.user)) {
    return { ok: false, error: "No valid fields provided." };
  }

  return { ok: true, value: out };
}

// Tie types to the exact query (only relations in include; scalars are always present)
const findArgs = (userId: number) =>
  ({
    where: { userId },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  }) satisfies Prisma.AthleteProfileFindUniqueArgs;

type AthleteWithUser = Prisma.AthleteProfileGetPayload<ReturnType<typeof findArgs>>;

function toResponse(p: AthleteWithUser) {
  return {
    id: p.user.id,
    email: p.user.email,
    name: p.user.name,
    role: p.user.role,
    // keep the profile minimal here to avoid schema/type drift
    profile: {
      id: p.id,
      userId: p.userId,
    },
  };
}

async function ensureAuthorized(athleteId: number) {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  // Compare as string to avoid enum/type mismatches from session typing
  if (String(user.role) === "ATHLETE" && user.id !== athleteId) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { ok: true as const, user };
}

// --- route handlers (Next.js 15: params is a Promise) ----------------------

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const athleteId = parseId(id);
  if (!athleteId) {
    return NextResponse.json({ error: "Invalid athlete id." }, { status: 400 });
  }

  const auth = await ensureAuthorized(athleteId);
  if (!auth.ok) return auth.res;

  const profile = await prisma.athleteProfile.findUnique(findArgs(athleteId));
  if (!profile) {
    return NextResponse.json({ error: "Athlete not found." }, { status: 404 });
  }

  return NextResponse.json({ athlete: toResponse(profile) });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const athleteId = parseId(id);
  if (!athleteId) {
    return NextResponse.json({ error: "Invalid athlete id." }, { status: 400 });
  }

  const auth = await ensureAuthorized(athleteId);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const normalized = normalizeUpdatePayload(body);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  try {
    const updated = await prisma.athleteProfile.update({
      where: { userId: athleteId },
      data: {
        user:
          Object.keys(normalized.value.user).length > 0
            ? { update: normalized.value.user }
            : undefined,
      },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });

    return NextResponse.json({ athlete: toResponse(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Email already in use." }, { status: 409 });
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Athlete not found." }, { status: 404 });
      }
    }
    console.error("Failed to update athlete profile", error);
    return NextResponse.json({ error: "Unable to update athlete." }, { status: 500 });
  }
}
