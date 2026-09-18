import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as S from "@/db/schema";
import { generatePlan } from "./plan-generator";
import { SYSTEM_TEMPLATES } from "./templates";
import { addDays, istNow } from "./cat";

// Local demo data: backfills ~3 weeks of history + mocks for a user and adds 3 demo friends.
// Only reachable through /api/dev/seed in development.
export async function seedDemo(email: string) {
  const today = istNow().date;
  const start = addDays(today, -21);
  const tpl = SYSTEM_TEMPLATES[0];

  // Deterministic pseudo-random
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  async function fillHistory(userId: string, quality: number, mockBase: number) {
    const past = generatePlan({ start, template: tpl }).filter((d) => d.date < today);
    await db.delete(S.dayPlans).where(eq(S.dayPlans.userId, userId));
    const full = generatePlan({ start, template: tpl });
    await db.insert(S.dayPlans).values(full.map((d) => ({ ...d, userId, mockName: d.mockName, mockDone: d.type === "mock" && d.date < today, analysisDone: d.type === "mock" && d.date < today && rnd() < quality })));
    await db.delete(S.progressLogs).where(eq(S.progressLogs.userId, userId));
    await db.delete(S.mockResults).where(eq(S.mockResults.userId, userId));
    const logs: (typeof S.progressLogs.$inferInsert)[] = [];
    let m = 0;
    for (const d of past) {
      const r = rnd();
      const f = r < 1 - quality - 0.1 ? 0 : Math.min(1.2, quality + (rnd() - 0.4) * 0.5);
      for (const k of ["qa", "rc", "va", "dilr"] as const) {
        const n = Math.round(d.targets[k] * f);
        if (n > 0) logs.push({ userId, date: d.date, section: k, count: n });
      }
      if (d.type === "mock") {
        m++;
        await db.insert(S.mockResults).values({ userId, date: d.date, name: d.mockName ?? `Mock ${m}`, percentile: Math.min(99.5, +(mockBase + m * 1.6 + (rnd() - 0.5) * 3).toFixed(2)), score: +(60 + m * 4).toFixed(0), varc: 24 + m, dilr: 18 + m, qa: 20 + m });
      }
    }
    // today: partial progress
    for (const k of ["qa", "rc", "va", "dilr"] as const) {
      const n = Math.round((full.find((d) => d.date === today)?.targets[k] ?? 0) * quality * 0.35);
      if (n > 0) logs.push({ userId, date: today, section: k, count: n });
    }
    if (logs.length) await db.insert(S.progressLogs).values(logs);
  }

  const me = await db.query.users.findFirst({ where: eq(S.users.email, email) });
  if (!me) throw new Error(`No user ${email}. Sign in once first.`);
  await db.insert(S.profiles).values({ userId: me.id, username: "dev", onboarded: true, why: "Move from engineering into business leadership.", dreamColleges: ["IIM A", "IIM B", "IIM C"], templateId: tpl.id })
    .onConflictDoNothing();
  await fillHistory(me.id, 0.72, 84);

  const friends = [
    { name: "Aditi Rao", username: "aditi_r", q: 0.92, base: 90 },
    { name: "Kabir Shah", username: "kabir99", q: 0.55, base: 80 },
    { name: "Neha Iyer", username: "neha.dilr".replace(".", "_"), q: 0.8, base: 86 },
  ];
  for (const f of friends) {
    const mail = `${f.username}@demo.local`;
    let u = await db.query.users.findFirst({ where: eq(S.users.email, mail) });
    if (!u) [u] = await db.insert(S.users).values({ email: mail, name: f.name }).returning();
    await db.insert(S.profiles).values({ userId: u.id, username: f.username, onboarded: true, targetPercentile: 99, dreamColleges: ["IIM A", "FMS"], templateId: tpl.id })
      .onConflictDoNothing();
    await fillHistory(u.id, f.q, f.base);
    const accepted = f.username !== "neha_dilr";
    await db.insert(S.friendships).values(accepted
      ? { requesterId: me.id, addresseeId: u.id, status: "accepted" }
      : { requesterId: u.id, addresseeId: me.id, status: "pending" }).onConflictDoNothing();
  }
  return { email, friends: friends.length };
}
