"use client";
import { useState } from "react";
import clsx from "clsx";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CAT_CURVES, TABLE_PCTS, fmtPct, percentileFor, scoreFor } from "@/lib/cat-history";

// One row per percentile (ordinal x, so the 99–99.99 zone isn't squashed), one line per year.
const data = TABLE_PCTS.map((p) => ({
  p: fmtPct(p),
  ...Object.fromEntries(CAT_CURVES.map((c) => { const r = scoreFor(c, p); return [c.year, r ? +r.score.toFixed(1) : null]; })),
}));

export function CurvesChart({ target }: { target: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const tgt = TABLE_PCTS.includes(target) ? fmtPct(target) : null;
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2 mb-3">
        {CAT_CURVES.map((c) => (
          <button key={c.year} type="button" onMouseEnter={() => setHover(c.year)} onMouseLeave={() => setHover(null)}
            className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: `var(--y${c.year})` }} />CAT {c.year}</button>
        ))}
      </div>
      <div className="h-[320px] -ml-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 44, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="p" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
            <YAxis domain={[40, 140]} ticks={[40, 60, 80, 100, 120, 140]} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={36} />
            {tgt && <ReferenceLine x={tgt} stroke="var(--ink-2)" strokeDasharray="3 3" label={{ value: "your target", position: "insideTopLeft", fontSize: 11, fill: "var(--ink-2)" }} />}
            <Tooltip cursor={{ stroke: "var(--line-2)" }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="card px-3 py-2 text-[12px] shadow-lg min-w-36">
                  <div className="font-medium num">{label} %ile</div>
                  {[...payload].sort((a, b) => Number(b.value) - Number(a.value)).map((e) => (
                    <div key={String(e.dataKey)} className="flex items-center justify-between gap-3 num mt-0.5">
                      <span className="inline-flex items-center gap-1.5 text-ink-2"><span className="size-2 rounded-full" style={{ background: `var(--y${String(e.dataKey)})` }} />{String(e.dataKey)}</span>
                      <span>{e.value}</span>
                    </div>
                  ))}
                </div>
              );
            }} />
            {CAT_CURVES.map((c) => (
              <Line key={c.year} dataKey={String(c.year)} stroke={`var(--y${c.year})`} strokeWidth={2} connectNulls={false} isAnimationActive={false}
                strokeOpacity={hover == null || hover === c.year ? 1 : 0.2}
                dot={{ r: 3, fill: `var(--y${c.year})`, stroke: "var(--panel)", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "var(--panel)", strokeWidth: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11.5px] text-muted">Percentiles are evenly spaced so the top end is readable; the jump from 99.9 to 99.99 is far steeper than it looks.</p>
    </div>
  );
}

export function ScoreChecker({ initial, target }: { initial: number | null; target: number }) {
  const [score, setScore] = useState<string>(initial != null ? String(initial) : "90");
  const n = Number(score);
  const valid = score !== "" && Number.isFinite(n);
  return (
    <div>
      <label className="flex items-center gap-3">
        <span className="text-[13px] text-ink-2">If I score</span>
        <input type="number" value={score} onChange={(e) => setScore(e.target.value)} className="input num w-24 text-lg font-medium" />
        <span className="text-[13px] text-ink-2">marks…</span>
      </label>
      <ul className="mt-4 space-y-2">
        {CAT_CURVES.map((c) => {
          const r = valid ? percentileFor(c, n) : null;
          const need = scoreFor(c, target);
          const ok = need && valid ? n >= need.score : null;
          return (
            <li key={c.year} className="flex items-center justify-between gap-3 text-[13.5px]">
              <span className="inline-flex items-center gap-2 text-ink-2"><span className="size-2 rounded-full" style={{ background: `var(--y${c.year})` }} />CAT {c.year}</span>
              <span className="flex items-center gap-2">
                <span className="num font-medium">{!r ? "—" : r.below ? `< ${fmtPct(r.pct)}` : `${r.atLeast ? "≥ " : ""}${fmtPct(r.pct)}`}</span>
                <span className="text-muted text-[12px]">%ile</span>
                {ok != null && <span className={clsx("chip text-[11px] w-16 justify-center", ok ? "text-good" : "text-bad")}>{ok ? `✓ ${target}` : `✗ ${target}`}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
