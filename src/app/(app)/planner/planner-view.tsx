"use client";
import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { X, Wand2, Trash2 } from "lucide-react";
import type { Targets } from "@/db/schema";
import { addDays, diffDays, EXAM_DATE, fmtDate, SECTIONS, SECTION_META, weekday } from "@/lib/cat";
import { phaseOf } from "@/lib/plan-generator";
import { weekStatus, type WeekGoal } from "@/lib/week";
import { Lock } from "lucide-react";
import { plannedMinutes, minutesToH } from "@/lib/progress";
import { applyTemplate, deleteCustomTemplate, saveCustomTemplate, updateDay } from "@/app/actions";

type Day = { date: string; type: "practice" | "mock" | "rest"; targets: Targets; mockName: string | null; note: string | null; tag: string | null; mockDone: boolean; analysisDone: boolean };
type Tpl = { id: string; name: string; description: string; practice: Targets; mock: Targets; mocksPerWeek: number; finalStretchMocksPerWeek: number; custom: boolean };

export function PlannerView({ today, plans, templates, currentTemplate, weekGoal }: { today: string; plans: Day[]; templates: Tpl[]; currentTemplate: string | null; weekGoal: WeekGoal }) {
  const [sel, setSel] = useState<string | null>(null);
  const [showTpl, setShowTpl] = useState(false);
  const byDate = useMemo(() => new Map(plans.map((p) => [p.date, p])), [plans]);

  // Calendar starts on the Monday on/before the first plan day (or today).
  const first = plans[0]?.date && plans[0].date < today ? plans[0].date : today;
  const startOffset = (weekday(first) + 6) % 7;
  const gridStart = addDays(first, -startOffset);
  const cells: string[] = [];
  for (let d = gridStart; d <= EXAM_DATE || cells.length % 7; d = addDays(d, 1)) cells.push(d);

  const upcoming = plans.filter((p) => p.date >= today);
  const mocksLeft = upcoming.filter((p) => p.type === "mock").length;
  const hoursLeft = upcoming.reduce((s, p) => s + plannedMinutes(p), 0) / 60;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="label">Planner</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Every day to 29 Nov</h1>
          <p className="mt-1 text-muted text-sm">Tap an upcoming day to switch practice / mock / rest or change its targets. Past days are locked.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip num">{mocksLeft} mocks left</span>
          <span className="chip num">{Math.round(hoursLeft)}h planned</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowTpl(true)}><Wand2 size={13} /> Templates</button>
        </div>
      </div>

      <PhaseStrip today={today} plans={plans} />
      <WeekGoalBanner today={today} plans={plans} goal={weekGoal} />

      <div className="mt-3 card p-2 md:p-3">
        <div className="grid grid-cols-7 gap-1 md:gap-1.5 mb-1.5">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="label text-center py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 md:gap-1.5">
          {cells.map((d) => {
            const p = byDate.get(d);
            const past = d < today;
            const isExam = d === EXAM_DATE;
            const monthStart = d.endsWith("-01");
            return (
              <button key={d} disabled={!p || isExam || past} onClick={() => setSel(d)} title={past ? "Past days are locked" : undefined}
                className={clsx(
                  "relative text-left rounded-lg border min-h-[62px] md:min-h-[92px] p-1.5 md:p-2 transition-all",
                  !p && "border-transparent opacity-30",
                  p && !isExam && !past && "hover:border-line-2 hover:-translate-y-px",
                  p?.type === "mock" ? "bg-accent-soft border-accent/25" : p?.type === "rest" && !isExam ? "bg-panel-2 border-line border-dashed" : "bg-panel border-line",
                  isExam && "!bg-ink !text-bg !border-ink !opacity-100",
                  past && p && "opacity-55",
                  d === today && "ring-2 ring-accent ring-offset-1 ring-offset-bg",
                )}>
                <div className="flex items-center justify-between">
                  <span className={clsx("num text-[11px] md:text-[12px]", monthStart && "font-semibold")}>
                    {monthStart ? fmtDate(d, { day: "numeric", month: "short" }) : Number(d.slice(8))}
                  </span>
                  {p?.type === "mock" && <span className="size-1.5 rounded-full bg-accent" />}
                </div>
                {isExam ? <div className="mt-1 text-[11px] md:text-[13px] font-semibold">CAT</div> : p && (
                  <div className="mt-1 hidden md:block">
                    {p.type === "mock" ? (
                      <div className="text-[12px] font-medium text-accent truncate">{p.mockName}</div>
                    ) : p.type === "rest" ? (
                      <div className="text-[12px] text-muted">Rest</div>
                    ) : (
                      <>
                        {p.tag && <div className={clsx("text-[11px] font-medium truncate", TAG_TONE[p.tag] ?? "text-ink-2")}>{p.tag}</div>}
                        <div className="text-[10.5px] text-muted num leading-[1.35]">
                          {p.targets.qa}Q · {p.targets.rc}R<br />{p.targets.va}V · {p.targets.dilr}D
                        </div>
                      </>
                    )}
                  </div>
                )}
                {p && !isExam && (
                  <div className="md:hidden mt-1 text-[9px] text-muted truncate">{p.type === "mock" ? "Mock" : p.type === "rest" ? "Rest" : p.tag === "Review" || p.tag === "Light" ? p.tag : ""}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-accent-soft border border-accent/25" /> Mock day</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-panel border border-line" /> Practice (Q·R·V·D targets)</span>
        <span className="inline-flex items-center gap-1.5"><span className="text-warn font-medium">Review</span> day after a mock: redo its mistakes</span>
        <span className="inline-flex items-center gap-1.5"><span className="text-muted font-medium">Light</span> before the Sunday mock</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-panel-2 border border-dashed border-line" /> Rest</span>
      </div>

      {sel && byDate.get(sel) && <DayEditor key={sel} day={byDate.get(sel)!} onClose={() => setSel(null)} templates={templates} />}
      {showTpl && <TemplatePanel templates={templates} current={currentTemplate} today={today} onClose={() => setShowTpl(false)} />}
    </div>
  );
}

const TAG_TONE: Record<string, string> = {
  Review: "text-warn",
  Light: "text-muted",
  Taper: "text-muted",
  Consolidate: "text-muted",
};

const PHASE_META = [
  { key: "build", label: "Build", desc: "2 mocks/wk · Sun + Wed" },
  { key: "ramp", label: "Ramp", desc: "Mocks + deeper analysis" },
  { key: "peak", label: "Peak", desc: "Up to 3 mocks/wk" },
  { key: "final", label: "Consolidate", desc: "No new mocks" },
  { key: "taper", label: "Taper", desc: "Revise + rest" },
] as const;

function PhaseStrip({ today, plans }: { today: string; plans: Day[] }) {
  const days = plans.filter((p) => p.date >= today);
  if (!days.length) return null;
  const groups = PHASE_META.map((m) => {
    const ds = days.filter((d) => phaseOf(diffDays(EXAM_DATE, d.date)) === m.key);
    return { ...m, n: ds.length, mocks: ds.filter((d) => d.type === "mock").length, from: ds[0]?.date, to: ds.at(-1)?.date };
  }).filter((g) => g.n > 0);
  const current = phaseOf(diffDays(EXAM_DATE, today));
  return (
    <div className="mt-5 flex gap-1 overflow-x-auto">
      {groups.map((g) => (
        <div key={g.key} style={{ flexGrow: g.n, flexBasis: 0 }}
          className={clsx("min-w-[110px] rounded-lg border px-3 py-2", g.key === current ? "border-accent/40 bg-accent-soft" : "border-line bg-panel")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium">{g.label}{g.key === current && <span className="ml-1.5 text-[10.5px] text-accent">now</span>}</span>
            <span className="text-[11px] text-muted num">{g.mocks ? `${g.mocks} mocks` : ""}</span>
          </div>
          <div className="text-[11px] text-muted num mt-0.5 truncate">{g.from && fmtDate(g.from)}–{g.to && fmtDate(g.to)} · {g.n}d</div>
        </div>
      ))}
    </div>
  );
}
function WeekGoalBanner({ today, plans, goal }: { today: string; plans: Day[]; goal: WeekGoal }) {
  if (!goal) {
    return (
      <div className="mt-3 rounded-lg border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-[13px] flex items-center gap-2">
        <Lock size={13} className="text-warn" /> No weekly goal locked yet. Lock it from the Today page; daily targets can move, the weekly goal can&apos;t.
      </div>
    );
  }
  const w = weekStatus({ today, plans, doneByDate: {}, goal });
  const short = w.planBelowGoal;
  return (
    <div className={clsx("mt-3 rounded-lg border px-3.5 py-2.5 text-[13px] flex flex-wrap items-center gap-x-3 gap-y-1", short.length ? "border-warn/30 bg-warn-soft" : "border-line bg-panel")}>
      <span className="inline-flex items-center gap-1.5 font-medium"><Lock size={13} /> Locked this week</span>
      <span className="num text-muted">
        {SECTIONS.map((k) => `${SECTION_META[k].short} ${goal.targets[k]}`).join(" · ")}{goal.mocks ? ` · ${goal.mocks} mocks` : ""}
      </span>
      {short.length > 0 && (
        <span className="text-warn">
          This week&apos;s days now total less than the goal in {short.map((k) => `${SECTION_META[k].short} (${w.planned[k]}/${goal.targets[k]})`).join(", ")}.
        </span>
      )}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
      <div className="card w-full md:max-w-lg max-h-[88dvh] overflow-y-auto rounded-b-none md:rounded-b-[14px] p-5 rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function TargetInputs({ value, onChange }: { value: Targets; onChange: (t: Targets) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {SECTIONS.map((s) => (
        <label key={s} className="block">
          <span className="label">{SECTION_META[s].short} <span className="normal-case tracking-normal">({SECTION_META[s].unit})</span></span>
          <input type="number" min={0} value={value[s]} onChange={(e) => onChange({ ...value, [s]: Math.max(0, Number(e.target.value)) })}
            className="input num mt-1" />
        </label>
      ))}
    </div>
  );
}

function DayEditor({ day, onClose, templates }: { day: Day; onClose: () => void; templates: Tpl[] }) {
  const [type, setType] = useState(day.type);
  const [targets, setTargets] = useState(day.targets);
  const [mockName, setMockName] = useState(day.mockName ?? "");
  const [note, setNote] = useState(day.note ?? "");
  const tag = type === day.type ? day.tag : type === "rest" ? "Rest" : null;
  const [pending, start] = useTransition();
  const tpl = templates[0];

  const switchType = (t: Day["type"]) => {
    setType(t);
    if (t === "rest") setTargets({ qa: 0, rc: 0, va: 0, dilr: 0 });
    else if (t !== day.type) setTargets(t === "mock" ? tpl.mock : tpl.practice);
    else setTargets(day.targets);
  };

  return (
    <Sheet title={fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })} onClose={onClose}>
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-panel-2 border border-line">
        {(["practice", "mock", "rest"] as const).map((t) => (
          <button key={t} onClick={() => switchType(t)}
            className={clsx("h-8 rounded-lg text-[13px] capitalize transition-all", type === t ? "bg-panel shadow-sm border border-line font-medium" : "text-muted")}>{t}</button>
        ))}
      </div>
      {type === "mock" && (
        <label className="block mt-4">
          <span className="label">Mock name</span>
          <input className="input mt-1" value={mockName} onChange={(e) => setMockName(e.target.value)} placeholder="e.g. SIMCAT 5, AIMCAT 2612" />
        </label>
      )}
      {type !== "rest" && (
        <div className="mt-4">
          <div className="label mb-2">{type === "mock" ? "Top-up practice (besides the mock)" : "Targets"}</div>
          <TargetInputs value={targets} onChange={setTargets} />
          <p className="mt-2 text-[12px] text-muted num">≈ {minutesToH(plannedMinutes({ date: day.date, type, targets }))} of work</p>
        </div>
      )}
      <label className="block mt-4">
        <span className="label">Note</span>
        <input className="input mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Office offsite, only evening free" />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-accent" disabled={pending}
          onClick={() => start(async () => { await updateDay(day.date, { type, targets, mockName, note, tag }); onClose(); })}>
          {pending ? "Saving…" : "Save day"}
        </button>
      </div>
    </Sheet>
  );
}

function TemplatePanel({ templates, current, today, onClose }: { templates: Tpl[]; current: string | null; today: string; onClose: () => void }) {
  const [sel, setSel] = useState(current ?? templates[0].id);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(EXAM_DATE);
  const [keepMocks, setKeepMocks] = useState(true);
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", practice: templates[0].practice, mock: templates[0].mock, mocksPerWeek: 2, finalStretchMocksPerWeek: 3 });

  return (
    <Sheet title="Templates" onClose={onClose}>
      {!creating ? (
        <>
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} role="button" tabIndex={0} onClick={() => setSel(t.id)}
                className={clsx("rounded-xl border p-3.5 cursor-pointer transition-all", sel === t.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-2")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[14px]">{t.name} {current === t.id && <span className="chip ml-1 !h-5 !text-[10.5px]">active</span>}</span>
                  {t.custom && (
                    <button className="text-muted hover:text-bad" onClick={(e) => { e.stopPropagation(); start(() => deleteCustomTemplate(t.id)); }}><Trash2 size={14} /></button>
                  )}
                </div>
                <p className="text-[12.5px] text-muted mt-0.5">{t.description}</p>
                <div className="mt-2 text-[11.5px] text-muted num">
                  Practice {t.practice.qa}Q·{t.practice.rc}R·{t.practice.va}V·{t.practice.dilr}D · {t.mocksPerWeek}→{t.finalStretchMocksPerWeek} mocks/wk
                </div>
              </div>
            ))}
          </div>
          <button className="mt-2 text-[13px] text-accent hover:underline" onClick={() => setCreating(true)}>+ Create your own template</button>

          <div className="mt-5 pt-4 border-t border-line space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label><span className="label">From</span><input type="date" className="input mt-1 num" value={from} min={today} max={EXAM_DATE} onChange={(e) => setFrom(e.target.value)} /></label>
              <label><span className="label">To</span><input type="date" className="input mt-1 num" value={to} min={from} max={EXAM_DATE} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={keepMocks} onChange={(e) => setKeepMocks(e.target.checked)} />
              <span>Keep my current mock/rest days, only change targets<span className="block text-muted text-[12px]">Untick to also rebuild the mock schedule from this template.</span></span>
            </label>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-accent" disabled={pending}
                onClick={() => start(async () => { await applyTemplate(sel, from, to, keepMocks); onClose(); })}>
                {pending ? "Applying…" : "Apply to range"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <label className="block"><span className="label">Name</span><input className="input mt-1" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="My weekday plan" /></label>
          <div><div className="label mb-2">Practice day</div><TargetInputs value={draft.practice} onChange={(practice) => setDraft({ ...draft, practice })} /></div>
          <div><div className="label mb-2">Mock day top-up</div><TargetInputs value={draft.mock} onChange={(mock) => setDraft({ ...draft, mock })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">Mocks / week</span><input type="number" min={0} max={7} className="input mt-1 num" value={draft.mocksPerWeek} onChange={(e) => setDraft({ ...draft, mocksPerWeek: Number(e.target.value) })} /></label>
            <label><span className="label">Final 3 weeks</span><input type="number" min={0} max={7} className="input mt-1 num" value={draft.finalStretchMocksPerWeek} onChange={(e) => setDraft({ ...draft, finalStretchMocksPerWeek: Number(e.target.value) })} /></label>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>Back</button>
            <button className="btn btn-accent" disabled={pending || !draft.name.trim()}
              onClick={() => start(async () => { await saveCustomTemplate(draft); setCreating(false); })}>Save template</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
