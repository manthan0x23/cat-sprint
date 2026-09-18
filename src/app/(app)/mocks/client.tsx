"use client";
import { useRef, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addMockResult, deleteMockResult } from "@/app/actions";
import { fmtDate } from "@/lib/cat";

export function MockForm({ today, suggestedName }: { today: string; suggestedName: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  return (
    <form ref={ref} className="mt-3 space-y-3"
      action={(fd) => start(async () => { await addMockResult(fd); ref.current?.reset(); })}>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Date</span><input name="date" type="date" defaultValue={today} max={today} required className="input mt-1 num" /></label>
        <label><span className="label">Percentile</span><input name="percentile" type="number" step="0.01" min={0} max={100} required className="input mt-1 num" placeholder="92.4" /></label>
      </div>
      <label className="block"><span className="label">Mock name</span><input name="name" required defaultValue={suggestedName} className="input mt-1" placeholder="SIMCAT 3" /></label>
      <div className="grid grid-cols-4 gap-2">
        {["score", "varc", "dilr", "qa"].map((k) => (
          <label key={k}><span className="label">{k}</span><input name={k} type="number" step="0.01" className="input mt-1 num !px-2" /></label>
        ))}
      </div>
      <label className="block"><span className="label">Key learnings</span><textarea name="learnings" rows={2} className="input mt-1" placeholder="Wasted 12 min on one LR set; skip faster." /></label>
      <button className="btn btn-accent w-full" disabled={pending}>{pending ? "Saving…" : "Save mock"}</button>
    </form>
  );
}

export function DeleteMock({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => deleteMockResult(id))} className="text-muted hover:text-bad" aria-label="Delete mock"><Trash2 size={14} /></button>
  );
}

type Pt = { date: string; name: string; percentile: number; varc: number | null; dilr: number | null; qa: number | null };

export function MockChart({ data, target }: { data: Pt[]; target: number }) {
  const lo = Math.max(0, Math.floor(Math.min(target, ...data.map((d) => d.percentile)) / 5) * 5 - 5);
  const last = data.at(-1)!;
  return (
    <div className="h-[240px] -ml-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 48, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
          <YAxis domain={[lo, 100]} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={36} />
          <ReferenceLine y={target} stroke="var(--s-plan)" strokeWidth={1.5} label={{ value: `target ${target}`, position: "right", fontSize: 11, fill: "var(--ink-2)" }} />
          <Tooltip cursor={{ stroke: "var(--line-2)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as Pt;
            return (
              <div className="card px-3 py-2 text-[12px] shadow-lg">
                <div className="font-medium">{d.name} <span className="text-muted num">· {fmtDate(d.date)}</span></div>
                <div className="num mt-1">{d.percentile} %ile</div>
                {(d.varc ?? d.dilr ?? d.qa) != null && <div className="num text-muted">VARC {d.varc ?? "—"} · DILR {d.dilr ?? "—"} · QA {d.qa ?? "—"}</div>}
              </div>
            );
          }} />
          <Line dataKey="percentile" stroke="var(--s-done)" strokeWidth={2} isAnimationActive={false}
            dot={{ r: 4, fill: "var(--s-done)", stroke: "var(--panel)", strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: "var(--panel)", strokeWidth: 2 }}
            label={({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) =>
              index === data.length - 1 ? <text x={Number(x) + 10} y={Number(y) + 4} fontSize={11} fill="var(--ink)" className="num">{last.percentile}</text> : <g />} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
