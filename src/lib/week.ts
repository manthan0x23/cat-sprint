import type { Targets } from "@/db/schema";
import { addDays, diffDays, SECTIONS, weekStartOf } from "./cat";

export type WeekGoal = { targets: Targets; mocks: number } | null;

export type WeekStatus = {
  weekStart: string;
  weekEnd: string;
  daysLeft: number; // including today
  goal: WeekGoal;
  done: Targets;
  mocksDone: number;
  planned: Targets; // what the current (editable) daily plan adds up to this week
  plannedMocks: number;
  pct: number | null; // overall completion vs goal, 0..1 (sections weighted equally)
  perDayNeeded: Targets | null; // what's left ÷ days left
  planBelowGoal: (keyof Targets)[]; // sections where the day-by-day plan no longer covers the locked goal
};

export function weekStatus(input: {
  today: string;
  plans: { date: string; type: string; targets: Targets; mockDone: boolean }[];
  doneByDate: Record<string, Targets>;
  goal: WeekGoal;
}): WeekStatus {
  const weekStart = weekStartOf(input.today);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
  const zero = (): Targets => ({ qa: 0, rc: 0, va: 0, dilr: 0 });

  const done = zero();
  for (const [d, t] of Object.entries(input.doneByDate)) if (inWeek(d)) for (const k of SECTIONS) done[k] += t[k];
  const weekPlans = input.plans.filter((p) => inWeek(p.date));
  const planned = zero();
  for (const p of weekPlans) if (p.type !== "rest") for (const k of SECTIONS) planned[k] += p.targets[k];
  const plannedMocks = weekPlans.filter((p) => p.type === "mock").length;
  const mocksDone = weekPlans.filter((p) => p.type === "mock" && p.mockDone).length;
  const daysLeft = diffDays(weekEnd, input.today) + 1;

  const g = input.goal;
  let pct: number | null = null;
  let perDayNeeded: Targets | null = null;
  const planBelowGoal: (keyof Targets)[] = [];
  if (g) {
    const parts = SECTIONS.filter((k) => g.targets[k] > 0).map((k) => Math.min(1, done[k] / g.targets[k]));
    if (g.mocks > 0) parts.push(Math.min(1, mocksDone / g.mocks));
    pct = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 1;
    perDayNeeded = zero();
    for (const k of SECTIONS) {
      perDayNeeded[k] = Math.ceil(Math.max(0, g.targets[k] - done[k]) / Math.max(1, daysLeft));
      if (planned[k] < g.targets[k]) planBelowGoal.push(k);
    }
  }
  return { weekStart, weekEnd, daysLeft, goal: g, done, mocksDone, planned, plannedMocks, pct, perDayNeeded, planBelowGoal };
}
