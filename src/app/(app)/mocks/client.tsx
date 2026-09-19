"use client";
import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addMockResult, deleteMockResult } from "@/app/actions";
import { fmtDate } from "@/lib/cat";

const NOTE_SECTIONS = [
  { k: "qa", label: "QA", ph: "Skipped easy arithmetic" },
  { k: "dilr", label: "DILR", ph: "Wrong set first, lost 12 min" },
  { k: "va", label: "VA", ph: "PJs 1/3, stop guessing" },
  { k: "rc", label: "RC", ph: "Inference Qs wrong" },
] as const;

export function MockForm({ today, suggestedName }: { today: string; suggestedName: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  // Fill the total from the three sections as they're typed, unless the user typed a total themselves.
  const [manualTotal, setManualTotal] = useState(false);
  const syncTotal = () => {
    const f = ref.current;
    if (!f || manualTotal) return;
    const v = ["varc", "dilr", "qa"].map((k) => (f.elements.namedItem(k) as HTMLInputElement).value);
    (f.elements.namedItem("score") as HTMLInputElement).value = v.every((x) => x !== "") ? String(v.reduce((a, b) => a + Number(b), 0)) : "";
  };
  return (
    <form ref={ref} className="mt-3 space-y-3"
      action={(fd) => start(async () => { await addMockResult(fd); ref.current?.reset(); setManualTotal(false); })}>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Date</span><input name="date" type="date" defaultValue={today} max={today} required className="input mt-1 num" /></label>
        <label><span className="label">Mock name</span><input name="name" required defaultValue={suggestedName} className="input mt-1" placeholder="SIMCAT 3" /></label>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {["varc", "dilr", "qa"].map((k) => (
          <label key={k}><span className="label">{k}</span><input name={k} type="number" step="any" onInput={syncTotal} className="input mt-1 num !px-2" /></label>
        ))}
        <label><span className="label">Total</span><input name="score" type="number" step="any" required onInput={() => setManualTotal(true)} className="input mt-1 num !px-2 font-medium" /></label>
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Notes by section</legend>
        {NOTE_SECTIONS.map((n) => (
          <label key={n.k} className="flex gap-2 items-start">
            <span className="label w-10 pt-2 shrink-0">{n.label}</span>
            <textarea name={`note_${n.k}`} rows={1} className="input flex-1 min-h-9" placeholder={n.ph} />
          </label>
        ))}
      </fieldset>
      <label className="block"><span className="label">Overall takeaway</span><textarea name="learnings" rows={2} className="input mt-1" placeholder="Next mock: DILR first 40 min, two sets only." /></label>
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

type Pt = { date: string; name: string; score: number | null; varc: number | null; dilr: number | null; qa: number | null };

export function MockChart({ data }: { data: Pt[] }) {
  const pts = data.filter((d) => d.score != null);
  if (!pts.length) return <div className="h-[240px] grid place-items-center text-muted text-sm">No scores logged yet</div>;
  const last = pts.at(-1)!;
  return (
    <div className="h-[240px] -ml-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 10, right: 48, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
          <YAxis domain={[(lo: number) => Math.max(0, Math.floor(lo / 10) * 10 - 10), (hi: number) => Math.ceil(hi / 10) * 10 + 10]} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip cursor={{ stroke: "var(--line-2)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as Pt;
            return (
              <div className="card px-3 py-2 text-[12px] shadow-lg">
                <div className="font-medium">{d.name} <span className="text-muted num">· {fmtDate(d.date)}</span></div>
                <div className="num mt-1">{d.score} marks</div>
                {(d.varc ?? d.dilr ?? d.qa) != null && <div className="num text-muted">VARC {d.varc ?? "—"} · DILR {d.dilr ?? "—"} · QA {d.qa ?? "—"}</div>}
              </div>
            );
          }} />
          <Line dataKey="score" stroke="var(--s-done)" strokeWidth={2} isAnimationActive={false}
            dot={{ r: 4, fill: "var(--s-done)", stroke: "var(--panel)", strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: "var(--panel)", strokeWidth: 2 }}
            label={({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) =>
              index === pts.length - 1 ? <text x={Number(x) + 10} y={Number(y) + 4} fontSize={11} fill="var(--ink)" className="num">{last.score}</text> : <g />} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
