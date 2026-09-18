import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationsSent, profiles } from "@/db/schema";
import { cachedAI } from "@/lib/ai";
import { checkpointsFor, classifyCheckpoint, classifyMorning, fallback, prompt, TITLES, type CoachContext, type Situation } from "@/lib/coach";
import { loadCoachContext } from "@/lib/coach-context";
import { loadUserState, type UserState } from "@/lib/data";
import { sendPush, sendWhatsApp } from "@/lib/notify";

// Called every 30 min by cron-job.org (Vercel Hobby cron only allows once a day).
// Rules decide WHEN and WHAT SITUATION; the model (budgeted + cached) only words it.
//   • morning brief at window start (taunts if yesterday was bad / nudges ignored)
//   • check-ins at 12, 3, 6, 8, 10 PM (inside your window): warn → escalate if ignored,
//     push to finish when almost done, stay quiet when on pace
//   • applause the moment the day's plan is complete
//   • mock-eve reminder, night summary

export const maxDuration = 60;

type Slot = { kind: string; sit: Situation };

function slotsFor(s: UserState, ctx: CoachContext): Slot[] {
  const { studyStartHour: start, studyEndHour: end } = s.profile;
  const h = s.hour;
  const within = (at: number, grace = 1) => h >= at && h < at + grace;
  const out: Slot[] = [];

  // Applause fires on the first tick after the plan is complete, whatever the time.
  if (s.stats.today.planned > 0 && s.stats.today.ratio >= 1 && !ctx.sentToday.some((r) => r.kind === "applause")) {
    out.push({ kind: "applause", sit: "applause" });
  }
  if (within(start, 1.5)) out.push({ kind: "morning", sit: classifyMorning(s) });
  for (const cp of checkpointsFor(start, end)) {
    if (!within(cp)) continue;
    const sit = classifyCheckpoint(s, ctx, cp);
    if (sit && sit !== "applause") out.push({ kind: `cp-${cp}`, sit });
  }
  if (s.tomorrowPlan?.type === "mock" && within(Math.max(start + 1, end - 1.5))) out.push({ kind: "mock-eve", sit: "mock-eve" });
  if (within(Math.max(start + 1, end - 0.5))) out.push({ kind: "night", sit: "night" });
  return out;
}

async function claim(userId: string, s: UserState, kind: string, sit: Situation) {
  const rows = await db.insert(notificationsSent)
    .values({ userId, date: s.today, kind, body: "", meta: { doneMinutes: s.stats.today.done, ratio: s.stats.today.ratio, situation: sit } })
    .onConflictDoNothing().returning({ id: notificationsSent.id });
  return rows[0]?.id ?? null;
}

async function deliver(s: UserState, title: string, body: string, tag: string) {
  const p = s.profile;
  const res = { push: 0, whatsapp: false };
  if (p.notifyPush && p.pushSubscriptions.length) {
    const r = await sendPush(p.pushSubscriptions, { title, body, tag, url: "/dashboard" });
    res.push = r.sent;
    if (r.dead.length) {
      await db.update(profiles).set({ pushSubscriptions: p.pushSubscriptions.filter((x) => !r.dead.includes(x.endpoint)) })
        .where(eq(profiles.userId, p.userId));
    }
  }
  if (p.notifyWhatsapp && p.callmebotPhone && p.callmebotKey) {
    res.whatsapp = await sendWhatsApp(p.callmebotPhone, p.callmebotKey, `*${title}*\n${body}`);
  }
  return res;
}

async function compose(s: UserState, sit: Situation, ctx: CoachContext, cacheKind: string) {
  if (sit === "night") return fallback(s, sit, ctx); // pure numbers, no AI needed
  const aiKind = sit.startsWith("morning") ? "brief" : cacheKind;
  return (await cachedAI(s.profile.userId, aiKind, prompt(s, sit, ctx), fallback(s, sit, ctx))).text;
}

async function handleUser(userId: string, force?: Situation) {
  const s = await loadUserState(userId);
  if (!s || !s.profile.onboarded) return [];
  const ctx = await loadCoachContext(s);
  const slots: Slot[] = force ? [{ kind: `test-${force}-${Date.now()}`, sit: force }] : slotsFor(s, ctx);
  const log: { kind: string; sit: Situation; body: string; push: number; whatsapp: boolean }[] = [];

  for (const { kind, sit } of slots) {
    const id = force ? null : await claim(userId, s, kind, sit);
    if (!force && !id) continue; // already sent this slot today
    const body = await compose(s, sit, ctx, force ? `test-${sit}` : kind);
    if (id) await db.update(notificationsSent).set({ body }).where(eq(notificationsSent.id, id));
    const r = await deliver(s, TITLES[sit](s), body, kind);
    log.push({ kind, sit, body, ...r });
  }
  return log;
}

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || given !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const force = req.nextUrl.searchParams.get("force") as Situation | null;
  const onlyUser = req.nextUrl.searchParams.get("user");
  const all = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.onboarded, true));
  const targets = onlyUser ? all.filter((u) => u.userId === onlyUser) : all;

  const results: Record<string, unknown> = {};
  for (const { userId } of targets) {
    try {
      results[userId] = await handleUser(userId, force ?? undefined);
    } catch (e) {
      console.error("[cron] user failed", userId, e);
      results[userId] = { error: String(e) };
    }
  }
  return NextResponse.json({ ok: true, users: targets.length, results });
}

export const GET = run;
export const POST = run;
