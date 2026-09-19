import { Suspense } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Flame, Target, TrendingUp } from "lucide-react";
import { requireProfile, loadUserState, type UserState } from "@/lib/data";
import { daysToExam, fmtDate, fmtHour } from "@/lib/cat";
import { MAX_SCORE, minutesToH } from "@/lib/progress";
import { fmtPct, percentileBand, targetBand } from "@/lib/cat-history";
import { TodayCard } from "@/components/dash/today-card";
import { PaceChart } from "@/components/dash/pace-chart";
import { Heatmap } from "@/components/dash/heatmap";
import { CoachCard, CoachSkeleton } from "@/components/dash/coach-card";
import { WeeklyGoalCard } from "@/components/dash/weekly-goal";
import { Welcome } from "@/components/dash/welcome-server";

export default async function Dashboard() {
  const { user } = await requireProfile();
  const s = (await loadUserState(user.id))!;
  const left = daysToExam(s.today);

  return (
    <div className="space-y-4">
      <Welcome s={s} />
      <Hero s={s} left={left} />
      <div className="rise" style={{ animationDelay: "20ms" }}>
        <Suspense fallback={<CoachSkeleton />}><CoachCard state={s} /></Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rise" style={{ animationDelay: "40ms" }}>
          <TodayCard plan={s.todayPlan} done={s.todayDone} today={s.today} />
        </div>
        <div className="space-y-4 rise" style={{ animationDelay: "80ms" }}>
          <GoalCard s={s} />
          <WeeklyGoalCard week={s.week} />
        </div>
      </div>

      <div className="rise" style={{ animationDelay: "120ms" }}><CostOfToday s={s} /></div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2 rise" style={{ animationDelay: "160ms" }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="label">Road to 29 Nov</div>
              <h3 className="mt-1 font-medium">Planned vs. done study hours</h3>
            </div>
            <p className="text-[13px] text-muted">
              At your {Math.round(s.stats.consistency * 100)}% consistency you&apos;ll put in{" "}
              <span className="num text-ink">{Math.round(s.stats.projectedTotal / 60)}h</span> of{" "}
              <span className="num text-ink">{Math.round(s.stats.planTotal / 60)}h</span> planned.
            </p>
          </div>
          <div className="mt-4"><PaceChart series={s.stats.series} today={s.today} /></div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 rise" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center justify-between">
              <span className="label">Last 4 weeks</span>
              <span className="chip num"><Flame size={12} className={s.stats.streak ? "text-warn" : "text-muted"} />{s.stats.streak}-day streak</span>
            </div>
            <div className="mt-4"><Heatmap history={s.stats.history} today={s.today} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS: Record<UserState["stats"]["todayStatus"], { tone: string; text: (s: UserState) => string }> = {
  ahead: { tone: "good", text: () => "Ahead of pace. Bank it, then stop on time." },
  "on-track": { tone: "good", text: () => "On pace for today." },
  behind: { tone: "warn", text: () => "Behind pace for this time of day." },
  "way-behind": { tone: "bad", text: (s) => s.stats.today.done === 0 ? `It's ${fmtHour(s.hour)} and nothing is logged yet.` : "Well behind pace. Today is slipping." },
  "not-started": { tone: "muted", text: () => "Day hasn't started. First block sets the tone." },
  rest: { tone: "muted", text: () => "Rest day." },
};

function Hero({ s, left }: { s: UserState; left: number }) {
  const st = STATUS[s.stats.todayStatus];
  const pct = Math.round((s.stats.today.ratio || 0) * 100);
  const exp = s.stats.today.planned ? Math.round((s.stats.todayExpected / s.stats.today.planned) * 100) : 0;
  const greet = s.hour < 12 ? "Good morning" : s.hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <section className="relative rise">
      <div className="grid-bg absolute -inset-x-4 -top-6 h-48 -z-10" />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-muted text-sm">{greet}, {s.firstName} · {fmtDate(s.today, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 text-[32px] md:text-[40px] font-semibold tracking-[-0.03em] leading-tight">
            <span className="num">{left}</span> days. <span className="text-muted">Make today count.</span>
          </h1>
        </div>
        {s.stats.todayStatus !== "rest" && (
          <div className={clsx("rounded-xl border px-4 py-3 md:min-w-[320px]",
            st.tone === "good" && "border-good/30 bg-good-soft",
            st.tone === "warn" && "border-warn/30 bg-warn-soft",
            st.tone === "bad" && "border-bad/30 bg-bad-soft",
            st.tone === "muted" && "border-line bg-panel")}>
            <div className="flex items-center gap-2 text-[13px] font-medium">
              {st.tone === "bad" || st.tone === "warn" ? <AlertTriangle size={14} className={st.tone === "bad" ? "text-bad" : "text-warn"} /> : <span className={clsx("size-2 rounded-full", st.tone === "good" ? "bg-good" : "bg-muted")} />}
              {st.text(s)}
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-line relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--s-done)] transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
              <div className="absolute inset-y-[-3px] w-0.5 bg-ink" style={{ left: `${exp}%` }} title="Where you should be now" />
            </div>
            <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-muted num">
              <span>{pct}% done · {minutesToH(s.stats.today.done)}</span>
              <span>should be ~{exp}% by {fmtHour(s.hour)}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function GoalCard({ s }: { s: UserState }) {
  const target = s.profile.targetPercentile;
  const p = s.projection;
  const band = targetBand(target);
  const need = Math.max(1, 2 - s.mocks.filter((m) => m.score != null).length);
  const est = p ? percentileBand(p.projected) : null;
  // Safe = cleared the target in every past year; in band = would have in some years.
  const tone = !p || !band ? (p && p.rate > 0 ? "text-good" : "text-muted") : p.projected >= band.hi ? "text-good" : p.projected >= band.lo ? "text-warn" : "text-bad";
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center justify-between">
        <span className="label inline-flex items-center gap-1.5"><Target size={12} /> Goal · {target} %ile</span>
        {s.profile.dreamColleges.length > 0 && <span className="text-[12px] text-muted truncate max-w-[60%]">{s.profile.dreamColleges.join(" · ")}</span>}
      </div>
      <div className="mt-2 text-[12.5px] text-muted num">
        Mocks: <span className="text-ink">{s.mocksTaken}</span> taken · {s.mocksPlannedLeft} planned before CAT
      </div>
      <div className="mt-4 flex items-end gap-6">
        <div>
          <div className="text-[12px] text-muted">Score needed</div>
          <div className="num text-[34px] leading-none font-medium mt-1">{band ? band.hi.toFixed(0) : "—"}</div>
        </div>
        <div>
          <div className="text-[12px] text-muted">Projected on CAT day</div>
          <div className={clsx("num text-[34px] leading-none font-medium mt-1", tone)}>{p ? p.projected.toFixed(0) : "—"}</div>
        </div>
      </div>
      {band && (
        <p className="mt-2 text-[12px] text-muted">
          {target} %ile took <span className="num text-ink-2">{band.lo.toFixed(0)}–{band.hi.toFixed(0)}</span> marks in CAT 2021–25. The top of that range is the safe target.
        </p>
      )}
      {p ? (
        <>
          <Scale base={p.base} projected={p.projected} band={band} />
          <p className="mt-3 text-[13px] text-ink-2 leading-relaxed">
            {est && <>Projected <span className="num">{p.projected.toFixed(0)}</span> ≈ <b className="num">{est.belowAll ? "<90" : `${fmtPct(est.lo)}${est.hi !== est.lo ? `–${fmtPct(est.hi)}` : ""}${est.aboveSome ? "+" : ""}`}</b> %ile on past papers. </>}
            {p.rate <= 0
              ? <>Your mock scores aren&apos;t rising yet. Mock analysis is where the next marks come from.</>
              : band && p.projected < band.hi
                ? <>Short of the safe target by <b className="num">{(band.hi - p.projected).toFixed(0)}</b> marks. At full consistency you&apos;d gain ~<span className="num">{(p.rate * 7).toFixed(1)}</span> marks/week instead of <span className="num">{p.perWeekNow.toFixed(1)}</span>.</>
                : <>On course for your target in every recent year if you keep this consistency.</>}
          </p>
          <details className="mt-auto pt-3 text-[11.5px] text-muted">
            <summary className="cursor-pointer hover:text-ink">How is this projected?</summary>
            <p className="mt-1.5 leading-relaxed">
              Fits a straight line through your {p.mocks} mock scores, then scales that improvement rate by your 14-day consistency ({Math.round(s.stats.consistency * 100)}%).
              The rate is capped at ±1 mark/day so one lucky mock can&apos;t dominate. The %ile estimate reads that score against published CAT 2021–25 score-vs-percentile data
              (see <Link href="/mocks" className="text-accent hover:underline">Mocks</Link>). Mocks vary in difficulty, so treat both as rough estimates, not predictions.
            </p>
          </details>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-line-2 p-3 text-[13px] text-muted">
          Log <b className="text-ink">{need}</b> more mock score{need === 1 ? "" : "s"} to unlock your score projection.{" "}
          <Link href="/mocks" className="text-accent hover:underline">Log a mock →</Link>
          {s.nextMock && <div className="mt-1">Next planned: {s.nextMock.mockName} on {fmtDate(s.nextMock.date, { weekday: "short", day: "numeric", month: "short" })}.</div>}
        </div>
      )}
    </div>
  );
}

function Scale({ base, projected, band }: { base: number; projected: number; band: { lo: number; hi: number } | null }) {
  const vals = [base, projected, ...(band ? [band.lo, band.hi] : [])];
  const lo = Math.max(0, Math.floor(Math.min(...vals) / 20) * 20 - 20);
  const hi = Math.min(MAX_SCORE, Math.ceil(Math.max(...vals) / 20) * 20 + 20);
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="mt-5">
      <div className="relative h-2 rounded-full bg-line">
        {band && <div className="absolute -inset-y-1 rounded bg-[var(--s-plan)]/25" style={{ left: x(band.lo), width: `calc(${x(band.hi)} - ${x(band.lo)})` }} title="Target band" />}
        <div className="absolute inset-y-0 rounded-full bg-[var(--s-done)]/35" style={{ left: x(Math.min(base, projected)), width: `calc(${x(Math.max(base, projected))} - ${x(Math.min(base, projected))})` }} />
        <Dot at={x(base)} className="bg-panel border-2 border-[var(--s-done)]" label={`now ${base.toFixed(0)}`} />
        <Dot at={x(projected)} className="bg-[var(--s-done)] border-2 border-panel" label={`CAT day ${projected.toFixed(0)}`} />
        {band && <div className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-ink" style={{ left: x(band.hi) }} title={`safe target ${band.hi.toFixed(0)}`} />}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-muted num">
        <span>{lo}</span>
        <span>now <span className="text-ink-2">{base.toFixed(0)}</span>{band && <> · target band <span className="text-ink-2">{band.lo.toFixed(0)}–{band.hi.toFixed(0)}</span></>}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}
function Dot({ at, className, label }: { at: string; className: string; label: string }) {
  return <div className={clsx("absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full", className)} style={{ left: at }} title={label} />;
}

function CostOfToday({ s }: { s: UserState }) {
  const i = s.impact;
  const planned = s.stats.today.planned;
  if (!planned) return null;
  const hasP = i.scoreIfDone != null && i.scoreIfSkip != null;
  // Consistency needs some history; on day 1 it would swing 100% ↔ 0% and mean nothing.
  const pastDays = s.stats.history.filter((h) => h.date < s.today && h.planned > 0).length;
  const rows = [
    hasP && { k: "Projected mock score", done: i.scoreIfDone!.toFixed(1), skip: i.scoreIfSkip!.toFixed(1), delta: (i.scoreIfSkip! - i.scoreIfDone!).toFixed(1) },
    pastDays >= 3 && { k: "14-day consistency", done: `${Math.round(i.consistencyIfDone * 100)}%`, skip: `${Math.round(i.consistencyIfSkip * 100)}%`, delta: `${Math.round((i.consistencyIfSkip - i.consistencyIfDone) * 100)} pts` },
    { k: "Backlog to carry", done: minutesToH(s.stats.debtMinutes), skip: minutesToH(s.stats.debtMinutes + i.debtAddedMinutes), delta: `+${minutesToH(i.debtAddedMinutes)}` },
    { k: "Extra study per day till CAT", done: `${Math.round(s.stats.extraPerDay)} min`, skip: `${Math.round(i.extraPerDayIfSkip)} min`, delta: `+${Math.round(i.extraPerDayIfSkip - s.stats.extraPerDay)} min` },
  ].filter(Boolean) as { k: string; done: string; skip: string; delta: string }[];

  return (
    <div className="card overflow-hidden h-full">
      <div className="px-5 pt-5 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="label">The cost of today</div>
          <h3 className="mt-1 font-medium">What finishing today vs. skipping it does to your goal</h3>
        </div>
        <p className="text-[12.5px] text-muted">Today = <span className="num text-ink">{((planned / Math.max(1, s.stats.remainingPlanned)) * 100).toFixed(1)}%</span> of all prep left before CAT</p>
      </div>
      <div className="mt-4 grid md:grid-cols-2 border-t border-line">
        <div className="p-5 md:border-r border-line bg-good-soft/40">
          <div className="flex items-center gap-2 text-[13px] font-medium text-good"><ArrowUpRight size={15} /> If you finish today</div>
          <ul className="mt-3 space-y-2">
            {rows.map((r) => (
              <li key={r.k} className="flex justify-between text-[13.5px]"><span className="text-muted">{r.k}</span><span className="num">{r.done}</span></li>
            ))}
          </ul>
        </div>
        <div className="p-5 bg-bad-soft/40 border-t md:border-t-0 border-line">
          <div className="flex items-center gap-2 text-[13px] font-medium text-bad"><ArrowDownRight size={15} /> If you skip the rest</div>
          <ul className="mt-3 space-y-2">
            {rows.map((r) => (
              <li key={r.k} className="flex justify-between text-[13.5px]">
                <span className="text-muted">{r.k}</span>
                <span className="num">{r.skip} <span className="text-bad text-[11.5px] ml-1">{r.delta}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {!hasP && (
        <div className="px-5 py-3 border-t border-line text-[12.5px] text-muted inline-flex items-center gap-1.5 w-full">
          <TrendingUp size={13} /> Log 2 mock scores and this will also show the marks you give up by skipping.
        </div>
      )}
    </div>
  );
}
