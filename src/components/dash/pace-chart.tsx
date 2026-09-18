"use client";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { fmtDate } from "@/lib/cat";

type Pt = { date: string; plannedCum: number; doneCum?: number; projectedCum?: number };

export function PaceChart({ series, today }: { series: Pt[]; today: string }) {
  const data = series.map((p) => ({
    date: p.date,
    plan: +(p.plannedCum / 60).toFixed(1),
    done: p.doneCum != null ? +(p.doneCum / 60).toFixed(1) : null,
    proj: p.projectedCum != null ? +(p.projectedCum / 60).toFixed(1) : null,
    gap: p.doneCum != null ? [+(p.doneCum / 60).toFixed(1), +(p.plannedCum / 60).toFixed(1)] : null,
  }));
  const last = data.at(-1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2 mb-3">
        <Key color="var(--s-plan)" label="Plan (cumulative hrs)" />
        <Key color="var(--s-done)" label="Done" />
        <Key color="var(--s-done)" dashed label="Projected at your consistency" />
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: "var(--s-debt)", outline: "1px solid color-mix(in srgb, var(--bad) 30%, transparent)" }} />Backlog</span>
      </div>
      <div className="h-[260px] -ml-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 56, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={40} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={40}
              tickFormatter={(v) => `${v}h`} />
            <Tooltip
              cursor={{ stroke: "var(--line-2)", strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <div className="card px-3 py-2 text-[12px] shadow-lg">
                    <div className="font-medium mb-1">{fmtDate(String(label), { weekday: "short", day: "numeric", month: "short" })}</div>
                    <Row color="var(--s-plan)" k="Plan" v={`${d.plan}h`} />
                    {d.done != null && <Row color="var(--s-done)" k="Done" v={`${d.done}h`} />}
                    {d.done != null && d.plan - d.done > 0.05 && <Row color="var(--bad)" k="Behind by" v={`${(d.plan - d.done).toFixed(1)}h`} />}
                    {d.done == null && d.proj != null && <Row color="var(--s-done)" k="Projected" v={`${d.proj}h`} />}
                  </div>
                );
              }}
            />
            <Area dataKey="gap" stroke="none" fill="var(--s-debt)" isAnimationActive={false} connectNulls={false} />
            <Line dataKey="plan" stroke="var(--s-plan)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="proj" stroke="var(--s-done)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} connectNulls={false} />
            <Line dataKey="done" stroke="var(--s-done)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "var(--panel)", strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
            <ReferenceLine x={today} stroke="var(--line-2)" label={{ value: "today", position: "insideTopRight", fontSize: 10, fill: "var(--muted)" }} />
            {last && (
              <>
                <ReferenceLine y={last.plan} stroke="none" label={{ value: `${Math.round(last.plan)}h plan`, position: "right", fontSize: 11, fill: "var(--ink-2)" }} />
                {last.proj != null && Math.abs(last.plan - last.proj) > 6 && (
                  <ReferenceLine y={last.proj} stroke="none" label={{ value: `${Math.round(last.proj)}h`, position: "right", fontSize: 11, fill: "var(--ink-2)" }} />
                )}
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Key({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="4"><line x1="1" y1="2" x2="17" y2="2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={dashed ? "4 3" : undefined} /></svg>
      {label}
    </span>
  );
}
function Row({ color, k, v }: { color: string; k: string; v: string }) {
  return (
    <div className="flex items-center gap-2 justify-between min-w-[130px]">
      <span className="inline-flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: color }} />{k}</span>
      <span className="num">{v}</span>
    </div>
  );
}
