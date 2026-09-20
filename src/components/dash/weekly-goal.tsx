"use client";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { Lock } from "lucide-react";
import type { Targets } from "@/db/schema";
import { fmtDate, SECTIONS, SECTION_META, WEEKLY_MAX } from "@/lib/cat";
import type { WeekStatus } from "@/lib/week";
import { lockWeeklyGoal } from "@/app/actions";

export function WeeklyGoalCard({ week }: { week: WeekStatus }) {
  const range = `${fmtDate(week.weekStart)} – ${fmtDate(week.weekEnd)}`;
  if (!week.goal) return <SetGoal week={week} range={range} />;
  const g = week.goal;
  const pct = Math.round((week.pct ?? 0) * 100);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="label inline-flex items-center gap-1.5"><Lock size={11} /> Weekly goal · {range}</span>
        <span className="text-[12px] text-muted num">{week.daysLeft} day{week.daysLeft === 1 ? "" : "s"} left</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="num text-[28px] font-medium leading-none">{pct}%</span>
        <span className="text-[13px] text-muted">of this week&apos;s locked goal</span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {SECTIONS.filter((k) => g.targets[k] > 0).map((k) => (
          <Bar key={k} label={`${SECTION_META[k].short} (${SECTION_META[k].unit})`} done={week.done[k]} goal={g.targets[k]}
            hint={week.perDayNeeded && week.perDayNeeded[k] > 0 ? `${week.perDayNeeded[k]}/day to finish` : "done"} />
        ))}
        {g.mocks > 0 && <Bar label="Mocks" done={week.mocksDone} goal={g.mocks} hint={week.mocksDone >= g.mocks ? "done" : `${g.mocks - week.mocksDone} left`} />}
      </ul>
      {week.planBelowGoal.length > 0 && (
        <p className="mt-4 text-[12.5px] text-warn leading-relaxed">
          Your day-by-day plan for this week now adds up to less than the locked goal in {week.planBelowGoal.map((k) => SECTION_META[k].short).join(", ")}. The goal doesn&apos;t move; the extra work lands on the days left.
        </p>
      )}
    </div>
  );
}

function Bar({ label, done, goal, hint }: { label: string; done: number; goal: number; hint: string }) {
  const p = Math.min(1, done / goal);
  return (
    <li>
      <div className="flex justify-between text-[12.5px]">
        <span className="text-ink-2">{label}</span>
        <span className="num text-muted"><span className="text-ink">{done}</span> / {goal} · {hint}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-line overflow-hidden">
        <div className={clsx("h-full rounded-full", p >= 1 ? "bg-good" : "bg-[var(--s-done)]")} style={{ width: `${p * 100}%` }} />
      </div>
    </li>
  );
}

function SetGoal({ week, range }: { week: WeekStatus; range: string }) {
  // Prefilled from the week's planned total, clamped: a heavy plan can add up past the ceiling.
  const [t, setT] = useState<Targets>(() =>
    SECTIONS.reduce((acc, k) => ({ ...acc, [k]: Math.min(WEEKLY_MAX[k], week.planned[k]) }), {} as Targets));
  const [mocks, setMocks] = useState(Math.min(7, week.plannedMocks));
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card p-5 !border-accent/40">
      <span className="label inline-flex items-center gap-1.5"><Lock size={11} /> Set this week&apos;s goal · {range}</span>
      <p className="mt-2 text-[13px] text-muted leading-relaxed">
        Daily targets can move; this can&apos;t. Once locked, it stays until Sunday night. Prefilled from your plan for the week.
      </p>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {SECTIONS.map((k) => (
          <label key={k}>
            <span className="label">{SECTION_META[k].short}</span>
            <input type="number" min={0} max={WEEKLY_MAX[k]} value={t[k]}
              onChange={(e) => { setT({ ...t, [k]: Math.min(WEEKLY_MAX[k], Math.max(0, Math.round(Number(e.target.value)) || 0)) }); setConfirm(false); }}
              className="input num mt-1 !px-2" />
          </label>
        ))}
        <label>
          <span className="label">Mocks</span>
          <input type="number" min={0} max={7} value={mocks} onChange={(e) => { setMocks(Math.min(7, Math.max(0, Math.round(Number(e.target.value)) || 0))); setConfirm(false); }} className="input num mt-1 !px-2" />
        </label>
      </div>
      <p className="mt-2 text-[11.5px] text-muted">RC in passages, DILR in sets, QA/VA in questions.</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        {msg && <span className="text-[12px] text-bad">{msg}</span>}
        {!confirm ? (
          <button className="btn btn-primary" onClick={() => setConfirm(true)}>Lock weekly goal</button>
        ) : (
          <button className="btn btn-accent" disabled={pending}
            onClick={() => start(async () => {
              try {
                const r = await lockWeeklyGoal({ targets: t, mocks });
                if (!r.ok) setMsg(r.message);
              } catch { setMsg("Couldn't lock the goal. Try again."); }
            })}>
            {pending ? "Locking…" : "Confirm: can't change until Sunday"}
          </button>
        )}
      </div>
    </div>
  );
}
