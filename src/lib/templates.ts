import type { PhaseDef, Targets } from "@/db/schema";
import type { Section } from "./cat";

export type TemplateDef = {
  id: string;
  name: string;
  description: string;
  practice: Targets;
  mock: Targets;
  mocksPerWeek: number;
  finalStretchMocksPerWeek: number;
  phases?: PhaseDef[] | null;
};

export const SYSTEM_TEMPLATES: TemplateDef[] = [
  {
    id: "sys-grind",
    name: "High-volume grind",
    description: "Your plan: 50 QA · 10 RC passages · 15 VA · 5 DILR sets on practice days; mock + full analysis with a light top-up on mock days. Very heavy, roughly 9h a day.",
    practice: { qa: 50, rc: 10, va: 15, dilr: 5 },
    mock: { qa: 15, rc: 3, va: 5, dilr: 1 },
    mocksPerWeek: 2,
    finalStretchMocksPerWeek: 3,
  },
  {
    id: "sys-pro",
    name: "Working professional",
    description: "Fits around a 9–6 job. 25 QA · 3 RC passages · 10 VA · 2 DILR sets (~4h); mock days are mock + analysis only.",
    practice: { qa: 25, rc: 3, va: 10, dilr: 2 },
    mock: { qa: 0, rc: 0, va: 0, dilr: 0 },
    mocksPerWeek: 2,
    finalStretchMocksPerWeek: 2,
  },
  {
    id: "sys-mockheavy",
    name: "Mock-heavy final stretch",
    description: "Lean on mocks: 3/week now, alternate days in the final 3 weeks. 25 QA · 3 RC passages · 8 VA · 2 DILR sets between them.",
    practice: { qa: 25, rc: 3, va: 8, dilr: 2 },
    mock: { qa: 0, rc: 0, va: 0, dilr: 0 },
    mocksPerWeek: 3,
    finalStretchMocksPerWeek: 4,
  },
  {
    id: "sys-weakness",
    name: "Weakness focus",
    description: "Doubles your weakest sections (from onboarding) and trims the rest by 30%. Base: 35 QA · 4 RC passages · 10 VA · 3 DILR sets.",
    practice: { qa: 35, rc: 4, va: 10, dilr: 3 },
    mock: { qa: 0, rc: 0, va: 0, dilr: 0 },
    mocksPerWeek: 2,
    finalStretchMocksPerWeek: 3,
  },
];

export function applyWeakness(t: Targets, weak: Section[]): Targets {
  if (!weak.length) return t;
  const out = { ...t };
  for (const k of Object.keys(out) as Section[]) {
    out[k] = weak.includes(k) ? Math.round(t[k] * 2) : Math.round(t[k] * 0.7);
  }
  return out;
}
