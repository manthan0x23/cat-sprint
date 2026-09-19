"use client";
import { useOptimistic, useState, useTransition } from "react";
import clsx from "clsx";
import Link from "next/link";
import { Check, Coffee, Minus, Plus, Undo2 } from "lucide-react";
import type { Sectionals, Targets } from "@/db/schema";
import { SECTIONS, SECTION_META, unitMinutes, type Section } from "@/lib/cat";
import { minutesToH } from "@/lib/progress";
import { logProgress, toggleMockFlag, undoLastLog } from "@/app/actions";

type Plan = {
  date: string; type: "practice" | "mock" | "rest"; targets: Targets; mockName: string | null;
  mockDone: boolean; analysisDone: boolean; note: string | null; tag?: string | null; sectionals?: Sectionals | null;
} | null;

const SECTIONAL_LABEL = { varc: "VARC", dilr: "DILR", qa: "QA" } as const;

const MOCK_MIN = 120;
const ANALYSIS_MIN = 150;

export function TodayCard({ plan, done, today, sectionalsDone }: { plan: Plan; done: Targets; today: string; sectionalsDone: Sectionals }) {
  const [, start] = useTransition();
  const [counts, add] = useOptimistic(done, (cur, { s, n }: { s: Section; n: number }) => ({ ...cur, [s]: Math.max(0, cur[s] + n) }));
  const [flags, setFlag] = useOptimistic(
    { mockDone: plan?.mockDone ?? false, analysisDone: plan?.analysisDone ?? false },
    (cur, u: Partial<{ mockDone: boolean; analysisDone: boolean }>) => ({ ...cur, ...u }),
  );
  const bump = (s: Section, n: number) => start(async () => {
    if (n < 0 && counts[s] + n < 0) return;
    add({ s, n });
    await logProgress(s, n);
  });

  const rest = !plan || plan.type === "rest";
  const targets = plan?.targets ?? { qa: 0, rc: 0, va: 0, dilr: 0 };
  const m = (k: Section) => unitMinutes(k, today);
  const plannedMin = SECTIONS.reduce((a, k) => a + targets[k] * m(k), 0) + (plan?.type === "mock" ? MOCK_MIN + ANALYSIS_MIN : 0);
  const doneMin = SECTIONS.reduce((a, k) => a + counts[k] * m(k), 0)
    + (plan?.type === "mock" ? (flags.mockDone ? MOCK_MIN : 0) + (flags.analysisDone ? ANALYSIS_MIN : 0) : 0);
  const pct = plannedMin ? Math.min(999, Math.round((doneMin / plannedMin) * 100)) : 0;

  // Segments of the overall bar, sized by each block's share of today's planned time
  const segs = [
    ...(plan?.type === "mock" ? [
      { key: "mock", label: "Mock", w: MOCK_MIN, fill: flags.mockDone ? 1 : 0 },
      { key: "analysis", label: "Analysis", w: ANALYSIS_MIN, fill: flags.analysisDone ? 1 : 0 },
    ] : []),
    ...SECTIONS.filter((k) => targets[k] > 0).map((k) => ({ key: k, label: SECTION_META[k].short, w: targets[k] * m(k), fill: Math.min(1, counts[k] / targets[k]) })),
  ];

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-5 md:p-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="label">Today</span>
            {rest ? <span className="chip"><Coffee size={12} /> Rest day</span>
              : plan!.type === "mock" ? <span className="chip !bg-accent-soft !border-accent/30 !text-accent">{plan!.mockName ?? "Mock day"}</span>
              : <span className="chip">Practice</span>}
            {plan?.tag && !rest && plan.type !== "mock" && <span className="chip">{plan.tag}</span>}
          </div>
          <button onClick={() => start(async () => { await undoLastLog(); })} className="btn btn-ghost btn-sm" title="Undo last log">
            <Undo2 size={13} /> Undo
          </button>
        </div>

        {rest ? (
          <div className="mt-4">
            <p className="text-[22px] font-semibold tracking-tight">{plan?.note ?? "Recovery day"}</p>
            <p className="text-[13.5px] text-muted mt-1">Nothing is planned today. Anything you log still counts toward your week.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
              <div className="flex items-baseline gap-3">
                <span className={clsx("num text-[44px] leading-none font-semibold tracking-tight", pct >= 100 && "text-good")}>{pct}%</span>
                <span className="text-[13.5px] text-muted num">{minutesToH(doneMin)} <span className="text-muted/70">of</span> {minutesToH(plannedMin)}</span>
              </div>
              {pct >= 100 && <span className="chip !bg-good-soft !border-good/30 !text-good"><Check size={12} /> Day complete</span>}
            </div>
            <div className="mt-4 flex gap-[3px] h-2.5">
              {segs.map((g) => (
                <div key={g.key} className="relative h-full rounded-full bg-line overflow-hidden" style={{ flexGrow: g.w, flexBasis: 0 }} title={`${g.label}: ${Math.round(g.fill * 100)}%`}>
                  <div className={clsx("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]", g.fill >= 1 ? "bg-good" : "bg-[var(--s-done)]")}
                    style={{ width: `${g.fill * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-[3px]">
              {segs.map((g) => (
                <span key={g.key} className="label !text-[10px] truncate" style={{ flexGrow: g.w, flexBasis: 0 }}>{g.label}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mock blocks */}
      {plan?.type === "mock" && (
        <div className="px-5 md:px-6 pb-4 grid grid-cols-2 gap-2">
          {([["mockDone", "Mock attempted", MOCK_MIN], ["analysisDone", "Analysis done", ANALYSIS_MIN]] as const).map(([k, label, mins]) => (
            <button key={k}
              onClick={() => start(async () => { setFlag({ [k]: !flags[k] }); await toggleMockFlag(plan.date, k, !flags[k]); })}
              className={clsx("rounded-xl border px-3.5 py-3 text-left transition-colors flex items-center justify-between",
                flags[k] ? "border-good/40 bg-good-soft" : "border-line bg-panel-2 hover:border-line-2")}>
              <span>
                <span className="block text-[13.5px] font-medium">{label}</span>
                <span className="block text-[11.5px] text-muted num">{minutesToH(mins)}</span>
              </span>
              <span className={clsx("size-5 rounded-md grid place-items-center border", flags[k] ? "bg-good border-good text-white" : "border-line-2")}>
                {flags[k] && <Check size={12} />}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Planned sectionals: ticked by logging one on the Mocks page (not part of the hours model) */}
      {!rest && plan?.sectionals && (
        <div className="px-5 md:px-6 pb-4 flex flex-wrap items-center gap-1.5">
          <span className="label mr-1">Sectionals</span>
          {(Object.keys(SECTIONAL_LABEL) as (keyof Sectionals)[]).filter((k) => plan.sectionals![k] > 0).map((k) => {
            const want = plan.sectionals![k], got = Math.min(want, sectionalsDone[k]);
            const ok = got >= want;
            return (
              <span key={k} className={clsx("chip num", ok && "!bg-good-soft !border-good/30 !text-good")}>
                {ok && <Check size={12} />}{SECTIONAL_LABEL[k]} {want > 1 ? `${got}/${want}` : ""}
              </span>
            );
          })}
          {(Object.keys(SECTIONAL_LABEL) as (keyof Sectionals)[]).some((k) => sectionalsDone[k] < plan.sectionals![k]) && (
            <Link href="/mocks" className="text-[12.5px] text-accent hover:underline ml-1">Log a sectional →</Link>
          )}
        </div>
      )}

      {/* Section rows */}
      <ul className="border-t border-line divide-y divide-line">
        {SECTIONS.map((k) => (
          <Row key={k} s={k} count={counts[k]} target={rest ? 0 : targets[k]} minutesEach={m(k)} bump={bump} />
        ))}
      </ul>
      {plan?.note && !rest && <p className="px-5 md:px-6 py-3 border-t border-line text-[12.5px] text-muted">{plan.note}</p>}
    </div>
  );
}

function Row({ s, count, target, minutesEach, bump }: { s: Section; count: number; target: number; minutesEach: number; bump: (s: Section, n: number) => void }) {
  const meta = SECTION_META[s];
  const [custom, setCustom] = useState("");
  const p = target ? Math.min(1, count / target) : 0;
  const complete = target > 0 && count >= target;
  const left = Math.max(0, target - count);
  const submit = () => { const n = parseInt(custom, 10); if (n > 0) { bump(s, n); setCustom(""); } };

  return (
    <li className="px-5 md:px-6 py-3.5 grid grid-cols-[1fr_auto] md:grid-cols-[150px_1fr_auto] items-center gap-x-4 gap-y-2.5">
      <div className="min-w-0">
        <div className="text-[14px] font-medium flex items-center gap-1.5">
          {meta.label}
          {complete && <Check size={13} className="text-good" />}
        </div>
        <div className="text-[11.5px] text-muted num">
          {target ? (left ? `${left} ${left === 1 ? meta.unitOne : meta.unit} left · ~${Math.round(left * minutesEach)}m` : "target met") : meta.unit}
        </div>
      </div>

      <div className="col-span-2 md:col-span-1 order-last md:order-none flex items-center gap-3">
        <span className="num text-[15px] w-[72px] shrink-0">
          <span className="font-semibold text-[18px]">{count}</span>
          {target > 0 && <span className="text-muted"> / {target}</span>}
        </span>
        {target > 0 ? (
          <div className="h-1.5 flex-1 rounded-full bg-line overflow-hidden">
            <div className={clsx("h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]", complete ? "bg-good" : "bg-[var(--s-done)]")} style={{ width: `${p * 100}%` }} />
          </div>
        ) : <div className="flex-1" />}
      </div>

      <div className="flex items-center gap-1 justify-self-end">
        <button aria-label={`Remove 1 ${meta.short}`} onClick={() => bump(s, -1)} disabled={count === 0}
          className="size-8 grid place-items-center rounded-lg border border-line text-muted hover:text-ink hover:border-line-2 disabled:opacity-30"><Minus size={13} /></button>
        <button onClick={() => bump(s, 1)} className="h-8 px-2.5 rounded-lg border border-line text-[12.5px] num hover:border-line-2">+1</button>
        {meta.step > 1 && <button onClick={() => bump(s, meta.step)} className="h-8 px-2.5 rounded-lg border border-line text-[12.5px] num hover:border-line-2">+{meta.step}</button>}
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-center h-8 rounded-lg border border-line focus-within:border-accent overflow-hidden">
          <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="n"
            aria-label={`Add custom ${meta.short}`} className="w-9 h-full bg-transparent text-center text-[12.5px] num outline-none placeholder:text-muted/60" />
          <button className="h-full px-2 bg-ink text-bg grid place-items-center disabled:opacity-40" disabled={!custom} aria-label="Add"><Plus size={13} /></button>
        </form>
      </div>
    </li>
  );
}
