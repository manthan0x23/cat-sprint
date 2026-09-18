"use client";
import { useOptimistic, useTransition } from "react";
import clsx from "clsx";
import { Minus, Plus, Undo2, Check } from "lucide-react";
import type { Targets } from "@/db/schema";
import { SECTIONS, SECTION_META, type Section } from "@/lib/cat";
import { logProgress, toggleMockFlag, undoLastLog } from "@/app/actions";

type Plan = { date: string; type: "practice" | "mock" | "rest"; targets: Targets; mockName: string | null; mockDone: boolean; analysisDone: boolean; note: string | null } | null;

export function TodayCard({ plan, done }: { plan: Plan; done: Targets }) {
  const [pending, start] = useTransition();
  const [opt, add] = useOptimistic(done, (cur, { s, n }: { s: Section; n: number }) => ({ ...cur, [s]: Math.max(0, cur[s] + n) }));
  const [flags, setFlag] = useOptimistic(
    { mockDone: plan?.mockDone ?? false, analysisDone: plan?.analysisDone ?? false },
    (cur, u: Partial<{ mockDone: boolean; analysisDone: boolean }>) => ({ ...cur, ...u }),
  );

  const bump = (s: Section, n: number) =>
    start(async () => {
      if (n < 0 && opt[s] + n < 0) return;
      add({ s, n });
      await logProgress(s, n);
    });

  if (!plan || plan.type === "rest") {
    return (
      <div className="card p-6">
        <div className="label">Today</div>
        <p className="mt-3 text-lg font-medium">{plan?.note ?? "Rest day"}</p>
        <p className="text-muted text-sm mt-1">Recovery is part of the plan. Log anything you do anyway:</p>
        <Grid plan={{ qa: 0, rc: 0, va: 0, dilr: 0 }} done={opt} bump={bump} pending={pending} />
      </div>
    );
  }

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="label">Today</span>
          <span className={clsx("chip", plan.type === "mock" && "!bg-accent-soft !border-accent/30 !text-accent")}>
            {plan.type === "mock" ? plan.mockName ?? "Mock day" : "Practice day"}
          </span>
        </div>
        <button onClick={() => start(async () => { await undoLastLog(); })} className="btn btn-ghost btn-sm" disabled={pending} title="Undo last log">
          <Undo2 size={13} /> Undo
        </button>
      </div>

      {plan.type === "mock" && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {([["mockDone", "Mock attempted", "120 min"], ["analysisDone", "Analysis done", "120 min"]] as const).map(([k, label, sub]) => (
            <button key={k}
              onClick={() => start(async () => { setFlag({ [k]: !flags[k] }); await toggleMockFlag(plan.date, k, !flags[k]); })}
              className={clsx("rounded-xl border p-3 text-left transition-colors",
                flags[k] ? "border-good/40 bg-good-soft" : "border-line bg-panel-2 hover:border-line-2")}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label}</span>
                <span className={clsx("size-5 rounded-md grid place-items-center border", flags[k] ? "bg-good border-good text-white" : "border-line-2")}>
                  {flags[k] && <Check size={12} />}
                </span>
              </div>
              <div className="text-xs text-muted mt-1 num">{sub}</div>
            </button>
          ))}
        </div>
      )}

      <Grid plan={plan.targets} done={opt} bump={bump} pending={pending} />
      {plan.note && <p className="mt-4 text-[13px] text-muted">{plan.note}</p>}
    </div>
  );
}

function Grid({ plan, done, bump }: { plan: Targets; done: Targets; bump: (s: Section, n: number) => void; pending?: boolean }) {
  return (
    <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
      {SECTIONS.map((s) => {
        const m = SECTION_META[s];
        const target = plan[s];
        const pct = target ? Math.min(1, done[s] / target) : done[s] ? 1 : 0;
        return (
          <div key={s} className="rounded-xl border border-line bg-panel-2 p-3.5 flex flex-col items-center">
            <Ring pct={pct} complete={target > 0 && done[s] >= target}>
              <div className="num text-[22px] leading-none font-medium">{done[s]}</div>
              <div className="num text-[11px] text-muted mt-1">/ {target} {m.unit}</div>
            </Ring>
            <div className="mt-2 text-[13px] font-medium">{m.label}</div>
            <div className="mt-3 flex items-center gap-1.5">
              <button aria-label={`Remove 1 ${m.short}`} onClick={() => bump(s, -1)} disabled={done[s] === 0}
                className="btn btn-ghost btn-sm !px-2"><Minus size={13} /></button>
              <button onClick={() => bump(s, 1)} className="btn btn-ghost btn-sm num">+1</button>
              {m.step > 1 && (
                <button onClick={() => bump(s, m.step)} className="btn btn-primary btn-sm num">
                  <Plus size={12} />{m.step}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Ring({ pct, complete, children }: { pct: number; complete: boolean; children: React.ReactNode }) {
  const r = 40, c = 2 * Math.PI * r;
  return (
    <div className="relative size-[104px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={complete ? "var(--good)" : "var(--s-done)"} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
