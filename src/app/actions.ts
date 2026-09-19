"use server";

import { and, desc, eq, gte, lte, ne, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { dayPlans, friendships, mockResults, notificationsSent, weeklyGoals, profiles, progressLogs, templates, users, type PhaseDef, type PushSub, type Targets } from "@/db/schema";
import { addDays, EXAM_DATE, istNow, SECTIONS, weekStartOf, ZERO, type Section } from "@/lib/cat";
import { generatePlan, phaseFor, weekIdx } from "@/lib/plan-generator";
import { SYSTEM_TEMPLATES, applyWeakness, type TemplateDef } from "@/lib/templates";
import { sendEmail, sendPush } from "@/lib/notify";
import { aiCallsLeft, cachedAI, USER_DAILY } from "@/lib/ai";
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
  visibility: z.enum(["friends", "public"]),
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
    visibility: formData.get("visibility"),
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
    visibilityChosen: true,
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
  if (date < istNow().date) throw new Error("Past days are locked");
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
      if (d.type === "rest" || d.date === EXAM_DATE) continue;
      if (tpl.phases?.length) {
        // Same weekday's slot if it's the same kind of day, else the phase's first slot of that kind.
        const p = phaseFor(tpl.phases, d.date);
        const own = p.week[weekIdx(d.date)];
        const slot = own.type === d.type ? own : p.week.find((s) => s.type === d.type);
        const targets = slot?.targets ?? (d.type === "mock" ? ZERO : tpl.practice);
        await db.update(dayPlans).set({ targets, phase: p.name }).where(eq(dayPlans.id, d.id));
        continue;
      }
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

const phasesSchema = z.array(z.object({
  name: z.string().trim().min(1).max(24),
  until: dateSchema,
  week: z.array(z.object({ type: z.enum(["practice", "mock", "rest"]), targets: targetsSchema })).length(7),
})).min(1).max(8);

/** Creates (no id) or updates (id) a phase-based custom template. Returns its id. */
export async function saveCustomTemplate(input: { id?: string; name: string; phases: PhaseDef[] }): Promise<string> {
  const userId = await uid();
  const { id, name, phases } = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(60), phases: phasesSchema }).parse(input);
  // Phases must run in date order; the last one always reaches the day before CAT.
  phases[phases.length - 1].until = addDays(EXAM_DATE, -1);
  for (let i = 1; i < phases.length; i++) {
    if (phases[i].until <= phases[i - 1].until) throw new Error(`"${phases[i].name}" must end after "${phases[i - 1].name}"`);
  }
  for (const p of phases) for (const s of p.week) if (s.type === "rest") s.targets = ZERO;
  // Summary fields keep older screens (and the day editor defaults) working.
  const first = phases[0].week;
  const count = (w: PhaseDef["week"]) => w.filter((s) => s.type === "mock").length;
  const values = {
    name,
    phases,
    description: `${phases.length} phase${phases.length > 1 ? "s" : ""}: ${phases.map((p) => p.name).join(" → ")}`,
    practice: first.find((s) => s.type === "practice")?.targets ?? ZERO,
    mock: first.find((s) => s.type === "mock")?.targets ?? ZERO,
    mocksPerWeek: count(first),
    finalStretchMocksPerWeek: Math.max(...phases.map((p) => count(p.week))),
  };
  let savedId = id;
  if (id) {
    const res = await db.update(templates).set(values).where(and(eq(templates.id, id), eq(templates.ownerId, userId))).returning({ id: templates.id });
    if (!res.length) throw new Error("Template not found");
  } else {
    const [row] = await db.insert(templates).values({ ...values, ownerId: userId }).returning({ id: templates.id });
    savedId = row.id;
  }
  refresh();
  return savedId!;
}

export async function deleteCustomTemplate(id: string) {
  const userId = await uid();
  await db.delete(templates).where(and(eq(templates.id, id), eq(templates.ownerId, userId)));
  refresh();
}

// ---------- Mocks ----------
export async function addMockResult(formData: FormData) {
  const userId = await uid();
  const num = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(-100).max(300).nullable());
  const note = z.string().trim().max(2000).optional().transform((v) => v || undefined);
  const data = z.object({
    date: dateSchema,
    name: z.string().min(1).max(80),
    score: z.coerce.number().min(-100).max(300),
    varc: num,
    dilr: num,
    qa: num,
    learnings: z.string().max(2000).optional(),
    note_qa: note,
    note_dilr: note,
    note_va: note,
    note_rc: note,
  }).parse(Object.fromEntries(formData));
  const { note_qa: qa, note_dilr: dilr, note_va: va, note_rc: rc, ...row } = data;
  const sectionNotes = Object.fromEntries(Object.entries({ qa, dilr, va, rc }).filter(([, v]) => v));
  await db.insert(mockResults).values({ ...row, sectionNotes: Object.keys(sectionNotes).length ? sectionNotes : null, userId });
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
    notifyEmail: z.boolean(),
    coachIntensity: z.enum(["gentle", "firm", "strict"]),
  }).parse({
    coachIntensity: formData.get("coachIntensity") ?? "firm",
    notifyPush: formData.get("notifyPush") === "on",
    notifyEmail: formData.get("notifyEmail") === "on",
  });
  await db.update(profiles).set(data).where(eq(profiles.userId, userId));
  refresh();
}

export async function sendTestNotification(): Promise<{ push: string; email: string }> {
  const userId = await uid();
  const p = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!p) return { push: "no profile", email: "no profile" };
  const msg = "Test from CAT Sprint. Notifications are working. Now go solve a DILR set.";
  const push = await sendPush(p.pushSubscriptions, { title: "CAT Sprint", body: msg, tag: "test" });
  if (push.dead.length) {
    await db.update(profiles).set({ pushSubscriptions: p.pushSubscriptions.filter((s) => !push.dead.includes(s.endpoint)) }).where(eq(profiles.userId, userId));
  }
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const email = !process.env.SMTP_HOST ? "SMTP not configured" : u?.email ? ((await sendEmail(u.email, "Test notification", msg)) ? `sent to ${u.email}` : "failed") : "no email";
  return { push: push.sent ? `sent to ${push.sent} device(s)` : p.pushSubscriptions.length ? "failed" : "no device subscribed", email };
}

// ---------- AI ----------
export async function regenerateBrief(): Promise<{ ok: boolean; message: string }> {
  const userId = await uid();
  if ((await aiCallsLeft(userId)) <= 0) return { ok: false, message: `You've used today's ${USER_DAILY} AI rewrites. Resets at midnight IST.` };
  const s = await loadUserState(userId);
  if (!s) return { ok: false, message: "No plan yet." };
  const ctx = await loadCoachContext(s);
  const { sit, kind } = dashboardSlot(s, ctx);
  const r = await cachedAI(userId, kind, prompt(s, sit, ctx), fallback(s, sit, ctx), { force: true });
  refresh();
  return r.ai ? { ok: true, message: "Rewritten." } : { ok: false, message: "AI is busy (shared free quota). Showing the numbers-only version." };
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
  await db.update(profiles).set({ username, visibility, visibilityChosen: true, showMocks: formData.get("showMocks") === "on" }).where(eq(profiles.userId, userId));
  refresh();
}

export async function setVisibility(visibility: "friends" | "public") {
  const userId = await uid();
  const v = z.enum(["friends", "public"]).parse(visibility);
  await db.update(profiles).set({ visibility: v, visibilityChosen: true }).where(eq(profiles.userId, userId));
  refresh();
}

export async function sendFriendRequest(rawUsername: string): Promise<{ ok: boolean; message: string }> {
  const userId = await uid();
  const u = normalizeUsername(rawUsername);
  const other = await db.query.profiles.findFirst({ where: eq(profiles.username, u) });
  if (!other) return { ok: false, message: `No one with username @${u}` };
  const rel = await relation(userId, other.userId);
  if (rel.kind === "self") return { ok: false, message: "That's your own username" };
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
  const body = `${first} is studying and sent you a reminder. Log your first block now.`;
  await sendPush(them.pushSubscriptions, { title: `Reminder from ${first}`, body, tag: key });
  return "Nudge sent";
}

// ---------- Weekly goal (lock-once) ----------
export async function lockWeeklyGoal(input: { targets: Targets; mocks: number }): Promise<{ ok: boolean; message: string }> {
  const userId = await uid();
  const targets = targetsSchema.parse(input.targets);
  const mocks = z.coerce.number().int().min(0).max(7).parse(input.mocks);
  if (!SECTIONS.some((k) => targets[k] > 0)) return { ok: false, message: "Set at least one target" };
  const weekStart = weekStartOf(istNow().date);
  const rows = await db.insert(weeklyGoals).values({ userId, weekStart, targets, mocks }).onConflictDoNothing().returning({ id: weeklyGoals.id });
  refresh();
  return rows.length ? { ok: true, message: "Locked until Sunday" } : { ok: false, message: "This week's goal is already locked" };
}
