"use server";

import { and, desc, eq, gte, lte, ne, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { dayPlans, friendships, mockResults, notificationsSent, profiles, progressLogs, templates, users, type PushSub, type Targets } from "@/db/schema";
import { EXAM_DATE, istNow, SECTIONS, type Section } from "@/lib/cat";
import { generatePlan } from "@/lib/plan-generator";
import { SYSTEM_TEMPLATES, applyWeakness, type TemplateDef } from "@/lib/templates";
import { sendPush, sendWhatsApp } from "@/lib/notify";
import { cachedAI } from "@/lib/ai";
import { loadUserState } from "@/lib/data";
import { dashboardSlot, fallback, prompt } from "@/lib/coach";
import { loadCoachContext } from "@/lib/coach-context";
import { normalizeUsername, relation, RESERVED, USERNAME_RE } from "@/lib/social";

async function uid() {
  const s = await auth();
  if (!s?.user?.id) throw new Error("Unauthorized");
  return s.user.id;
}

const targetsSchema = z.object({
  qa: z.coerce.number().int().min(0).max(500),
  rc: z.coerce.number().int().min(0).max(200),
  va: z.coerce.number().int().min(0).max(200),
  dilr: z.coerce.number().int().min(0).max(50),
});
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sectionSchema = z.enum(SECTIONS);

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}
export async function devSignIn() {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_LOGIN !== "1") throw new Error("Disabled");
  await signIn("dev", { redirectTo: "/dashboard" });
}
export async function logout() {
  await signOut({ redirectTo: "/" });
}

async function getTemplate(userId: string, id: string): Promise<TemplateDef | null> {
  const sys = SYSTEM_TEMPLATES.find((t) => t.id === id);
  if (sys) return sys;
  const t = await db.query.templates.findFirst({ where: and(eq(templates.id, id), eq(templates.ownerId, userId)) });
  return t ? { ...t } : null;
}

async function writePlan(userId: string, days: ReturnType<typeof generatePlan>, from: string) {
  await db.delete(dayPlans).where(and(eq(dayPlans.userId, userId), gte(dayPlans.date, from)));
  if (days.length) await db.insert(dayPlans).values(days.map((d) => ({ ...d, userId })));
}

// ---------- Onboarding ----------
const onboardSchema = z.object({
  username: z.string(),
  targetPercentile: z.coerce.number().min(50).max(100),
  dreamColleges: z.string().max(300),
  why: z.string().max(1000),
  weakSections: z.array(sectionSchema),
  studyStartHour: z.coerce.number().int().min(0).max(23),
  studyEndHour: z.coerce.number().int().min(1).max(24),
  templateId: z.string().min(1),
});

export async function completeOnboarding(formData: FormData) {
  const userId = await uid();
  const data = onboardSchema.parse({
    username: formData.get("username") ?? "",
    targetPercentile: formData.get("targetPercentile"),
    dreamColleges: formData.get("dreamColleges") ?? "",
    why: formData.get("why") ?? "",
    weakSections: formData.getAll("weakSections"),
    studyStartHour: formData.get("studyStartHour"),
    studyEndHour: formData.get("studyEndHour"),
    templateId: formData.get("templateId"),
  });
  if (data.studyEndHour <= data.studyStartHour) throw new Error("Study window must end after it starts");
  const username = normalizeUsername(data.username);
  const check = await checkUsername(username);
  if (!check.ok) throw new Error(check.reason);
  const values = {
    ...data,
    username,
    dreamColleges: data.dreamColleges.split(",").map((s) => s.trim()).filter(Boolean),
    onboarded: true,
  };
  await db.insert(profiles).values({ userId, ...values }).onConflictDoUpdate({ target: profiles.userId, set: values });

  const tpl = await getTemplate(userId, data.templateId);
  if (!tpl) throw new Error("Template not found");
  const { date } = istNow();
  await writePlan(userId, generatePlan({ start: date, template: tpl, weak: data.weakSections }), date);
  redirect("/dashboard");
}

export async function updateGoal(formData: FormData) {
  const userId = await uid();
  const data = onboardSchema.omit({ templateId: true, username: true }).parse({
    targetPercentile: formData.get("targetPercentile"),
    dreamColleges: formData.get("dreamColleges") ?? "",
    why: formData.get("why") ?? "",
    weakSections: formData.getAll("weakSections"),
    studyStartHour: formData.get("studyStartHour"),
    studyEndHour: formData.get("studyEndHour"),
  });
  if (data.studyEndHour <= data.studyStartHour) throw new Error("Study window must end after it starts");
  await db
    .update(profiles)
    .set({ ...data, dreamColleges: data.dreamColleges.split(",").map((s) => s.trim()).filter(Boolean) })
    .where(eq(profiles.userId, userId));
  refresh();
}

// ---------- Progress logging ----------
export async function logProgress(section: Section, count: number) {
  const userId = await uid();
  sectionSchema.parse(section);
  const n = z.number().int().min(-100).max(200).refine((v) => v !== 0).parse(count);
  const { date } = istNow();
  await db.insert(progressLogs).values({ userId, date, section, count: n });
  refresh();
}

export async function undoLastLog() {
  const userId = await uid();
  const { date } = istNow();
  const last = await db.query.progressLogs.findFirst({
    where: and(eq(progressLogs.userId, userId), eq(progressLogs.date, date)),
    orderBy: desc(progressLogs.id),
  });
  if (last) await db.delete(progressLogs).where(eq(progressLogs.id, last.id));
  refresh();
}

export async function toggleMockFlag(date: string, field: "mockDone" | "analysisDone", value: boolean) {
  const userId = await uid();
  dateSchema.parse(date);
  await db.update(dayPlans).set({ [field]: value }).where(and(eq(dayPlans.userId, userId), eq(dayPlans.date, date)));
  refresh();
}

// ---------- Planner ----------
export async function updateDay(date: string, input: { type: "practice" | "mock" | "rest"; targets: Targets; mockName?: string | null; note?: string | null; tag?: string | null }) {
  const userId = await uid();
  dateSchema.parse(date);
  const type = z.enum(["practice", "mock", "rest"]).parse(input.type);
  const targets = targetsSchema.parse(input.targets);
  const mockName = type === "mock" ? (z.string().max(80).nullish().parse(input.mockName) || "Mock") : null;
  const note = z.string().max(200).nullish().parse(input.note) ?? null;
  const tag = z.string().max(24).nullish().parse(input.tag) ?? null;
  await db
    .insert(dayPlans)
    .values({ userId, date, type, targets, mockName, note, tag })
    .onConflictDoUpdate({ target: [dayPlans.userId, dayPlans.date], set: { type, targets, mockName, note, tag } });
  refresh();
}

export async function applyTemplate(templateId: string, from: string, to: string, keepMocks: boolean) {
  const userId = await uid();
  dateSchema.parse(from);
  dateSchema.parse(to);
  const { date: today } = istNow();
  const start = from < today ? today : from;
  const end = to > EXAM_DATE ? EXAM_DATE : to;
  if (end < start) return;
  const tpl = await getTemplate(userId, templateId);
  if (!tpl) throw new Error("Template not found");
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  const weak = (profile?.weakSections ?? []) as Section[];

  if (keepMocks) {
    // Only rewrite targets; keep each day's type (your mock calendar stays as is).
    const existing = await db.select().from(dayPlans)
      .where(and(eq(dayPlans.userId, userId), gte(dayPlans.date, start), lte(dayPlans.date, end)));
    const w = tpl.id === "sys-weakness" ? weak : [];
    for (const d of existing) {
      if (d.type === "rest") continue;
      const targets = applyWeakness(d.type === "mock" ? tpl.mock : tpl.practice, w);
      await db.update(dayPlans).set({ targets }).where(eq(dayPlans.id, d.id));
    }
  } else {
    const all = generatePlan({ start: today, template: tpl, weak });
    const slice = all.filter((d) => d.date >= start && d.date <= end);
    await db.delete(dayPlans).where(and(eq(dayPlans.userId, userId), gte(dayPlans.date, start), lte(dayPlans.date, end)));
    if (slice.length) await db.insert(dayPlans).values(slice.map((d) => ({ ...d, userId })));
  }
  await db.update(profiles).set({ templateId }).where(eq(profiles.userId, userId));
  refresh();
}

export async function saveCustomTemplate(input: { name: string; practice: Targets; mock: Targets; mocksPerWeek: number; finalStretchMocksPerWeek: number }) {
  const userId = await uid();
  const data = z.object({
    name: z.string().min(1).max(60),
    practice: targetsSchema,
    mock: targetsSchema,
    mocksPerWeek: z.coerce.number().int().min(0).max(7),
    finalStretchMocksPerWeek: z.coerce.number().int().min(0).max(7),
  }).parse(input);
  await db.insert(templates).values({ ...data, ownerId: userId, description: "Your custom template" });
  refresh();
}

export async function deleteCustomTemplate(id: string) {
  const userId = await uid();
  await db.delete(templates).where(and(eq(templates.id, id), eq(templates.ownerId, userId)));
  refresh();
}

// ---------- Mocks ----------
export async function addMockResult(formData: FormData) {
  const userId = await uid();
  const num = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().nullable());
  const data = z.object({
    date: dateSchema,
    name: z.string().min(1).max(80),
    percentile: z.coerce.number().min(0).max(100),
    score: num,
    varc: num,
    dilr: num,
    qa: num,
    learnings: z.string().max(2000).optional(),
  }).parse(Object.fromEntries(formData));
  await db.insert(mockResults).values({ ...data, userId });
  await db.update(dayPlans).set({ mockDone: true })
    .where(and(eq(dayPlans.userId, userId), eq(dayPlans.date, data.date), eq(dayPlans.type, "mock")));
  refresh();
}

export async function deleteMockResult(id: number) {
  const userId = await uid();
  await db.delete(mockResults).where(and(eq(mockResults.id, id), eq(mockResults.userId, userId)));
  refresh();
}

// ---------- Notifications ----------
export async function savePushSubscription(sub: PushSub) {
  const userId = await uid();
  const parsed = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }).parse(sub);
  const p = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  const subs = (p?.pushSubscriptions ?? []).filter((s) => s.endpoint !== parsed.endpoint);
  await db.update(profiles).set({ pushSubscriptions: [...subs, parsed], notifyPush: true }).where(eq(profiles.userId, userId));
  refresh();
}

export async function saveNotificationSettings(formData: FormData) {
  const userId = await uid();
  const data = z.object({
    notifyPush: z.boolean(),
    notifyWhatsapp: z.boolean(),
    callmebotPhone: z.string().max(20).regex(/^\+?\d*$/, "Phone must be digits with country code, e.g. +919876543210"),
    callmebotKey: z.string().max(40),
    coachLanguage: z.enum(["english", "hinglish"]),
    coachIntensity: z.enum(["gentle", "firm", "savage"]),
  }).parse({
    coachLanguage: formData.get("coachLanguage") ?? "english",
    coachIntensity: formData.get("coachIntensity") ?? "firm",
    notifyPush: formData.get("notifyPush") === "on",
    notifyWhatsapp: formData.get("notifyWhatsapp") === "on",
    callmebotPhone: String(formData.get("callmebotPhone") ?? "").replace(/\s/g, ""),
    callmebotKey: String(formData.get("callmebotKey") ?? "").trim(),
  });
  await db.update(profiles).set({
    ...data,
    callmebotPhone: data.callmebotPhone || null,
    callmebotKey: data.callmebotKey || null,
  }).where(eq(profiles.userId, userId));
  refresh();
}

export async function sendTestNotification(): Promise<{ push: string; whatsapp: string }> {
  const userId = await uid();
  const p = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!p) return { push: "no profile", whatsapp: "no profile" };
  const msg = "Test from CAT Sprint. Notifications are working. Now go solve a DILR set.";
  const push = await sendPush(p.pushSubscriptions, { title: "CAT Sprint", body: msg, tag: "test" });
  if (push.dead.length) {
    await db.update(profiles).set({ pushSubscriptions: p.pushSubscriptions.filter((s) => !push.dead.includes(s.endpoint)) }).where(eq(profiles.userId, userId));
  }
  let whatsapp = "not configured";
  if (p.callmebotPhone && p.callmebotKey) whatsapp = (await sendWhatsApp(p.callmebotPhone, p.callmebotKey, msg)) ? "sent" : "failed (check phone/key)";
  return { push: push.sent ? `sent to ${push.sent} device(s)` : p.pushSubscriptions.length ? "failed" : "no device subscribed", whatsapp };
}

// ---------- AI ----------
export async function regenerateBrief() {
  const userId = await uid();
  const s = await loadUserState(userId);
  if (!s) return;
  const ctx = await loadCoachContext(s);
  const { sit, kind } = dashboardSlot(s, ctx);
  await cachedAI(userId, kind, prompt(s, sit, ctx), fallback(s, sit, ctx), { force: true });
  refresh();
}

export async function resetPlanFromToday(templateId: string) {
  const userId = await uid();
  const { date } = istNow();
  const tpl = await getTemplate(userId, templateId);
  if (!tpl) throw new Error("Template not found");
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  await writePlan(userId, generatePlan({ start: date, template: tpl, weak: (profile?.weakSections ?? []) as Section[] }), date);
  await db.update(profiles).set({ templateId }).where(eq(profiles.userId, userId));
  refresh();
}


// ---------- Social ----------
export async function checkUsername(raw: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const userId = await uid();
  const u = normalizeUsername(raw);
  if (!USERNAME_RE.test(u)) return { ok: false, reason: "3–20 characters: a–z, 0–9 or _" };
  if (RESERVED.has(u)) return { ok: false, reason: "That one's reserved" };
  const taken = await db.query.profiles.findFirst({ where: and(eq(profiles.username, u), ne(profiles.userId, userId)) });
  return taken ? { ok: false, reason: "Taken" } : { ok: true };
}

export async function saveProfileSettings(formData: FormData) {
  const userId = await uid();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const check = await checkUsername(username);
  if (!check.ok) throw new Error(`Username: ${check.reason}`);
  const visibility = z.enum(["friends", "public"]).parse(formData.get("visibility"));
  await db.update(profiles).set({ username, visibility, showMocks: formData.get("showMocks") === "on" }).where(eq(profiles.userId, userId));
  refresh();
}

export async function sendFriendRequest(rawUsername: string): Promise<{ ok: boolean; message: string }> {
  const userId = await uid();
  const u = normalizeUsername(rawUsername);
  const other = await db.query.profiles.findFirst({ where: eq(profiles.username, u) });
  if (!other) return { ok: false, message: `No one with username @${u}` };
  const rel = await relation(userId, other.userId);
  if (rel.kind === "self") return { ok: false, message: "That's you 🙂" };
  if (rel.kind === "friends") return { ok: false, message: `You're already friends with @${u}` };
  if (rel.kind === "outgoing") return { ok: false, message: "Request already sent" };
  if (rel.kind === "incoming") {
    await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, rel.id));
    refresh();
    return { ok: true, message: `You and @${u} are now friends` };
  }
  await db.insert(friendships).values({ requesterId: userId, addresseeId: other.userId });
  refresh();
  return { ok: true, message: `Request sent to @${u}` };
}

export async function respondFriendRequest(id: number, accept: boolean) {
  const userId = await uid();
  const where = and(eq(friendships.id, id), eq(friendships.addresseeId, userId), eq(friendships.status, "pending"));
  if (accept) await db.update(friendships).set({ status: "accepted" }).where(where);
  else await db.delete(friendships).where(where);
  refresh();
}

/** Cancel an outgoing request or unfriend. */
export async function removeFriendship(otherUserId: string) {
  const userId = await uid();
  await db.delete(friendships).where(or(
    and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, otherUserId)),
    and(eq(friendships.requesterId, otherUserId), eq(friendships.addresseeId, userId)),
  ));
  refresh();
}

export async function sendNudgeToFriend(otherUserId: string): Promise<string> {
  const userId = await uid();
  const rel = await relation(userId, otherUserId);
  if (rel.kind !== "friends") return "Only friends can nudge each other";
  const [me, them] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.profiles.findFirst({ where: eq(profiles.userId, otherUserId) }),
  ]);
  if (!them) return "Not found";
  const { date } = istNow();
  // one nudge per friend pair per day
  const key = `friend-nudge-${userId}`;
  const claimed = await db.insert(notificationsSent).values({ userId: otherUserId, date, kind: key, body: "nudge" }).onConflictDoNothing().returning();
  if (!claimed.length) return "You already nudged them today";
  const first = (me?.name ?? "A friend").split(" ")[0];
  const body = `${first} is studying and wants you in the game too. Log your first block now.`;
  await sendPush(them.pushSubscriptions, { title: `👊 Nudge from ${first}`, body, tag: key });
  if (them.notifyWhatsapp && them.callmebotPhone && them.callmebotKey) await sendWhatsApp(them.callmebotPhone, them.callmebotKey, body);
  return "Nudge sent";
}
