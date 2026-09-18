import type { Targets } from "@/db/schema";

// CAT 2026 — Sunday 29 Nov 2026 (IIM Indore notification, 26 Jul 2026).
export const EXAM_DATE = "2026-11-29";

export const SECTIONS = ["qa", "rc", "va", "dilr"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_META: Record<Section, { label: string; short: string; unit: string; unitOne: string; step: number }> = {
  qa: { label: "Quant", short: "QA", unit: "Qs", unitOne: "Q", step: 5 },
  rc: { label: "Reading Comp.", short: "RC", unit: "passages", unitOne: "passage", step: 1 },
  va: { label: "Verbal Ability", short: "VA", unit: "Qs", unitOne: "Q", step: 5 },
  dilr: { label: "DI & LR", short: "DILR", unit: "sets", unitOne: "set", step: 1 },
};

// ---------- Realistic time model ----------
// Exam pace, from what a well-prepared candidate actually does in a 40-min section:
//   QA   ~15 attempted  → 40/15 ≈ 2.7 min per question
//   VARC ~16 attempted  → 2.5 min per question; an RC passage (~4 Qs incl. reading) ≈ 10 min
//   DILR ~2.5 sets      → 40/2.5 = 16 min per set
// Practice is slower than exam pace: you also check solutions and review mistakes.
// That overhead starts at 1.6× and eases linearly to 1.25× by CAT day as speed builds.
export const EXAM_PACE: Record<Section, number> = { qa: 2.7, rc: 10, va: 2.5, dilr: 16 };
export const PRACTICE_OVERHEAD = { start: 1.6, peak: 1.25, horizonDays: 90 } as const;

export const MOCK_MINUTES = 120;
export const ANALYSIS_MINUTES = 150; // a proper mock analysis takes longer than the mock

export const ZERO: Targets = { qa: 0, rc: 0, va: 0, dilr: 0 };

// ---------- IST date helpers (IST is UTC+5:30, no DST) ----------
const IST_OFFSET_MIN = 330;

export function istNow(now: Date = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  const date = ist.toISOString().slice(0, 10);
  const hour = ist.getUTCHours() + ist.getUTCMinutes() / 60;
  return { date, hour };
}

export function addDays(date: string, n: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string) {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86_400_000);
}

export function weekday(date: string) {
  return new Date(date + "T00:00:00Z").getUTCDay(); // 0 = Sun
}

export function daysToExam(today: string) {
  return diffDays(EXAM_DATE, today);
}

export function fmtDate(date: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
}

export function fmtHour(h: number) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  const ampm = hh >= 12 ? "PM" : "AM";
  return `${hh % 12 || 12}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${ampm}`;
}

/** 0 → 1 as CAT approaches (0 at ≥90 days out, 1 on CAT day). */
export function speedProgress(date: string) {
  const left = diffDays(EXAM_DATE, date);
  return Math.min(1, Math.max(0, 1 - left / PRACTICE_OVERHEAD.horizonDays));
}

/** Realistic practice minutes per unit (question / passage / set) on a given date. */
export function unitMinutes(section: Section, date: string) {
  const t = speedProgress(date);
  const overhead = PRACTICE_OVERHEAD.start + (PRACTICE_OVERHEAD.peak - PRACTICE_OVERHEAD.start) * t;
  return EXAM_PACE[section] * overhead;
}

export function unitLabel(section: Section, n: number) {
  const m = SECTION_META[section];
  return `${n} ${m.short} ${n === 1 ? m.unitOne : m.unit}`;
}

/** Monday of the IST week containing `date`. */
export function weekStartOf(date: string) {
  return addDays(date, -((weekday(date) + 6) % 7));
}
