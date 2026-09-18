import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { dayPlans, mockResults, profiles, progressLogs, users } from "@/db/schema";
import { addDays, istNow } from "./cat";
import { computeStats, projectPercentile, skipImpact, sumLogs } from "./progress";

export async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/");
  return { id, name: session.user?.name ?? "", email: session.user?.email ?? "", image: session.user?.image ?? null };
}

export async function requireProfile() {
  const user = await requireUser();
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
  if (!profile?.onboarded) redirect("/onboarding");
  return { user, profile };
}

export async function loadUserState(userId: string, now = new Date()) {
  const { date: today, hour } = istNow(now);
  const [profile, plans, logs, mocks, user] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
    db.select().from(dayPlans).where(eq(dayPlans.userId, userId)).orderBy(asc(dayPlans.date)),
    db
      .select({ date: progressLogs.date, section: progressLogs.section, count: progressLogs.count })
      .from(progressLogs)
      .where(and(eq(progressLogs.userId, userId), gte(progressLogs.date, addDays(today, -120)))),
    db.select().from(mockResults).where(eq(mockResults.userId, userId)).orderBy(asc(mockResults.date)),
    db.query.users.findFirst({ where: eq(users.id, userId) }),
  ]);
  if (!profile) return null;
  const doneByDate = sumLogs(logs);
  const stats = computeStats({
    plans,
    doneByDate,
    today,
    hour,
    window: { start: profile.studyStartHour, end: profile.studyEndHour },
  });
  const mockPoints = mocks.map((m) => ({ date: m.date, percentile: m.percentile }));
  const projection = projectPercentile(mockPoints, today, stats.consistency);
  const impact = skipImpact(stats, mockPoints, today);
  const todayPlan = plans.find((p) => p.date === today) ?? null;
  const tomorrowPlan = plans.find((p) => p.date === addDays(today, 1)) ?? null;
  const nextMock = plans.find((p) => p.date >= today && p.type === "mock") ?? null;
  return {
    today, hour, profile, plans, mocks, stats, projection, impact, todayPlan, tomorrowPlan, nextMock,
    todayDone: doneByDate[today] ?? { qa: 0, rc: 0, va: 0, dilr: 0 },
    firstName: (user?.name ?? "").split(" ")[0] || "there",
  };
}

export type UserState = NonNullable<Awaited<ReturnType<typeof loadUserState>>>;
