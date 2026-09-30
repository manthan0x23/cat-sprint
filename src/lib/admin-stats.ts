import "server-only";
import { asc, count, countDistinct, eq, gte, sql, sum, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  aiUsage, friendships, mockResults, notificationsSent, profiles, progressLogs, sectionalResults, userActivity, users, weeklyGoals,
} from "@/db/schema";
import { BUDGET as AI_BUDGET } from "./ai";
import { addDays, diffDays, istNow, SECTIONS, weekStartOf } from "./cat";

// Admin-only analytics. Every figure is in IST days, like the rest of the app.
//
// "Active" on a day = opened the app (user_activity, recorded since the admin analytics shipped)
// OR wrote something that day (a progress log, mock or sectional). The write-based part lets DAU/MAU
// reach back before tracking started. Cron-made rows (AI briefs, notifications) never count.

/**
 * IST calendar day of a `timestamp` (no tz) column, as text (drivers disagree on how they return `date`).
 * defaultNow() stores wall time in the DB session's zone: GMT on Neon, the machine's zone on local PGlite.
 */
const istDay = (col: PgColumn) =>
  sql<string>`to_char((${col} AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`;

const HISTORY_DAYS = 90;

export type DailyPoint = { date: string; value: number };
export type Friendship = { a: string; b: string; status: "pending" | "accepted"; since: string };
export type AdminUser = {
  id: string; name: string | null; email: string | null; image: string | null; username: string | null;
  onboarded: boolean; onboardedOn: string | null;
  // Profile fields (null when not onboarded).
  targetPercentile: number | null; dreamColleges: string[] | null; weakSections: string[] | null;
  why: string | null; studyStartHour: number | null; studyEndHour: number | null;
  visibility: "friends" | "public" | null; pushOn: boolean;
  // Activity.
  lastActive: string | null; activeDays7: number; activeDays30: number; requests30: number;
  logs7: number; mocks: number; friends: number;
};

export async function loadAdminStats(now = new Date()) {
  const { date: today } = istNow(now);
  const yesterday = addDays(today, -1);
  const weekStart = weekStartOf(today);
  const lastWeekStart = addDays(weekStart, -7);
  const sinceDate = addDays(today, -HISTORY_DAYS);

  const [
    userRows, visits, logDays, mockDays, sectionalDays, logsByDay, sectionsByDay, logsByUser7,
    mocksByUser, mockAvg, friendRows, notifByKind, aiRows, goalsThisWeek, mocksByDay, sectionalsByDay,
  ] = await Promise.all([
    db.select({
      id: users.id, name: users.name, email: users.email, image: users.image, username: profiles.username,
      onboarded: profiles.onboarded, onboardedOn: sql<string | null>`${istDay(profiles.createdAt)}`,
      targetPercentile: profiles.targetPercentile, dreamColleges: profiles.dreamColleges, weakSections: profiles.weakSections,
      why: profiles.why, studyStartHour: profiles.studyStartHour, studyEndHour: profiles.studyEndHour,
      visibility: profiles.visibility, notifyPush: profiles.notifyPush, pushSubscriptions: profiles.pushSubscriptions,
    }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).orderBy(asc(users.name)),
    db.select({ userId: userActivity.userId, date: userActivity.date, hits: userActivity.hits })
      .from(userActivity).where(gte(userActivity.date, sinceDate)),
    activeDaysFrom(progressLogs.userId, progressLogs.createdAt, sinceDate),
    activeDaysFrom(mockResults.userId, mockResults.createdAt, sinceDate),
    activeDaysFrom(sectionalResults.userId, sectionalResults.createdAt, sinceDate),
    groupByDay(progressLogs.createdAt, { entries: count(), loggers: countDistinct(progressLogs.userId) }, sinceDate),
    db.select({ day: istDay(progressLogs.createdAt), section: progressLogs.section, units: sum(progressLogs.count).mapWith(Number) })
      .from(progressLogs).where(gte(istDay(progressLogs.createdAt), sinceDate))
      .groupBy(istDay(progressLogs.createdAt), progressLogs.section),
    db.select({ userId: progressLogs.userId, n: count() }).from(progressLogs)
      .where(gte(istDay(progressLogs.createdAt), addDays(today, -6))).groupBy(progressLogs.userId),
    db.select({ userId: mockResults.userId, n: count() }).from(mockResults).groupBy(mockResults.userId),
    db.select({ avg: sql<number | null>`avg(${mockResults.score})`.mapWith(Number), n: count(mockResults.score) })
      .from(mockResults).where(gte(mockResults.date, addDays(today, -29))),
    db.select({ a: friendships.requesterId, b: friendships.addresseeId, status: friendships.status, since: istDay(friendships.createdAt) }).from(friendships),
    db.select({ kind: notificationsSent.kind, day: notificationsSent.date, n: count() }).from(notificationsSent)
      .where(gte(notificationsSent.date, addDays(today, -6))).groupBy(notificationsSent.kind, notificationsSent.date),
    db.select().from(aiUsage).where(gte(aiUsage.date, addDays(today, -29))),
    db.select({ n: count() }).from(weeklyGoals).where(eq(weeklyGoals.weekStart, weekStart)),
    groupByDay(mockResults.createdAt, { n: count() }, addDays(today, -6)),
    groupByDay(sectionalResults.createdAt, { n: count() }, addDays(today, -6)),
  ]);

  // ---------- Active users ----------
  const activeByDay = new Map<string, Set<string>>();
  const lastActive = new Map<string, string>();
  const markActive = (userId: string, day: string) => {
    let s = activeByDay.get(day);
    if (!s) activeByDay.set(day, (s = new Set()));
    s.add(userId);
    if ((lastActive.get(userId) ?? "") < day) lastActive.set(userId, day);
  };
  for (const r of [...visits, ...logDays, ...mockDays, ...sectionalDays]) markActive(r.userId, r.date);
  const activeIn = (from: string, to = today) => {
    const s = new Set<string>();
    for (const [d, ids] of activeByDay) if (d >= from && d <= to) for (const id of ids) s.add(id);
    return s;
  };
  const days30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const dau = activeIn(today).size;
  const wau = activeIn(addDays(today, -6)).size;
  const mau = activeIn(addDays(today, -29)).size;
  const dauSeries: DailyPoint[] = days30.map((d) => ({ date: d, value: activeByDay.get(d)?.size ?? 0 }));
  const avgDau30 = dauSeries.reduce((a, p) => a + p.value, 0) / 30;

  // ---------- Requests ----------
  const hitsByDay = new Map<string, number>();
  const hitsByUser30 = new Map<string, number>();
  for (const v of visits) {
    hitsByDay.set(v.date, (hitsByDay.get(v.date) ?? 0) + v.hits);
    if (v.date >= addDays(today, -29)) hitsByUser30.set(v.userId, (hitsByUser30.get(v.userId) ?? 0) + v.hits);
  }
  const trackingSince = visits.reduce<string | null>((m, v) => (!m || v.date < m ? v.date : m), null);
  const sumDays = (m: Map<string, number>, from: string, to = today) => {
    let t = 0;
    for (const [d, n] of m) if (d >= from && d <= to) t += n;
    return t;
  };

  // ---------- Progress logs ----------
  const entriesByDay = new Map(logsByDay.map((r) => [r.day, r.entries]));
  const loggersByDay = new Map(logsByDay.map((r) => [r.day, r.loggers]));
  const units = (from: string, to = today) => {
    const t = { qa: 0, rc: 0, va: 0, dilr: 0 };
    for (const r of sectionsByDay) if (r.day >= from && r.day <= to && r.section in t) t[r.section] += r.units ?? 0;
    return t;
  };
  const distinctLoggers = (from: string, to = today) => {
    const s = new Set<string>();
    for (const r of logDays) if (r.date >= from && r.date <= to) s.add(r.userId);
    return s.size;
  };
  const logWindow = (from: string, to = today) => ({ entries: sumDays(entriesByDay, from, to), loggers: distinctLoggers(from, to), units: units(from, to) });
  const logs = {
    today: logWindow(today),
    yesterday: logWindow(yesterday, yesterday),
    thisWeek: logWindow(weekStart),
    lastWeek: logWindow(lastWeekStart, addDays(weekStart, -1)),
    last30: logWindow(addDays(today, -29)),
    series: days30.map((d) => ({ date: d, value: entriesByDay.get(d) ?? 0 })),
    loggersSeries: days30.map((d) => ({ date: d, value: loggersByDay.get(d) ?? 0 })),
  };

  // ---------- Friends ----------
  const friendCount = new Map<string, number>();
  for (const f of friendRows) if (f.status === "accepted") for (const id of [f.a, f.b]) friendCount.set(id, (friendCount.get(id) ?? 0) + 1);

  // ---------- Per-user rows ----------
  const logs7 = new Map(logsByUser7.map((r) => [r.userId, r.n]));
  const mocksBy = new Map(mocksByUser.map((r) => [r.userId, r.n]));
  const activeDaysOf = (id: string, from: string) => {
    let n = 0;
    for (const [d, ids] of activeByDay) if (d >= from && ids.has(id)) n++;
    return n;
  };
  const people: AdminUser[] = userRows.map((u) => ({
    id: u.id, name: u.name, email: u.email, image: u.image, username: u.username,
    onboarded: !!u.onboarded,
    onboardedOn: u.onboardedOn,
    targetPercentile: u.targetPercentile, dreamColleges: u.dreamColleges, weakSections: u.weakSections,
    why: u.why, studyStartHour: u.studyStartHour, studyEndHour: u.studyEndHour,
    visibility: u.visibility, pushOn: !!u.notifyPush && (u.pushSubscriptions?.length ?? 0) > 0,
    lastActive: lastActive.get(u.id) ?? null,
    activeDays7: activeDaysOf(u.id, addDays(today, -6)),
    activeDays30: activeDaysOf(u.id, addDays(today, -29)),
    requests30: hitsByUser30.get(u.id) ?? 0,
    logs7: logs7.get(u.id) ?? 0,
    mocks: mocksBy.get(u.id) ?? 0,
    friends: friendCount.get(u.id) ?? 0,
  }));
  const onboarded = people.filter((p) => p.onboarded);

  // ---------- Signups (onboarding date; users has no created-at column) ----------
  const onboardedByDay = new Map<string, number>();
  for (const p of onboarded) if (p.onboardedOn) onboardedByDay.set(p.onboardedOn, (onboardedByDay.get(p.onboardedOn) ?? 0) + 1);

  // ---------- Weekly retention by onboarding week ----------
  // Row = users who onboarded in that Mon–Sun week; cell k = share of them active in week k after it.
  const cohortWeeks = Array.from({ length: 6 }, (_, i) => addDays(weekStart, -7 * (5 - i)));
  const cohorts = cohortWeeks.map((ws) => {
    const members = onboarded.filter((p) => p.onboardedOn && weekStartOf(p.onboardedOn) === ws).map((p) => p.id);
    const weeksSince = diffDays(weekStart, ws) / 7;
    const retained = Array.from({ length: weeksSince + 1 }, (_, k) => {
      const active = activeIn(addDays(ws, 7 * k), addDays(ws, 7 * k + 6));
      return members.length ? members.filter((id) => active.has(id)).length / members.length : null;
    });
    return { weekStart: ws, size: members.length, retained };
  });

  // Onboarded, used the app in the last 30 days, but nothing in the last 3: the ones to nudge.
  const atRisk = onboarded
    .filter((p) => p.lastActive && p.lastActive < addDays(today, -2) && p.lastActive >= addDays(today, -29))
    .sort((a, b) => (b.lastActive ?? "").localeCompare(a.lastActive ?? ""));
  const neverActive = onboarded.filter((p) => !p.lastActive).length;

  // ---------- Notifications & AI ----------
  const notif = { today: 0, week: 0, byKind: new Map<string, number>() };
  for (const r of notifByKind) {
    notif.week += r.n;
    if (r.day === today) notif.today += r.n;
    notif.byKind.set(r.kind, (notif.byKind.get(r.kind) ?? 0) + r.n);
  }
  const aiByDay = new Map(aiRows.map((r) => [r.date, r.count]));

  // ---------- Who the users are ----------
  const tally = (values: string[]) => {
    const m = new Map<string, { label: string; n: number }>();
    for (const v of values) {
      const key = v.trim().toLowerCase();
      if (!key) continue;
      const e = m.get(key) ?? { label: v.trim(), n: 0 };
      e.n++;
      m.set(key, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  };
  const targetBands = [
    { label: "99+", test: (t: number) => t >= 99 },
    { label: "95–98.9", test: (t: number) => t >= 95 && t < 99 },
    { label: "90–94.9", test: (t: number) => t >= 90 && t < 95 },
    { label: "Below 90", test: (t: number) => t < 90 },
  ].map((b) => ({ label: b.label, n: onboarded.filter((p) => p.targetPercentile != null && b.test(p.targetPercentile)).length }));

  return {
    today, yesterday, weekStart, trackingSince,
    users: {
      total: people.length,
      onboarded: onboarded.length,
      notOnboarded: people.length - onboarded.length,
      onboardedToday: onboardedByDay.get(today) ?? 0,
      onboarded7: sumDays(onboardedByDay, addDays(today, -6)),
      onboarded30: sumDays(onboardedByDay, addDays(today, -29)),
      onboardedSeries: days30.map((d) => ({ date: d, value: onboardedByDay.get(d) ?? 0 })),
      public: onboarded.filter((p) => p.visibility === "public").length,
      pushOn: onboarded.filter((p) => p.pushOn).length,
      neverActive,
    },
    active: {
      dau, wau, mau,
      yesterday: activeByDay.get(yesterday)?.size ?? 0,
      avgDau30,
      stickiness: mau ? avgDau30 / mau : null,
      series: dauSeries,
      todayIds: [...(activeByDay.get(today) ?? [])],
    },
    requests: {
      today: hitsByDay.get(today) ?? 0,
      yesterday: hitsByDay.get(yesterday) ?? 0,
      last7: sumDays(hitsByDay, addDays(today, -6)),
      last30: sumDays(hitsByDay, addDays(today, -29)),
      series: days30.map((d) => ({ date: d, value: hitsByDay.get(d) ?? 0 })),
    },
    logs,
    mocks: {
      total: mocksByUser.reduce((a, r) => a + r.n, 0),
      today: mocksByDay.find((r) => r.day === today)?.n ?? 0,
      last7: mocksByDay.reduce((a, r) => a + r.n, 0),
      avgScore30: mockAvg[0]?.n ? mockAvg[0].avg : null,
      scored30: mockAvg[0]?.n ?? 0,
      sectionals7: sectionalsByDay.reduce((a, r) => a + r.n, 0),
    },
    goalsThisWeek: goalsThisWeek[0]?.n ?? 0,
    friends: {
      accepted: friendRows.filter((f) => f.status === "accepted").length,
      pending: friendRows.filter((f) => f.status === "pending").length,
      withFriend: onboarded.filter((p) => p.friends > 0).length,
      pairs: friendRows.map((f): Friendship => ({ a: f.a, b: f.b, status: f.status, since: f.since })),
    },
    notifications: { ...notif, byKind: [...notif.byKind].sort((a, b) => b[1] - a[1]) },
    ai: { today: aiByDay.get(today) ?? 0, budget: AI_BUDGET, last7: sumDays(aiByDay, addDays(today, -6)) },
    cohorts, atRisk,
    audience: {
      targets: targetBands,
      colleges: tally(onboarded.flatMap((p) => p.dreamColleges ?? [])).slice(0, 10),
      weak: SECTIONS.map((s) => ({ section: s, n: onboarded.filter((p) => p.weakSections?.includes(s)).length })),
    },
    people,
  };
}

export type AdminStats = Awaited<ReturnType<typeof loadAdminStats>>;

/** Distinct (user, IST day) pairs on which the user wrote to a table. */
function activeDaysFrom(userCol: PgColumn, createdCol: PgColumn, since: string) {
  const day = istDay(createdCol);
  return db.selectDistinct({ userId: sql<string>`${userCol}`, date: day })
    .from(userCol.table).where(gte(day, since));
}

function groupByDay<T extends Record<string, SQL.Aliased | SQL>>(createdCol: PgColumn, fields: T, since: string) {
  const day = istDay(createdCol);
  return db.select({ day, ...fields }).from(createdCol.table).where(gte(day, since)).groupBy(day);
}
