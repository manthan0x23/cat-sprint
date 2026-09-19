"use client";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { addSectional, deleteSectional } from "@/app/actions";
import { fmtDate } from "@/lib/cat";
import { MockForm } from "./client";

export type Sectional = { id: number; date: string; section: "varc" | "dilr" | "qa"; name: string; score: number; note: string | null };

const SECTIONS = [
  { k: "varc", label: "VARC" },
  { k: "dilr", label: "DILR" },
  { k: "qa", label: "QA" },
] as const;

// "Log a mock" card: full mock by default, sectional one tap away.
export function LogCard({ today, suggestedName }: { today: string; suggestedName: string }) {
  const [kind, setKind] = useState<"mock" | "sectional">("mock");
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="label">Log a result</span>
        <div className="inline-grid grid-cols-2 gap-0.5 p-0.5 rounded-lg bg-panel-2 border border-line">
          {([["mock", "Full mock"], ["sectional", "Sectional"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
              className={clsx("h-7 px-2.5 rounded-md text-[12.5px] transition-all border", kind === k ? "bg-accent-soft text-accent border-accent/30 font-medium" : "text-muted border-transparent")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {kind === "mock" ? <MockForm today={today} suggestedName={suggestedName} /> : <SectionalForm today={today} />}
    </>
  );
}

function SectionalForm({ today }: { today: string }) {
  const [section, setSection] = useState<Sectional["section"]>("varc");
  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = SECTIONS.find((s) => s.k === section)!.label;

  return (
    <form className="mt-3 space-y-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        try {
          await addSectional({ date, section, name: name.trim() || `${label} sectional`, score: Number(score), note });
          setName(""); setScore(""); setNote(""); setError(null);
        } catch { setError("Couldn't save. Check the score and date."); }
      });
    }}>
      <div>
        <span className="label">Section</span>
        <div className="mt-1 grid grid-cols-3 gap-1 p-1 rounded-xl bg-panel-2 border border-line">
          {SECTIONS.map((s) => (
            <button key={s.k} type="button" onClick={() => setSection(s.k)} aria-pressed={section === s.k}
              className={clsx("h-8 rounded-lg text-[13px] transition-all border", section === s.k ? "bg-accent-soft text-accent border-accent/30 font-medium" : "text-muted border-transparent")}>{s.label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Date</span><input type="date" value={date} max={today} required onChange={(e) => setDate(e.target.value)} className="input mt-1 num" /></label>
        <label><span className="label">Score</span><input type="number" step="any" inputMode="decimal" value={score} required onChange={(e) => setScore(e.target.value)} className="input mt-1 num font-medium" placeholder="e.g. 32" /></label>
      </div>
      <label className="block"><span className="label">Name <span className="normal-case tracking-normal">(optional)</span></span><input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" placeholder={`${label} sectional 3`} /></label>
      <label className="block"><span className="label">Takeaway <span className="normal-case tracking-normal">(optional)</span></span><input value={note} onChange={(e) => setNote(e.target.value)} className="input mt-1" placeholder="Picked the wrong sets first" /></label>
      {error && <p className="text-[12.5px] text-bad">{error}</p>}
      <button className="btn btn-accent w-full" disabled={pending || score === ""}>{pending ? "Saving…" : `Save ${label} sectional`}</button>
    </form>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-8" />;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - lo) / span) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--s-done)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Per-section trend tiles + recent list. Only rendered once the user has logged a sectional.
export function SectionalsCard({ items }: { items: Sectional[] }) {
  const [all, setAll] = useState(false);
  const recent = [...items].reverse();
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="label">Sectionals</span>
        <span className="text-[12px] text-muted num">{items.length} logged</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {SECTIONS.map((s) => {
          const xs = items.filter((i) => i.section === s.k).map((i) => i.score);
          // Trend: average of the last 3 vs the 3 before (or last vs previous with fewer).
          const delta = xs.length >= 6 ? avg(xs.slice(-3)) - avg(xs.slice(-6, -3)) : xs.length >= 2 ? xs.at(-1)! - xs.at(-2)! : null;
          return (
            <div key={s.k} className="rounded-xl border border-line bg-panel-2 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] font-medium">{s.label}</span>
                <span className="text-[11px] text-muted num">{xs.length ? `${xs.length} taken` : "none yet"}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[22px] font-semibold num">{xs.length ? xs.at(-1) : "—"}</span>
                {delta != null && Math.round(delta * 10) !== 0 && (
                  <span className={clsx("text-[12px] num", delta > 0 ? "text-good" : "text-bad")}>{delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 10) / 10)}</span>
                )}
              </div>
              <Spark values={xs.slice(-10)} />
            </div>
          );
        })}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {(all ? recent : recent.slice(0, 5)).map((i) => <SectionalRow key={i.id} item={i} />)}
      </ul>
      {recent.length > 5 && (
        <button className="mt-1 text-[12.5px] text-accent hover:underline" onClick={() => setAll(!all)}>{all ? "Show less" : `Show all ${recent.length}`}</button>
      )}
    </div>
  );
}

function SectionalRow({ item }: { item: Sectional }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-3 py-2 text-[13.5px]">
      <span className="chip !h-5 !text-[10.5px] w-12 justify-center shrink-0">{SECTIONS.find((s) => s.k === item.section)!.label}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate">{item.name}</div>
        {item.note && <div className="text-[12px] text-muted truncate">{item.note}</div>}
      </div>
      <span className="num text-muted text-[12px] shrink-0">{fmtDate(item.date)}</span>
      <span className="num font-medium w-10 text-right shrink-0">{item.score}</span>
      <button disabled={pending} onClick={() => start(() => deleteSectional(item.id))} className="text-muted hover:text-bad shrink-0" aria-label="Delete sectional"><Trash2 size={14} /></button>
    </li>
  );
}
