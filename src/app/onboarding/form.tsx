"use client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { AlertTriangle, Check } from "lucide-react";
import { checkUsername, completeOnboarding } from "../actions";
import { SYSTEM_TEMPLATES } from "@/lib/templates";
import { generatePlan } from "@/lib/plan-generator";
import { SECTIONS, SECTION_META, type Section } from "@/lib/cat";
import { plannedMinutes, minutesToH } from "@/lib/progress";
import { targetBand } from "@/lib/cat-history";
import { VisibilityField } from "@/components/prompts";

const PRESETS = [95, 97, 98, 99, 99.5];

export function OnboardingForm({ today, suggested }: { today: string; suggested: string }) {
  const [username, setUsername] = useState(suggested);
  const [uState, setUState] = useState<{ ok: boolean; reason?: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onUsername = (v: string) => {
    setUsername(v);
    clearTimeout(timer.current);
    if (!v) return setUState(null);
    timer.current = setTimeout(async () => setUState(await checkUsername(v)), 350);
  };
  useEffect(() => {
    if (suggested) checkUsername(suggested).then(setUState);
  }, [suggested]);
  const [target, setTarget] = useState(99);
  const [weak, setWeak] = useState<Section[]>([]);
  const [tpl, setTpl] = useState(SYSTEM_TEMPLATES[0].id);
  const [start, setStart] = useState(7);
  const [end, setEnd] = useState(23);
  const [state, formAction] = useActionState(completeOnboarding, null);

  const preview = useMemo(() => {
    const t = SYSTEM_TEMPLATES.find((x) => x.id === tpl)!;
    const days = generatePlan({ start: today, template: t, weak });
    const mocks = days.filter((d) => d.type === "mock").length;
    const mins = days.reduce((s, d) => s + plannedMinutes(d), 0);
    const practice = days.find((d) => d.type === "practice");
    return { mocks, mins, days: days.length, practice, perDay: practice ? plannedMinutes(practice) : 0 };
  }, [tpl, weak, today]);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <Step n={0} title="Username & profile visibility" hint="Friends find you by this. Your profile lives at /u/username.">
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
          <input name="username" required value={username} onChange={(e) => onUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            maxLength={20} className="input !pl-7 num" placeholder="manthan_99" />
        </div>
        {uState && <p className={clsx("mt-1.5 text-[12.5px]", uState.ok ? "text-good" : "text-bad")}>{uState.ok ? "Available ✓" : uState.reason}</p>}
        <div className="mt-5">
          <div className="text-[14px] font-medium">Who can see your profile?</div>
          <p className="mt-0.5 mb-2.5 text-[13px] text-muted">Your &ldquo;why&rdquo;, notes and notification settings are never shared. Change it any time in Settings.</p>
          <VisibilityField initial="friends" />
        </div>
      </Step>

      <Step n={1} title="Target percentile">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button type="button" key={p} onClick={() => setTarget(p)}
              className={clsx("btn btn-sm num", target === p ? "btn-primary" : "btn-ghost")}>{p}</button>
          ))}
          <input name="targetPercentile" type="number" step="0.1" min={50} max={100} value={target}
            onChange={(e) => setTarget(Number(e.target.value))} className="input num w-24 h-[30px]" />
        </div>
        {targetBand(target) && (
          <p className="mt-2 text-[12.5px] text-muted">
            {target} %ile took <span className="num text-ink">{targetBand(target)!.lo.toFixed(0)}–{targetBand(target)!.hi.toFixed(0)}</span> marks out of ~200 in CAT 2021–25, depending on the year&apos;s difficulty.
          </p>
        )}
      </Step>

      <Step n={2} title="Where, and why" hint="The coach quotes this back to you on bad days.">
        <input name="dreamColleges" className="input" placeholder="IIM A, IIM B, IIM C, FMS" />
        <textarea name="why" rows={3} className="input mt-2"
          placeholder="e.g. I want to move from engineering into business leadership. An IIM puts that 5 years closer." />
      </Step>

      <Step n={3} title="Weak sections" hint="Used by the Weakness-focus template and the coach.">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <label key={s} className={clsx("btn btn-sm", weak.includes(s) ? "btn-primary" : "btn-ghost")}>
              <input type="checkbox" name="weakSections" value={s} className="sr-only" checked={weak.includes(s)}
                onChange={(e) => setWeak((w) => (e.target.checked ? [...w, s] : w.filter((x) => x !== s)))} />
              {weak.includes(s) && <Check size={13} />} {SECTION_META[s].label}
            </label>
          ))}
        </div>
      </Step>

      <Step n={4} title="Study window (IST)" hint="Check-ins are timed against this. 3 PM in a 7 AM–11 PM window = you should be ~50% done.">
        <div className="flex items-center gap-2">
          <HourSelect name="studyStartHour" value={start} onChange={setStart} />
          <span className="text-muted">to</span>
          <HourSelect name="studyEndHour" value={end} onChange={setEnd} min={start + 1} />
        </div>
      </Step>

      <Step n={5} title="Pick a template">
        <input type="hidden" name="templateId" value={tpl} />
        <div className="grid gap-2 md:grid-cols-2">
          {SYSTEM_TEMPLATES.map((t) => (
            <button type="button" key={t.id} onClick={() => setTpl(t.id)}
              className={clsx("text-left rounded-xl border p-4 transition-all",
                tpl === t.id ? "border-accent bg-accent-soft ring-2 ring-accent/15" : "border-line bg-panel hover:border-line-2")}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.name}</span>
                {tpl === t.id && <span className="size-5 rounded-full bg-accent text-white grid place-items-center"><Check size={12} /></span>}
              </div>
              <p className="mt-1 text-[13px] text-muted leading-relaxed">{t.description}</p>
              <div className="mt-3 flex gap-1.5 flex-wrap">
                {SECTIONS.map((s) => (
                  <span key={s} className="chip num">{SECTION_META[s].short} {t.practice[s]}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-line-2 p-4 text-[13.5px] grid grid-cols-3 gap-3">
          <Stat k="Days planned" v={String(preview.days)} />
          <Stat k="Mocks scheduled" v={String(preview.mocks)} />
          <Stat k="Practice day" v={`~${minutesToH(preview.perDay)}`} />
        </div>
      </Step>

      <div className="flex items-center justify-end gap-3 pt-2">
        {state && !state.ok && (
          <p className="text-[13px] text-bad inline-flex items-center gap-1.5"><AlertTriangle size={14} /> {state.error}</p>
        )}
        <Submit disabled={!uState?.ok} />
      </div>
    </form>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 rise" style={{ animationDelay: `${n * 50}ms` }}>
      <div className="flex items-baseline gap-3">
        <span className="label num">0{n}</span>
        <h2 className="font-medium">{title}</h2>
      </div>
      {hint && <p className="mt-1 ml-8 text-[13px] text-muted">{hint}</p>}
      <div className="mt-4 md:ml-8">{children}</div>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div><div className="label">{k}</div><div className="num text-xl mt-1">{v}</div></div>;
}

function HourSelect({ name, value, onChange, min = 0 }: { name: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <select name={name} value={value} onChange={(e) => onChange(Number(e.target.value))} className="input w-32 num">
      {Array.from({ length: 25 }, (_, h) => h).filter((h) => h >= min).map((h) => (
        <option key={h} value={h}>{h === 24 ? "12 AM" : `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`}</option>
      ))}
    </select>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-accent h-11 px-6" disabled={pending || disabled}>{pending ? "Building your plan…" : "Build my plan →"}</button>;
}
