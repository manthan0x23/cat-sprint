"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { CalendarDays, ChevronDown, Copy, List, Lock, Minus, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import type { DayType, PhaseDef, Sectionals, Targets, WeekSlot } from "@/db/schema";
import { addDays, diffDays, EXAM_DATE, fmtDate, SECTIONS, SECTION_META, weekday, weekStartOf, ZERO } from "@/lib/cat";
import { generatePhased, PHASE_LABEL, phaseOf, presetPhases } from "@/lib/plan-generator";
import { weekStatus, type WeekGoal } from "@/lib/week";
import { plannedMinutes, minutesToH } from "@/lib/progress";
import { applyTemplate, deleteCustomTemplate, saveCustomTemplate, updateDay } from "@/app/actions";

type Day = { date: string; type: DayType; targets: Targets; mockName: string | null; note: string | null; tag: string | null; phase: string | null; sectionals: Sectionals | null; mockDone: boolean; analysisDone: boolean };
type Tpl = { id: string; name: string; description: string; practice: Targets; mock: Targets; mocksPerWeek: number; finalStretchMocksPerWeek: number; phases: PhaseDef[] | null; custom: boolean };
type Draft = { id?: string; name: string; phases: PhaseDef[] };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VIEW_KEY = "planner:view";

export function PlannerView({ today, plans, templates, currentTemplate, weekGoal }: { today: string; plans: Day[]; templates: Tpl[]; currentTemplate: string | null; weekGoal: WeekGoal }) {
  const [sel, setSel] = useState<string | null>(null);
  const [showTpl, setShowTpl] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const byDate = useMemo(() => new Map(plans.map((p) => [p.date, p])), [plans]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      // Phones default to the list: a 7-column month is too small to read targets on.
      const next = v === "list" || v === "calendar" ? v : window.matchMedia("(max-width: 767px)").matches ? "list" : "calendar";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      setView(next);
    } catch {}
  }, []);
  const pickView = (v: "calendar" | "list") => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  };

  const upcoming = plans.filter((p) => p.date >= today);
  const mocksLeft = upcoming.filter((p) => p.type === "mock").length;
  const hoursLeft = upcoming.reduce((s, p) => s + plannedMinutes(p), 0) / 60;

  const active = templates.find((t) => t.id === currentTemplate);
  const openBuilder = (t?: Tpl) => {
    const base = t ?? active ?? templates[0];
    setShowTpl(false);
    setDraft(base.custom
      ? { id: base.id, name: base.name, phases: base.phases?.length ? structuredClone(base.phases) : presetPhases(base, today) }
      : { name: "My plan", phases: presetPhases(base, today) });
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="label">Planner</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">Every day to 29 Nov</h1>
          <p className="mt-1 text-muted text-sm">Tap an upcoming day to change it. Build your own phases to plan the weeks ahead your way.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip num">{mocksLeft} mocks left</span>
          <span className="chip num">{Math.round(hoursLeft)}h planned</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="btn btn-ghost btn-sm flex-1 sm:flex-none" onClick={() => setShowTpl(true)}><Wand2 size={13} /> Templates</button>
            <button className="btn btn-primary btn-sm flex-1 sm:flex-none" onClick={() => openBuilder(active?.custom ? active : undefined)}>
              <Pencil size={13} /> {active?.custom ? "Edit my plan" : "Build my plan"}
            </button>
          </div>
        </div>
      </div>

      <PhaseStrip today={today} plans={plans} />
      <WeekGoalBanner today={today} plans={plans} goal={weekGoal} />

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="label">{view === "list" ? "Week by week" : "Month view"}</div>
        <div className="inline-grid grid-cols-2 gap-0.5 p-0.5 rounded-lg bg-panel-2 border border-line">
          {([["calendar", CalendarDays, "Calendar"], ["list", List, "List"]] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => pickView(v)} aria-pressed={view === v}
              className={clsx("h-7 px-2.5 rounded-md text-[12.5px] inline-flex items-center gap-1.5 transition-all", view === v ? "bg-accent-soft text-accent border border-accent/30 font-medium shadow-sm" : "text-muted border border-transparent")}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {view === "calendar"
        ? <CalendarGrid today={today} plans={plans} byDate={byDate} onPick={setSel} />
        : <ListView today={today} plans={plans} onPick={setSel} />}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-accent-soft border border-accent/25" /> Mock</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-panel border border-line" /> Practice</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-panel-2 border border-dashed border-line" /> Rest</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-good" /> Sectional planned</span>
        <span className="inline-flex items-center gap-1.5"><span className="text-warn font-medium">Review</span> redo the last mock&apos;s mistakes</span>
      </div>

      {sel && byDate.get(sel) && <DayEditor key={sel} day={byDate.get(sel)!} onClose={() => setSel(null)} templates={templates} />}
      {showTpl && <TemplatePanel templates={templates} current={currentTemplate} today={today} onClose={() => setShowTpl(false)} onBuild={openBuilder} />}
      {draft && <PlanBuilder initial={draft} today={today} onClose={() => setDraft(null)} />}
    </div>
  );
}

const TAG_TONE: Record<string, string> = {
  Review: "text-warn",
  Light: "text-muted",
  Taper: "text-muted",
  Consolidate: "text-muted",
};

function CalendarGrid({ today, plans, byDate, onPick }: { today: string; plans: Day[]; byDate: Map<string, Day>; onPick: (d: string) => void }) {
  // Calendar starts on the Monday on/before the first plan day (or today).
  const first = plans[0]?.date && plans[0].date < today ? plans[0].date : today;
  const gridStart = weekStartOf(first);
  const cells: string[] = [];
  for (let d = gridStart; d <= EXAM_DATE || cells.length % 7; d = addDays(d, 1)) cells.push(d);

  return (
    <div className="mt-2 card p-1.5 md:p-3">
      <div className="grid grid-cols-7 gap-1 md:gap-1.5 mb-1">
        {WEEKDAYS.map((d) => <div key={d} className="label text-center py-1 !text-[10px] md:!text-[11px]">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
        {cells.map((d) => {
          const p = byDate.get(d);
          const past = d < today;
          const isExam = d === EXAM_DATE;
          const monthStart = d.endsWith("-01");
          return (
            <button key={d} disabled={!p || isExam || past} onClick={() => onPick(d)} title={past ? "Past days are locked" : undefined}
              className={clsx(
                "relative text-left rounded-lg border min-h-[54px] md:min-h-[92px] p-1 md:p-2 transition-all",
                !p && "border-transparent opacity-30",
                p && !isExam && !past && "hover:border-line-2 hover:-translate-y-px active:scale-[.97]",
                p?.type === "mock" ? "bg-accent-soft border-accent/25" : p?.type === "rest" && !isExam ? "bg-panel-2 border-line border-dashed" : "bg-panel border-line",
                isExam && "!bg-ink !text-bg !border-ink !opacity-100",
                past && p && "opacity-55",
                d === today && "ring-2 ring-accent ring-offset-1 ring-offset-bg",
              )}>
              <div className="flex items-center justify-between">
                <span className={clsx("num text-[11px] md:text-[12px]", monthStart && "font-semibold")}>
                  {monthStart ? fmtDate(d, { day: "numeric", month: "short" }) : Number(d.slice(8))}
                </span>
                <span className="flex gap-0.5">
                  {p?.sectionals && p.type !== "rest" && <span className="size-1.5 rounded-full bg-good" title={sectionalLine(p.sectionals)} />}
                  {p?.type === "mock" && <span className="size-1.5 rounded-full bg-accent" />}
                </span>
              </div>
              {isExam ? <div className="mt-1 text-[11px] md:text-[13px] font-semibold">CAT</div> : p && (
                <div className="mt-1 hidden md:block">
                  {p.sectionals && p.type !== "rest" && <div className="text-[10.5px] text-good truncate">+ {sectionalLine(p.sectionals)}</div>}
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
                <div className={clsx("md:hidden mt-1.5 text-[9.5px] leading-none truncate num", p.type === "mock" ? "text-accent font-medium" : p.tag === "Review" ? "text-warn" : "text-muted")}>
                  {p.type === "mock" ? "Mock" : p.type === "rest" ? "Rest" : `${Math.round(plannedMinutes(p) / 60)}h`}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SECTIONAL_KEYS = [["varc", "VARC"], ["dilr", "DILR"], ["qa", "QA"]] as const;
const NO_SECTIONALS: Sectionals = { varc: 0, dilr: 0, qa: 0 };

function sectionalLine(s: Sectionals | null | undefined) {
  if (!s) return "";
  const parts = SECTIONAL_KEYS.filter(([k]) => s[k] > 0).map(([k, l]) => `${s[k] > 1 ? s[k] + " " : ""}${l}`);
  return parts.length ? `${parts.join(" + ")} sectional${SECTIONAL_KEYS.reduce((a, [k]) => a + s[k], 0) > 1 ? "s" : ""}` : "";
}

// One line per item: label on the left, − value + on the right. Used in the day dialog and for sectionals.
function StepRow({ label, hint, value, step = 1, max = 500, onChange }: { label: string; hint?: string; value: number; step?: number; max?: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.max(0, Math.min(max, Math.round(n) || 0)));
  const btn = "size-8 grid place-items-center rounded-lg border border-line bg-panel text-ink-2 hover:border-line-2 active:scale-95 transition disabled:opacity-35";
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">{label}</div>
        {hint && <div className="text-[11.5px] text-muted">{hint}</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" className={btn} onClick={() => set(value - step)} disabled={value <= 0} aria-label={`Less ${label}`}><Minus size={14} /></button>
        <input type="number" inputMode="numeric" min={0} max={max} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label}
          className="h-8 w-12 text-center num font-semibold text-[15px] bg-transparent outline-none rounded-md focus:bg-panel-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        <button type="button" className={btn} onClick={() => set(value + step)} disabled={value >= max} aria-label={`More ${label}`}><Plus size={14} /></button>
      </div>
    </div>
  );
}

function TargetRows({ value, onChange }: { value: Targets; onChange: (t: Targets) => void }) {
  return (
    <div className="rounded-xl border border-line divide-y divide-line bg-panel">
      {SECTIONS.map((k) => (
        <StepRow key={k} label={SECTION_META[k].label} hint={SECTION_META[k].unit} value={value[k]} step={SECTION_META[k].step} max={SECTION_META[k].max}
          onChange={(n) => onChange({ ...value, [k]: n })} />
      ))}
    </div>
  );
}

// Sectionals stay out of the way: a small link until the day has one, then compact rows.
function SectionalCounts({ value, onChange }: { value: Sectionals | null | undefined; onChange: (s: Sectionals) => void }) {
  const v = value ?? NO_SECTIONALS;
  const any = v.varc + v.dilr + v.qa > 0;
  const [open, setOpen] = useState(any);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline">
        <Plus size={14} /> Plan a sectional
      </button>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="label">Sectionals</span>
        {!any && <button type="button" className="text-[12px] text-muted hover:text-ink" onClick={() => setOpen(false)}>Hide</button>}
      </div>
      <div className="rounded-xl border border-line divide-y divide-line bg-panel">
        {SECTIONAL_KEYS.map(([k, label]) => (
          <StepRow key={k} label={`${label} sectional`} value={v[k]} max={5} onChange={(n) => onChange({ ...v, [k]: n })} />
        ))}
      </div>
    </div>
  );
}

function targetLine(t: Targets) {
  return SECTIONS.filter((k) => t[k] > 0).map((k) => `${t[k]} ${SECTION_META[k].short}`).join(" · ") || "No practice";
}

function ListView({ today, plans, onPick }: { today: string; plans: Day[]; onPick: (d: string) => void }) {
  const from = weekStartOf(today);
  const weeks = new Map<string, Day[]>();
  for (const p of plans) {
    if (p.date < from) continue;
    const w = weekStartOf(p.date);
    weeks.set(w, [...(weeks.get(w) ?? []), p]);
  }
  return (
    <div className="mt-2 space-y-3">
      {[...weeks].map(([w, days]) => {
        const mins = days.reduce((s, d) => s + plannedMinutes(d), 0);
        const mocks = days.filter((d) => d.type === "mock").length;
        const phases = [...new Set(days.map((d) => d.phase).filter(Boolean))];
        return (
          <section key={w} className="card overflow-hidden">
            <header className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-line bg-panel-2">
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{w === from ? "This week" : `Week of ${fmtDate(w)}`}</div>
                {phases.length > 0 && <div className="text-[11.5px] text-muted truncate">{phases.join(" → ")}</div>}
              </div>
              <div className="text-[11.5px] text-muted num shrink-0">{mocks ? `${mocks} mock${mocks > 1 ? "s" : ""} · ` : ""}{Math.round(mins / 60)}h</div>
            </header>
            <ul className="divide-y divide-line">
              {days.map((p) => {
                const past = p.date < today;
                const isExam = p.date === EXAM_DATE;
                return (
                  <li key={p.date}>
                    <button disabled={past || isExam} onClick={() => onPick(p.date)}
                      className={clsx("w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors", !past && !isExam && "hover:bg-panel-2 active:bg-panel-2", past && "opacity-50", isExam && "bg-ink text-bg")}>
                      <div className={clsx("w-10 shrink-0 text-center rounded-lg py-1", p.date === today ? "bg-accent text-white" : "")}>
                        <div className="text-[10px] uppercase tracking-wide opacity-80">{WEEKDAYS[(weekday(p.date) + 6) % 7]}</div>
                        <div className="num text-[15px] font-semibold leading-tight">{Number(p.date.slice(8))}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        {isExam ? <div className="font-semibold">CAT 2026</div> : (
                          <>
                            <div className="flex items-center gap-1.5 text-[13px]">
                              {p.type === "mock" ? <span className="font-medium text-accent truncate">{p.mockName}</span>
                                : p.type === "rest" ? <span className="text-muted">Rest day</span>
                                  : <span className={clsx("font-medium truncate", p.tag ? TAG_TONE[p.tag] ?? "text-ink" : "text-ink")}>{p.tag ?? "Practice"}</span>}
                            </div>
                            {p.type !== "rest" && (
                              <div className="text-[12px] text-muted num truncate">{p.type === "mock" ? `Mock + analysis${targetLine(p.targets) !== "No practice" ? " · " + targetLine(p.targets) : ""}` : targetLine(p.targets)}</div>
                            )}
                            {p.type !== "rest" && p.sectionals && <div className="text-[12px] text-good truncate">+ {sectionalLine(p.sectionals)}</div>}
                          </>
                        )}
                      </div>
                      {!isExam && p.type !== "rest" && <div className="text-[12px] text-muted num shrink-0">{minutesToH(plannedMinutes(p))}</div>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PhaseStrip({ today, plans }: { today: string; plans: Day[] }) {
  const groups: { label: string; from: string; to: string; n: number; mocks: number }[] = [];
  for (const d of plans) {
    if (d.date < today || d.date === EXAM_DATE) continue;
    const label = d.phase ?? PHASE_LABEL[phaseOf(diffDays(EXAM_DATE, d.date))] ?? "";
    const g = groups.at(-1);
    if (g && g.label === label) { g.to = d.date; g.n++; g.mocks += d.type === "mock" ? 1 : 0; }
    else groups.push({ label, from: d.date, to: d.date, n: 1, mocks: d.type === "mock" ? 1 : 0 });
  }
  if (!groups.length) return null;
  return (
    <div className="mt-5 -mx-4 px-4 md:mx-0 md:px-0 flex gap-1.5 overflow-x-auto snap-x [scrollbar-width:none]">
      {groups.map((g, i) => (
        <div key={g.from} style={{ flexGrow: g.n, flexBasis: 0 }}
          className={clsx("snap-start shrink-0 min-w-[132px] rounded-lg border px-3 py-2", i === 0 ? "border-accent/40 bg-accent-soft" : "border-line bg-panel")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium truncate">{g.label}{i === 0 && <span className="ml-1.5 text-[10.5px] text-accent">now</span>}</span>
            <span className="text-[11px] text-muted num shrink-0">{g.mocks ? `${g.mocks} mocks` : ""}</span>
          </div>
          <div className="text-[11px] text-muted num mt-0.5 truncate">{fmtDate(g.from)}–{fmtDate(g.to)} · {g.n}d</div>
        </div>
      ))}
    </div>
  );
}

function WeekGoalBanner({ today, plans, goal }: { today: string; plans: Day[]; goal: WeekGoal }) {
  if (!goal) {
    return (
      <div className="mt-3 rounded-lg border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-[13px] flex items-start gap-2">
        <Lock size={13} className="text-warn mt-0.5 shrink-0" /> <span>No weekly goal locked yet. Lock it from the Today page; daily targets can move, the weekly goal can&apos;t.</span>
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

// Bottom sheet on phones (thumb-reachable, sticky actions), centred dialog on desktop.
function Sheet({ title, subtitle, onClose, children, footer, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={clsx("card w-full flex flex-col max-h-[94dvh] md:max-h-[88dvh] rounded-b-none md:rounded-b-[14px] rise shadow-2xl", wide ? "md:max-w-2xl" : "md:max-w-lg")}>
        <div className="md:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-line-2" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3 md:pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="font-medium text-[16px]">{title}</h2>
            {subtitle && <p className="text-[12.5px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1.5 size-9 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-panel-2"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-panel rounded-b-none md:rounded-b-[14px]">{footer}</div>}
      </div>
    </div>
  );
}

function Stepper({ s, value, onChange }: { s: (typeof SECTIONS)[number]; value: number; onChange: (n: number) => void }) {
  const { short, unit, step, max } = SECTION_META[s];
  const set = (n: number) => onChange(Math.max(0, Math.min(max, Math.round(n) || 0)));
  const btn = "size-9 shrink-0 grid place-items-center rounded-lg border border-line bg-panel text-ink-2 hover:border-line-2 active:scale-95 transition disabled:opacity-40";
  return (
    <div className="rounded-xl border border-line bg-panel-2 p-2">
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[12px] font-medium">{short}</span>
        <span className="text-[10.5px] text-muted">{unit}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <button type="button" className={btn} onClick={() => set(value - step)} disabled={value <= 0} aria-label={`Less ${short}`}><Minus size={14} /></button>
        <input type="number" inputMode="numeric" min={0} max={max} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={`${short} ${unit}`}
          className="h-9 w-full min-w-[3ch] flex-1 text-center num font-medium text-[15px] bg-transparent outline-none rounded-md focus:bg-panel [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        <button type="button" className={btn} onClick={() => set(value + step)} disabled={value >= max} aria-label={`More ${short}`}><Plus size={14} /></button>
      </div>
    </div>
  );
}

// Two per row in normal dialogs; four across only where the sheet is wide enough (`wide`).
function TargetInputs({ value, onChange, wide }: { value: Targets; onChange: (t: Targets) => void; wide?: boolean }) {
  return (
    <div className={clsx("grid grid-cols-2 gap-2", wide && "md:grid-cols-4")}>
      {SECTIONS.map((s) => <Stepper key={s} s={s} value={value[s]} onChange={(n) => onChange({ ...value, [s]: n })} />)}
    </div>
  );
}

function TypeSwitch({ value, onChange }: { value: DayType; onChange: (t: DayType) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-panel-2 border border-line">
      {(["practice", "mock", "rest"] as const).map((t) => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className={clsx("h-9 rounded-lg text-[13px] capitalize transition-all", value === t ? "bg-accent-soft text-accent border border-accent/30 font-medium shadow-sm" : "text-muted")}>{t}</button>
      ))}
    </div>
  );
}

function DayEditor({ day, onClose, templates }: { day: Day; onClose: () => void; templates: Tpl[] }) {
  const [type, setType] = useState(day.type);
  const [targets, setTargets] = useState(day.targets);
  const [mockName, setMockName] = useState(day.mockName ?? "");
  const [note, setNote] = useState(day.note ?? "");
  const [sectionals, setSectionals] = useState<Sectionals | null>(day.sectionals);
  const [error, setError] = useState<string | null>(null);
  const tag = type === day.type ? day.tag : type === "rest" ? "Rest" : null;
  const [pending, start] = useTransition();
  const tpl = templates[0];

  const switchType = (t: DayType) => {
    setType(t);
    if (t === "rest") setTargets(ZERO);
    else if (t !== day.type) setTargets(t === "mock" ? tpl.mock : tpl.practice);
    else setTargets(day.targets);
  };

  return (
    <Sheet title={fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })} subtitle={day.phase ? `${day.phase} phase` : undefined} onClose={onClose}
      footer={
        <div className="space-y-2">
          {error && <p className="text-[12.5px] text-bad">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted num">{type === "rest" ? "Rest day" : `≈ ${minutesToH(plannedMinutes({ date: day.date, type, targets }))} of work`}</span>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-accent" disabled={pending}
                onClick={() => start(async () => {
                  try {
                    await updateDay(day.date, { type, targets, mockName, note, tag, sectionals: type === "rest" ? null : sectionals });
                    onClose();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Couldn't save this day. Check the targets and try again.");
                  }
                })}>
                {pending ? "Saving…" : "Save day"}
              </button>
            </div>
          </div>
        </div>
      }>
      <TypeSwitch value={type} onChange={switchType} />
      {type === "mock" && (
        <label className="block mt-4">
          <span className="label">Mock name</span>
          <input className="input mt-1" value={mockName} maxLength={80} onChange={(e) => setMockName(e.target.value)} placeholder="e.g. SIMCAT 5, AIMCAT 2612" />
        </label>
      )}
      {type !== "rest" && (
        <div className="mt-4">
          <div className="label mb-2">{type === "mock" ? "Top-up practice (besides the mock)" : "Targets"}</div>
          <TargetRows value={targets} onChange={setTargets} />
        </div>
      )}
      {type !== "rest" && (
        <div className="mt-3">
          <SectionalCounts value={sectionals} onChange={setSectionals} />
        </div>
      )}
      <label className="block mt-4">
        <span className="label">Note</span>
        <input className="input mt-1" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Office offsite, only evening free" />
      </label>
    </Sheet>
  );
}

function tplSummary(t: Tpl) {
  if (t.phases?.length) return t.phases.map((p) => `${p.name} (${p.week.filter((s) => s.type === "mock").length} mocks/wk)`).join(" → ");
  return `Practice ${t.practice.qa}Q·${t.practice.rc}R·${t.practice.va}V·${t.practice.dilr}D · ${t.mocksPerWeek}→${t.finalStretchMocksPerWeek} mocks/wk`;
}

function TemplatePanel({ templates, current, today, onClose, onBuild }: { templates: Tpl[]; current: string | null; today: string; onClose: () => void; onBuild: (t?: Tpl) => void }) {
  const [sel, setSel] = useState(current ?? templates[0].id);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(EXAM_DATE);
  const [keepMocks, setKeepMocks] = useState(true);
  const [pending, start] = useTransition();
  const selected = templates.find((t) => t.id === sel) ?? templates[0];

  return (
    <Sheet title="Templates" subtitle="Pick one to apply, or build your own phases." onClose={onClose}
      footer={
        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent flex-1 sm:flex-none" disabled={pending}
            onClick={() => start(async () => { await applyTemplate(sel, from, to, keepMocks); onClose(); })}>
            {pending ? "Applying…" : "Apply to range"}
          </button>
        </div>
      }>
      <button onClick={() => onBuild(selected.custom ? undefined : selected)}
        className="w-full rounded-xl border border-dashed border-accent/50 bg-accent-soft p-3.5 text-left hover:border-accent transition-colors">
        <div className="flex items-center gap-2 font-medium text-[14px] text-accent"><Plus size={15} /> Build your own plan</div>
        <p className="text-[12.5px] text-muted mt-0.5">Split the weeks into your own phases and set every weekday: practice, mock or rest, with your own targets.</p>
      </button>

      <div className="mt-3 space-y-2">
        {templates.map((t) => (
          <div key={t.id} role="button" tabIndex={0} onClick={() => setSel(t.id)} onKeyDown={(e) => e.key === "Enter" && setSel(t.id)}
            className={clsx("rounded-xl border p-3.5 cursor-pointer transition-all", sel === t.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-2")}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[14px] min-w-0">
                {t.name}
                {current === t.id && <span className="chip ml-1.5 !h-5 !text-[10.5px]">active</span>}
                {t.custom && <span className="chip ml-1.5 !h-5 !text-[10.5px]">yours</span>}
              </span>
              <div className="flex shrink-0 -mr-1.5">
                <button title={t.custom ? "Edit" : "Copy and customise"} aria-label={t.custom ? "Edit template" : "Copy and customise"}
                  className="size-8 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-panel-2" onClick={(e) => { e.stopPropagation(); onBuild(t); }}>
                  {t.custom ? <Pencil size={14} /> : <Copy size={14} />}
                </button>
                {t.custom && (
                  <button title="Delete" aria-label="Delete template" className="size-8 grid place-items-center rounded-lg text-muted hover:text-bad hover:bg-panel-2"
                    onClick={(e) => { e.stopPropagation(); start(() => deleteCustomTemplate(t.id)); }}><Trash2 size={14} /></button>
                )}
              </div>
            </div>
            <p className="text-[12.5px] text-muted mt-0.5">{t.description}</p>
            <div className="mt-2 text-[11.5px] text-muted num">{tplSummary(t)}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-line space-y-3">
        <div className="label">Apply “{selected.name}”</div>
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">From</span><input type="date" className="input mt-1 num" value={from} min={today} max={EXAM_DATE} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="label">To</span><input type="date" className="input mt-1 num" value={to} min={from} max={EXAM_DATE} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={keepMocks} onChange={(e) => setKeepMocks(e.target.checked)} />
          <span>Keep my current mock/rest days, only change targets<span className="block text-muted text-[12px]">Untick to also rebuild the mock schedule from this template.</span></span>
        </label>
      </div>
    </Sheet>
  );
}

// ---------- Plan builder: user-defined phases, each with its own Mon..Sun pattern ----------

function PlanBuilder({ initial, today, onClose }: { initial: Draft; today: string; onClose: () => void }) {
  const lastDay = addDays(EXAM_DATE, -1);
  const [name, setName] = useState(initial.name);
  const [phases, setPhases] = useState<PhaseDef[]>(() => {
    const ps = structuredClone(initial.phases);
    ps[ps.length - 1].until = lastDay;
    return ps;
  });
  const [open, setOpen] = useState<number | null>(0);
  const [applyNow, setApplyNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const startOf = (i: number) => (i === 0 ? today : addDays(phases[i - 1].until, 1));
  const preview = useMemo(() => generatePhased(today, phases), [today, phases]);
  const stats = (label: string) => {
    const ds = preview.filter((d) => d.phase === label);
    return { n: ds.length, study: ds.filter((d) => d.type !== "rest").length, mocks: ds.filter((d) => d.type === "mock").length, mins: ds.reduce((s, d) => s + plannedMinutes(d), 0) };
  };
  const totalMocks = preview.filter((d) => d.type === "mock").length;
  const totalMins = preview.reduce((s, d) => s + plannedMinutes(d), 0);
  const studyDays = preview.filter((d) => d.type !== "rest").length;

  const update = (i: number, p: PhaseDef) => { setError(null); setPhases(phases.map((x, j) => (j === i ? p : x))); };
  // Phases are back to back: moving a phase's start moves the previous phase's end.
  const setStart = (i: number, date: string) => {
    const lo = addDays(startOf(i - 1), 1), hi = phases[i].until;
    const d = date < lo ? lo : date > hi ? hi : date;
    update(i - 1, { ...phases[i - 1], until: addDays(d, -1) });
  };
  const remove = (i: number) => {
    const next = phases.filter((_, j) => j !== i);
    next[next.length - 1] = { ...next[next.length - 1], until: lastDay };
    setPhases(next);
    setOpen(null);
  };
  const addPhase = () => {
    // Split the last phase in two; the new one copies its weekly pattern.
    const i = phases.length - 1;
    const from = startOf(i);
    const len = diffDays(lastDay, from) + 1;
    if (len < 2) return setError("The last phase is too short to split. Shorten an earlier phase first.");
    const mid = addDays(from, Math.floor(len / 2) - 1);
    const last = phases[i];
    setPhases([...phases.slice(0, i), { ...last, until: mid }, { name: `Phase ${phases.length + 1}`, until: lastDay, week: structuredClone(last.week) }]);
    setOpen(phases.length);
  };
  const names = phases.map((p) => p.name.trim());
  const dupName = names.find((n, i) => n && names.indexOf(n) !== i);

  const save = () => start(async () => {
    try {
      const id = await saveCustomTemplate({ id: initial.id, name, phases });
      if (applyNow) await applyTemplate(id, today, EXAM_DATE, false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Check your phases and try again.");
    }
  });

  return (
    <Sheet wide title={initial.id ? "Edit your plan" : "Build your plan"} subtitle="Split your time into phases. Each phase repeats its own week." onClose={onClose}
      footer={
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted num">
            <span><b className="text-ink font-medium">{totalMocks}</b> mocks</span>
            <span><b className="text-ink font-medium">{Math.round(totalMins / 60)}h</b> total</span>
            <span>≈ <b className="text-ink font-medium">{minutesToH(studyDays ? totalMins / studyDays : 0)}</b> per study day</span>
          </div>
          <label className="flex items-start gap-2 text-[12.5px]">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} />
            <span>Apply from today<span className="text-muted"> (rebuilds upcoming days; past days and logs stay)</span></span>
          </label>
          {(error || dupName) && <p className="text-[12.5px] text-bad">{error ?? `Two phases are called “${dupName}”. Give each a different name.`}</p>}
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-accent flex-1" disabled={pending || !name.trim() || !!dupName || names.some((n) => !n)} onClick={save}>
              {pending ? "Saving…" : applyNow ? "Save & apply" : "Save template"}
            </button>
          </div>
        </div>
      }>
      <label className="block">
        <span className="label">Plan name</span>
        <input className="input mt-1" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="My plan" />
      </label>

      <div className="mt-4 flex items-center justify-between">
        <div className="label">Your phases</div>
        <span className="text-[11.5px] text-muted num">{phases.length} phase{phases.length > 1 ? "s" : ""} · {fmtDate(today)} → CAT</span>
      </div>
      <PhaseTimeline phases={phases} today={today} onPick={setOpen} open={open} />

      <div className="mt-3 space-y-2">
        {phases.map((p, i) => (
          <PhaseCard key={i} index={i} phase={p} from={startOf(i)} isLast={i === phases.length - 1} canRemove={phases.length > 1}
            minStart={i === 0 ? today : addDays(startOf(i - 1), 1)} nextUntil={i < phases.length - 1 ? phases[i + 1].until : null}
            stats={stats(p.name)} open={open === i} onToggle={() => setOpen(open === i ? null : i)}
            onChange={(np) => update(i, np)} onStart={(d) => setStart(i, d)} onRemove={() => remove(i)} />
        ))}
      </div>
      {phases.length < 8 && (
        <button className="mt-2 w-full h-11 rounded-xl border border-dashed border-line-2 text-[13px] text-muted hover:text-ink hover:border-ink/30 inline-flex items-center justify-center gap-1.5" onClick={addPhase}>
          <Plus size={14} /> Add a phase
        </button>
      )}
    </Sheet>
  );
}

function PhaseTimeline({ phases, today, open, onPick }: { phases: PhaseDef[]; today: string; open: number | null; onPick: (i: number) => void }) {
  const total = Math.max(1, diffDays(EXAM_DATE, today));
  const lens = phases.map((p, i) => {
    const prev = i === 0 ? addDays(today, -1) : phases[i - 1].until;
    return Math.max(0, diffDays(p.until, prev < addDays(today, -1) ? addDays(today, -1) : prev));
  });
  return (
    <div className="mt-2 flex h-2.5 gap-0.5 rounded-full overflow-hidden">
      {phases.map((p, i) => {
        const n = lens[i];
        return <button key={i} aria-label={p.name} onClick={() => onPick(i)} style={{ flexGrow: n || 0.3, flexBasis: 0 }}
          className={clsx("transition-colors", open === i ? "bg-accent" : i % 2 ? "bg-accent/35" : "bg-accent/55")} title={`${p.name}: ${Math.round((n / total) * 100)}%`} />;
      })}
    </div>
  );
}

function PhaseCard({ index, phase, from, isLast, canRemove, minStart, nextUntil, stats, open, onToggle, onChange, onStart, onRemove }: {
  index: number; phase: PhaseDef; from: string; isLast: boolean; canRemove: boolean; minStart: string; nextUntil: string | null;
  stats: { n: number; study: number; mocks: number; mins: number }; open: boolean; onToggle: () => void; onChange: (p: PhaseDef) => void; onStart: (date: string) => void; onRemove: () => void;
}) {
  const [day, setDay] = useState<number | null>(null); // null = edit every practice day together
  const practice = phase.week.filter((s) => s.type === "practice");
  const differs = practice.some((s) => SECTIONS.some((k) => s.targets[k] !== practice[0].targets[k]));
  const over = phase.until < from;

  const setSlot = (i: number, slot: WeekSlot) => onChange({ ...phase, week: phase.week.map((s, j) => (j === i ? slot : s)) });
  const setAllPractice = (t: Targets) => onChange({ ...phase, week: phase.week.map((s) => (s.type === "practice" ? { ...s, targets: t } : s)) });
  const setType = (i: number, type: DayType) => {
    const cur = phase.week[i];
    if (cur.type === type) return;
    // Borrow targets from another day of the same kind so switching doesn't start from zero.
    const like = phase.week.find((s) => s.type === type)?.targets;
    setSlot(i, { type, targets: type === "rest" ? ZERO : like ?? (type === "mock" ? ZERO : practice[0]?.targets ?? ZERO), sectionals: type === "rest" ? null : cur.sectionals });
  };
  const sel = day === null ? null : phase.week[day];
  const perPractice = practice[0] ? plannedMinutes({ date: from, type: "practice", targets: sel?.type === "practice" ? sel.targets : practice[0].targets }) : 0;

  return (
    <div className={clsx("rounded-xl border transition-colors", open ? "border-accent/50 bg-panel" : "border-line bg-panel")}>
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 p-3 text-left">
        <span className={clsx("size-6 shrink-0 grid place-items-center rounded-full text-[11px] font-semibold num", open ? "bg-accent text-white" : "bg-panel-2 border border-line text-ink-2")}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium truncate">{phase.name || "Untitled phase"}</div>
          <div className="text-[11.5px] text-muted num truncate">
            {over ? "Already over" : `${fmtDate(from)} – ${isLast ? "CAT" : fmtDate(phase.until)} · ${stats.n}d`}
            {!over && ` · ${stats.mocks} mocks · ≈${Math.round(stats.mins / 60 / Math.max(1, stats.study))}h/day`}
          </div>
        </div>
        <WeekDots week={phase.week} />
        <ChevronDown size={16} className={clsx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-line space-y-4">
          <label className="block pt-2">
            <span className="label">Phase name</span>
            <input className="input mt-1" value={phase.name} maxLength={24} onChange={(e) => onChange({ ...phase, name: e.target.value })} placeholder="e.g. Foundation, Mock phase, Revision" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Starts</span>
              {index === 0
                ? <div className="input mt-1 flex items-center text-muted text-[13px] bg-panel-2 num">Today · {fmtDate(from)}</div>
                : <input type="date" className="input mt-1 num" value={from} min={minStart} max={phase.until}
                    onChange={(e) => e.target.value && onStart(e.target.value)} />}
            </label>
            <label className="block">
              <span className="label">Ends</span>
              {isLast
                ? <div className="input mt-1 flex items-center text-muted text-[13px] bg-panel-2">Day before CAT</div>
                : <input type="date" className="input mt-1 num" value={phase.until}
                    min={from} max={nextUntil ? addDays(nextUntil, -1) : undefined}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const hi = nextUntil ? addDays(nextUntil, -1) : v;
                      onChange({ ...phase, until: v < from ? from : v > hi ? hi : v });
                    }} />}
            </label>
          </div>
          {!isLast && <p className="-mt-2 text-[11.5px] text-muted num">{stats.n} days. The next phase starts {fmtDate(addDays(phase.until, 1))}.</p>}

          <div>
            <div className="flex items-center justify-between">
              <span className="label">Weekly pattern</span>
              <span className="text-[11px] text-muted">Tap a day to change it</span>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {phase.week.map((s, i) => (
                <button key={i} onClick={() => setDay(day === i ? null : i)} aria-pressed={day === i}
                  className={clsx("rounded-lg border py-1.5 text-center transition-all active:scale-95",
                    s.type === "mock" ? "bg-accent-soft border-accent/30" : s.type === "rest" ? "bg-panel-2 border-dashed border-line" : "bg-panel border-line",
                    day === i && "ring-2 ring-accent ring-offset-1 ring-offset-panel")}>
                  <div className="text-[11px] font-medium relative">{WEEKDAYS[i].slice(0, 2)}{s.type !== "rest" && s.sectionals && (s.sectionals.varc + s.sectionals.dilr + s.sectionals.qa) > 0 && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-good" />}</div>
                  <div className={clsx("text-[9.5px] mt-0.5 num", s.type === "mock" ? "text-accent font-medium" : "text-muted")}>
                    {s.type === "mock" ? "Mock" : s.type === "rest" ? "Rest" : `${Math.round(plannedMinutes({ date: from, type: "practice", targets: s.targets }) / 60)}h`}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-panel-2/60 border border-line p-3">
            {sel === null ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[13px] font-medium">Every practice day</span>
                  <span className="text-[11.5px] text-muted num">{practice.length ? `${practice.length} days/wk · ≈ ${minutesToH(perPractice)} each` : ""}</span>
                </div>
                {practice.length ? (
                  <>
                    <TargetInputs wide value={practice[0].targets} onChange={setAllPractice} />
                    {differs && <p className="mt-2 text-[12px] text-warn">Your practice days have different targets. Changing them here sets all of them to the same.</p>}
                  </>
                ) : <p className="text-[12.5px] text-muted">No practice days in this week. Tap a day above to add one.</p>}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[13px] font-medium">Every {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][day!]}</span>
                  <button className="text-[12px] text-accent hover:underline" onClick={() => setDay(null)}>Edit all practice days</button>
                </div>
                <TypeSwitch value={sel.type} onChange={(t) => setType(day!, t)} />
                {sel.type !== "rest" && (
                  <div className="mt-3">
                    <div className="label mb-2">{sel.type === "mock" ? "Top-up practice (besides the mock)" : "Targets"}</div>
                    <TargetInputs wide value={sel.targets} onChange={(t) => setSlot(day!, { ...sel, targets: t })} />
                    <p className="mt-2 text-[12px] text-muted num">≈ {minutesToH(plannedMinutes({ date: from, type: sel.type, targets: sel.targets }))} of work</p>
                    <div className="mt-3">
                      <SectionalCounts key={day} value={sel.sectionals} onChange={(sc) => setSlot(day!, { ...sel, sectionals: sc })} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {canRemove && (
            <div className="flex justify-end">
              <button className="btn btn-ghost btn-sm text-bad" onClick={onRemove}><Trash2 size={13} /> Remove phase</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WeekDots({ week }: { week: WeekSlot[] }) {
  return (
    <div className="flex gap-0.5 shrink-0" aria-hidden>
      {week.map((s, i) => (
        <span key={i} className={clsx("w-1.5 h-4 rounded-sm", s.type === "mock" ? "bg-accent" : s.type === "rest" ? "bg-line" : "bg-ink/25")} />
      ))}
    </div>
  );
}
