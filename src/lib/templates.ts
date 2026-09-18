import type { Targets } from "@/db/schema";
import type { Section } from "./cat";

export type TemplateDef = {
  id: string;
  name: string;
  description: string;
  practice: Targets;
  mock: Targets;
  mocksPerWeek: number;
  finalStretchMocksPerWeek: number;
};

export const SYSTEM_TEMPLATES: TemplateDef[] = [
  {
    id: "sys-grind",
    name: "High-volume grind",
    description: "High-volume grind. 50 QA · 10 RC · 15 VA · 5 DILR sets on practice days; mock + full analysis on mock days with a light top-up.",
    practice: { qa: 50, rc: 10, va: 15, dilr: 5 },
    mock: { qa: 15, rc: 3, va: 5, dilr: 1 },
    mocksPerWeek: 2,
    finalStretchMocksPerWeek: 3,
  },
  {
    id: "sys-pro",
    name: "Working professional",
    description: "Fits around a 9–6 job. 30 QA · 6 RC · 10 VA · 3 DILR sets; mock days are mock + analysis only.",
    practice: { qa: 30, rc: 6, va: 10, dilr: 3 },
    mock: { qa: 0, rc: 0, va: 0, dilr: 0 },
    mocksPerWeek: 2,
    finalStretchMocksPerWeek: 2,
  },
  {
    id: "sys-mockheavy",
    name: "Mock-heavy final stretch",
    description: "Lean on mocks: 3/week now, alternate days in the final 3 weeks. 30 QA · 6 RC · 10 VA · 3 DILR between them.",
    practice: { qa: 30, rc: 6, va: 10, dilr: 3 },
    mock: { qa: 10, rc: 2, va: 5, dilr: 1 },
    mocksPerWeek: 3,
    finalStretchMocksPerWeek: 4,
  },
  {
    id: "sys-weakness",
    name: "Weakness focus",
    description: "Doubles your weakest sections (from onboarding) and trims the rest by 30%. Base: 40 QA · 8 RC · 12 VA · 4 DILR.",
    practice: { qa: 40, rc: 8, va: 12, dilr: 4 },
    mock: { qa: 10, rc: 2, va: 5, dilr: 1 },
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
