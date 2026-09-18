import type { Targets } from "@/db/schema";
import { addDays, diffDays, EXAM_DATE, weekday, type Section } from "./cat";
import { applyWeakness, type TemplateDef } from "./templates";

export type GeneratedDay = {
  date: string;
  type: "practice" | "mock" | "rest";
  targets: Targets;
  mockName: string | null;
  note: string | null;
  tag: string | null; // short label shown on the calendar
};

// ---------- How the plan is built ----------
// Phases (days before CAT):
//   Build  (> 42)   template.mocksPerWeek
//   Ramp   (22–42)  halfway between build and peak
//   Peak   (4–21)   template.finalStretchMocksPerWeek
//   Last week (≤ 6) no new mocks (last full mock = the Sunday a week before CAT)
//   Taper  (1–3)    revision only; day before CAT = rest
// Mock placement: preferred weekdays per frequency, Sunday first (CAT is on a Sunday,
// so Sunday mocks rehearse the real slot). Hard rule: never two mocks within MIN_GAP days.
// Around each mock: the day after = review day (fix mistakes, lighter targets);
// the day before a Sunday mock = light day (sleep early).
// Practice days rotate a section focus so the same targets aren't repeated daily;
// weak sections appear twice in the rotation.

export const PHASES = { rampFrom: 42, peakFrom: 21, noMocksFrom: 6, taperFrom: 3 } as const;
const MIN_GAP = 2; // at least 1 non-mock day between mocks, always

// 0=Sun … 6=Sat. Chosen so mocks are spread through the week, never adjacent.
const PREFERRED: Record<number, number[]> = {
  0: [],
  1: [0],
  2: [0, 3],
  3: [0, 3, 5],
};

function scale(t: Targets, f: number): Targets {
  return { qa: Math.round(t.qa * f), rc: Math.round(t.rc * f), va: Math.round(t.va * f), dilr: Math.round(t.dilr * f) };
}

type Focus = "balanced" | Section | "varc";
const FOCUS_LABEL: Record<Focus, string> = { balanced: "Balanced", qa: "QA focus", rc: "RC focus", va: "VA focus", dilr: "DILR focus", varc: "VARC focus" };

function focusTargets(base: Targets, f: Focus): Targets {
  if (f === "balanced") return base;
  const boost = (k: Section) => (f === "varc" ? k === "rc" || k === "va" : k === f);
  const out = { ...base };
  for (const k of Object.keys(out) as Section[]) out[k] = Math.round(base[k] * (boost(k) ? 1.35 : 0.85));
  return out;
}

export function mocksPerWeekFor(left: number, t: TemplateDef) {
  if (left <= PHASES.noMocksFrom) return 0;
  if (left <= PHASES.peakFrom) return t.finalStretchMocksPerWeek;
  if (left <= PHASES.rampFrom) return Math.floor((t.mocksPerWeek + t.finalStretchMocksPerWeek) / 2);
  return t.mocksPerWeek;
}

export function phaseOf(left: number) {
  if (left <= 0) return "exam";
  if (left <= PHASES.taperFrom) return "taper";
  if (left <= PHASES.noMocksFrom) return "final";
  if (left <= PHASES.peakFrom) return "peak";
  if (left <= PHASES.rampFrom) return "ramp";
  return "build";
}

/** Picks mock dates between start and exam following the phase frequency + spacing rules. */
export function pickMockDates(start: string, exam: string, t: TemplateDef): string[] {
  const out: string[] = [];
  // Never on day one: give at least a day to prepare for the first mock.
  let last: string | null = addDays(start, -1);
  for (let d = start; diffDays(exam, d) > 0; d = addDays(d, 1)) {
    const left = diffDays(exam, d);
    const perWeek = mocksPerWeekFor(left, t);
    if (!perWeek) continue;
    if (last && diffDays(d, last) < MIN_GAP) continue;
    // 4+/week (mock-heavy): every other day regardless of weekday
    const ok = perWeek >= 4
      ? !last || diffDays(d, last) >= 2
      : (PREFERRED[Math.min(3, perWeek)] ?? []).includes(weekday(d));
    if (ok) { out.push(d); last = d; }
  }
  return out;
}

export function generatePlan(opts: { start: string; template: TemplateDef; weak?: Section[]; exam?: string }): GeneratedDay[] {
  const exam = opts.exam ?? EXAM_DATE;
  const { template } = opts;
  const weak = opts.weak ?? [];
  const w = template.id === "sys-weakness" ? weak : [];
  const practice = applyWeakness(template.practice, w);
  const mock = applyWeakness(template.mock, w);

  const mocks = new Set(pickMockDates(opts.start, exam, template));

  // Focus rotation, weak sections doubled
  const rotation: Focus[] = ["balanced", "qa", "varc", "dilr"];
  for (const s of weak) rotation.push(s === "rc" || s === "va" ? "varc" : s);
  let rot = 0;

  const days: GeneratedDay[] = [];
  let mockNo = 0;
  for (let d = opts.start; diffDays(exam, d) >= 0; d = addDays(d, 1)) {
    const left = diffDays(exam, d);
    const zero = { qa: 0, rc: 0, va: 0, dilr: 0 };
    if (left === 0) { days.push({ date: d, type: "rest", targets: zero, mockName: null, note: "CAT 2026. You've done the work.", tag: "CAT" }); continue; }
    if (left === 1) { days.push({ date: d, type: "rest", targets: zero, mockName: null, note: "Rest. Check admit card, centre route, ID. Sleep by 10.", tag: "Rest" }); continue; }
    if (left <= PHASES.taperFrom) {
      days.push({ date: d, type: "practice", targets: scale(practice, 0.4), mockName: null, note: "Taper: revise formulas + your mock error log. No new mocks.", tag: "Taper" });
      continue;
    }
    if (mocks.has(d)) {
      mockNo++;
      const sunday = weekday(d) === 0;
      days.push({
        date: d, type: "mock", targets: mock, mockName: `Mock ${mockNo}`,
        note: `${sunday ? "Take it at your CAT slot time. " : ""}Analyse the same day: every wrong + skipped question.`,
        tag: null,
      });
      continue;
    }
    const afterMock = mocks.has(addDays(d, -1));
    // Light day only before the Sunday (CAT-slot) mock, so weekday volume isn't lost.
    const beforeMock = mocks.has(addDays(d, 1)) && weekday(addDays(d, 1)) === 0;
    if (afterMock) {
      days.push({ date: d, type: "practice", targets: scale(practice, 0.6), mockName: null, note: `Review day: redo Mock ${mockNo}'s mistakes first, then practise its weakest section.`, tag: "Review" });
      continue;
    }
    if (beforeMock) {
      days.push({ date: d, type: "practice", targets: scale(practice, 0.7), mockName: null, note: "Light day before a mock. Stop early, sleep on time.", tag: "Light" });
      continue;
    }
    if (left <= PHASES.noMocksFrom) {
      days.push({ date: d, type: "practice", targets: scale(practice, 0.7), mockName: null, note: "Final week: no new mocks. Re-attempt old mock sections, revise your error log.", tag: "Consolidate" });
      continue;
    }
    const focus = rotation[rot++ % rotation.length];
    days.push({ date: d, type: "practice", targets: focusTargets(practice, focus), mockName: null, note: null, tag: FOCUS_LABEL[focus] });
  }
  return days;
}
