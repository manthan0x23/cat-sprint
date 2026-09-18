import type { Targets } from "@/db/schema";
import { ANALYSIS_MINUTES, MOCK_MINUTES, SECTIONS, addDays, diffDays, EXAM_DATE } from "./cat";

// Everything here is pure so it can be unit-tested and reused by the dashboard + cron.

export type PlanDay = {
  date: string;
  type: "practice" | "mock" | "rest";
  targets: Targets;
  mockDone?: boolean;
  analysisDone?: boolean;
};

export type MockPoint = { date: string; percentile: number };

export function effort(t: Targets, unitMinutes: Record<keyof Targets, number>) {
  return SECTIONS.reduce((s, k) => s + (t[k] ?? 0) * unitMinutes[k], 0);
}

export const UNIT_MINUTES = { qa: 2, rc: 2.5, va: 1.5, dilr: 12 } as const;

export function plannedMinutes(p: PlanDay) {
  if (p.type === "rest") return 0;
  return effort(p.targets, UNIT_MINUTES) + (p.type === "mock" ? MOCK_MINUTES + ANALYSIS_MINUTES : 0);
}

export function doneMinutes(p: PlanDay | undefined, done: Targets) {
  let m = effort(done, UNIT_MINUTES);
  if (p?.type === "mock") {
    if (p.mockDone) m += MOCK_MINUTES;
    if (p.analysisDone) m += ANALYSIS_MINUTES;
  }
  return m;
}

/** Share of the study window that has elapsed at `hour` (IST, fractional). */
export function expectedFraction(hour: number, start: number, end: number) {
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (hour - start) / (end - start)));
}

export type DayRow = { date: string; planned: number; done: number; ratio: number; type: PlanDay["type"] };

export type Stats = {
  today: DayRow;
  todayExpected: number; // minutes that "should" be done by now
  todayStatus: "ahead" | "on-track" | "behind" | "way-behind" | "not-started" | "rest";
  debtMinutes: number; // unfinished planned work from past days (net of over-delivery)
  remainingDays: number; // study days from today to exam (incl. today)
  remainingPlanned: number; // minutes planned from today to exam
  extraPerDay: number; // minutes/day to add to clear debt by CAT
  consistency: number; // 0..1.2, done/planned over last 14 past days
  streak: number;
  history: DayRow[]; // past days + today, oldest first
  series: { date: string; plannedCum: number; doneCum?: number; projectedCum?: number }[];
  projectedTotal: number; // minutes delivered by CAT at current consistency
  planTotal: number; // minutes if you follow the plan perfectly from here
};

export function computeStats(input: {
  plans: PlanDay[];
  doneByDate: Record<string, Targets>;
  today: string;
  hour: number;
  window: { start: number; end: number };
  exam?: string;
}): Stats {
  const exam = input.exam ?? EXAM_DATE;
  const plans = [...input.plans].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(plans.map((p) => [p.date, p]));
  const zero: Targets = { qa: 0, rc: 0, va: 0, dilr: 0 };

  const history: DayRow[] = [];
  for (const p of plans) {
    if (p.date > input.today) break;
    const planned = plannedMinutes(p);
    const done = doneMinutes(p, input.doneByDate[p.date] ?? zero);
    history.push({ date: p.date, planned, done, ratio: planned ? done / planned : 1, type: p.type });
  }
  const todayPlan = byDate.get(input.today);
  const todayRow: DayRow =
    history.find((h) => h.date === input.today) ??
    { date: input.today, planned: 0, done: doneMinutes(undefined, input.doneByDate[input.today] ?? zero), ratio: 1, type: "rest" };

  const past = history.filter((h) => h.date < input.today);
  const debtMinutes = Math.max(0, past.reduce((s, h) => s + h.planned - h.done, 0));

  const future = plans.filter((p) => p.date >= input.today && p.date < exam);
  const remainingDays = future.filter((p) => p.type !== "rest").length;
  const remainingPlanned = future.reduce((s, p) => s + plannedMinutes(p), 0);
  const extraPerDay = remainingDays ? debtMinutes / remainingDays : 0;

  const last14 = past.slice(-14).filter((h) => h.planned > 0);
  const consistency = last14.length
    ? Math.min(1.2, last14.reduce((s, h) => s + Math.min(h.done, h.planned * 1.5), 0) / last14.reduce((s, h) => s + h.planned, 0))
    : 1;

  let streak = 0;
  if (todayRow.planned > 0 && todayRow.ratio >= 0.8) streak++;
  for (let i = past.length - 1; i >= 0; i--) {
    if (past[i].planned === 0) continue; // rest days don't break streaks
    if (past[i].ratio >= 0.8) streak++;
    else break;
  }

  const frac = expectedFraction(input.hour, input.window.start, input.window.end);
  const todayExpected = todayRow.planned * frac;
  let todayStatus: Stats["todayStatus"];
  if (!todayPlan || todayRow.planned === 0) todayStatus = "rest";
  else if (todayRow.done === 0 && frac > 0.15) todayStatus = "way-behind";
  else if (todayRow.done === 0) todayStatus = "not-started";
  else {
    const doneFrac = todayRow.done / todayRow.planned;
    if (doneFrac >= frac + 0.1) todayStatus = "ahead";
    else if (doneFrac >= frac - 0.15) todayStatus = "on-track";
    else if (doneFrac >= frac - 0.35) todayStatus = "behind";
    else todayStatus = "way-behind";
  }

  // Cumulative series: plan line for all days, done line up to today, projection after today.
  const series: Stats["series"] = [];
  let pc = 0, dc = 0;
  const doneSoFar = past.reduce((s, h) => s + h.done, 0) + todayRow.done;
  let proj = doneSoFar;
  for (const p of plans) {
    pc += plannedMinutes(p);
    if (p.date < input.today) {
      dc += history.find((h) => h.date === p.date)?.done ?? 0;
      series.push({ date: p.date, plannedCum: pc, doneCum: dc });
    } else if (p.date === input.today) {
      dc += todayRow.done;
      series.push({ date: p.date, plannedCum: pc, doneCum: dc, projectedCum: dc });
    } else {
      proj += plannedMinutes(p) * Math.min(consistency, 1);
      series.push({ date: p.date, plannedCum: pc, projectedCum: proj });
    }
  }
  const futureAfterToday = plans.filter((p) => p.date > input.today).reduce((s, p) => s + plannedMinutes(p), 0);
  const projectedTotal = doneSoFar + futureAfterToday * Math.min(consistency, 1) + Math.max(0, todayRow.planned - todayRow.done) * Math.min(consistency, 1);
  const planTotal = doneSoFar + futureAfterToday + Math.max(0, todayRow.planned - todayRow.done);

  return {
    today: todayRow,
    todayExpected,
    todayStatus,
    debtMinutes,
    remainingDays,
    remainingPlanned,
    extraPerDay,
    consistency,
    streak,
    history,
    series,
    projectedTotal,
    planTotal,
  };
}

// ---------- Percentile projection ----------
// Deliberately simple and explainable:
//   1. Look at your "gap to 100" in each mock (80 %ile -> gap 20). Gains get harder near
//      the top, so we model the gap shrinking by a fixed % per day (fit a line to ln(gap)).
//   2. That shrink rate is scaled by your consistency: practice is what turns the trend
//      into reality. A worsening trend is not softened.
//   3. The rate is capped (gap can at most halve every ~46 days) so one lucky mock
//      can't dominate. Result is clamped to [0, 99.9].
export type Projection = {
  projected: number;
  base: number; // fitted percentile today
  rate: number; // raw daily change in ln(gap) (negative = improving)
  effectiveRate: number;
  perWeekNow: number; // %ile gained per week at today's level and effective rate
  mocks: number;
};

const MAX_IMPROVE_RATE = -0.015;
const MAX_DECLINE_RATE = 0.015;

export function projectPercentile(mocks: MockPoint[], today: string, consistency: number, exam = EXAM_DATE): Projection | null {
  if (mocks.length < 2) return null;
  const xs = mocks.map((m) => diffDays(m.date, today));
  const ys = mocks.map((m) => Math.log(Math.max(0.1, 100 - Math.min(99.9, m.percentile))));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  let rate = sxx === 0 ? 0 : sxy / sxx;
  rate = Math.max(MAX_IMPROVE_RATE, Math.min(MAX_DECLINE_RATE, rate));
  const gapToday = Math.exp(my - rate * mx);
  const base = Math.max(0, Math.min(99.9, 100 - gapToday));
  const c = Math.max(0, Math.min(1.2, consistency));
  const effectiveRate = rate < 0 ? rate * c : rate;
  const daysLeft = Math.max(0, diffDays(exam, today));
  const projected = Math.max(0, Math.min(99.9, 100 - gapToday * Math.exp(effectiveRate * daysLeft)));
  const perWeekNow = gapToday * (1 - Math.exp(effectiveRate * 7));
  return { projected, base, rate, effectiveRate, perWeekNow, mocks: n };
}

/** What skipping today does to consistency and to the projection. */
export function skipImpact(stats: Stats, mocks: MockPoint[], today: string) {
  const planned14 = stats.history.filter((h) => h.date < today).slice(-13).filter((h) => h.planned > 0);
  const basePlanned = planned14.reduce((s, h) => s + h.planned, 0);
  const baseDone = planned14.reduce((s, h) => s + Math.min(h.done, h.planned * 1.5), 0);
  const tp = stats.today.planned;
  const ifDone = basePlanned + tp ? Math.min(1.2, (baseDone + tp) / (basePlanned + tp)) : 1;
  const ifSkip = basePlanned + tp ? Math.min(1.2, baseDone / (basePlanned + tp)) : 1;
  const pDone = projectPercentile(mocks, today, ifDone);
  const pSkip = projectPercentile(mocks, today, ifSkip);
  return {
    consistencyIfDone: ifDone,
    consistencyIfSkip: ifSkip,
    percentileIfDone: pDone?.projected ?? null,
    percentileIfSkip: pSkip?.projected ?? null,
    debtAddedMinutes: Math.max(0, tp - stats.today.done),
    extraPerDayIfSkip: stats.remainingDays > 1 ? (stats.debtMinutes + Math.max(0, tp - stats.today.done)) / (stats.remainingDays - 1) : 0,
  };
}

export function sumLogs(logs: { date: string; section: keyof Targets; count: number }[]) {
  const out: Record<string, Targets> = {};
  for (const l of logs) {
    out[l.date] ??= { qa: 0, rc: 0, va: 0, dilr: 0 };
    out[l.date][l.section] += l.count;
  }
  return out;
}

export function minutesToH(m: number) {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h ? `${h}h${mm ? " " + mm + "m" : ""}` : `${mm}m`;
}

export { addDays };
