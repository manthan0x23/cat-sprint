import type { Targets } from "@/db/schema";

// CAT 2026 — Sunday 29 Nov 2026 (IIM Indore notification, 26 Jul 2026).
export const EXAM_DATE = "2026-11-29";

export const SECTIONS = ["qa", "rc", "va", "dilr"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_META: Record<Section, { label: string; short: string; unit: string; minutes: number; step: number }> = {
  qa: { label: "Quant", short: "QA", unit: "Qs", minutes: 2, step: 5 },
  rc: { label: "Reading Comp.", short: "RC", unit: "Qs", minutes: 2.5, step: 2 },
  va: { label: "Verbal Ability", short: "VA", unit: "Qs", minutes: 1.5, step: 5 },
  dilr: { label: "DI & LR", short: "DILR", unit: "sets", minutes: 12, step: 1 },
};

export const MOCK_MINUTES = 120;
export const ANALYSIS_MINUTES = 120;

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
