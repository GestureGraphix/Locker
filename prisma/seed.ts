import { Role } from "@prisma/client"

import { prisma } from "@/server/db/client"

const TEAM_ID = "11111111-1111-1111-1111-111111111111"

async function main() {
  const team = await prisma.team.upsert({
    where: { id: TEAM_ID },
    update: { name: "Locker Demo Team" },
    create: {
      id: TEAM_ID,
      name: "Locker Demo Team",
    },
  })

  const coach = await prisma.user.upsert({
    where: { email: "coach@locker.app" },
    update: {
      name: "Coach Casey",
      role: Role.COACH,
      teamId: team.id,
    },
    create: {
      email: "coach@locker.app",
      name: "Coach Casey",
      role: Role.COACH,
      teamId: team.id,
    },
  })

  const athleteSeeds = [
    { email: "athlete1@locker.app", name: "Alex Runner" },
    { email: "athlete2@locker.app", name: "Bree Swimmer" },
    { email: "athlete3@locker.app", name: "Cam Thrower" },
  ]

  await Promise.all(
    athleteSeeds.map(seed =>
      prisma.user.upsert({
        where: { email: seed.email },
        update: {
          name: seed.name,
          role: Role.ATHLETE,
          teamId: team.id,
        },
        create: {
          email: seed.email,
          name: seed.name,
          role: Role.ATHLETE,
          teamId: team.id,
        },
      }),
    ),
  )

  await prisma.$executeRawUnsafe(`ALTER TABLE "CalendarEvent" ENABLE ROW LEVEL SECURITY`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "GoogleCalendarToken" ENABLE ROW LEVEL SECURITY`)

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'calendar_events_rls') THEN
        CREATE POLICY "calendar_events_rls" ON "CalendarEvent"
          USING (
            "userId" = current_setting('app.current_user_id', true)
            OR current_setting('app.current_role', true) = 'COACH'
          );
      END IF;
    END $$;
  `)

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'calendar_tokens_rls') THEN
        CREATE POLICY "calendar_tokens_rls" ON "GoogleCalendarToken"
          USING (
            "userId" = current_setting('app.current_user_id', true)
            OR current_setting('app.current_role', true) = 'COACH'
          );
      END IF;
    END $$;
  `)

  console.log("Seed complete", { coach: coach.email, athletes: athleteSeeds.length })
}

main()
  .then(() => prisma.$disconnect())
  .catch(error => {
    console.error(error)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
