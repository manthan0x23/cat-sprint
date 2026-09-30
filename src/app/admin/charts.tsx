"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDate } from "@/lib/cat";

type Pt = { date: string; value: number };

/** One series over the last 30 days: a line for levels (active users), bars for counts (requests, logs). */
export function DailyChart({ data, kind = "bar", unit }: { data: Pt[]; kind?: "bar" | "line"; unit: string }) {
  const axis = {
    x: <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={32} />,
    y: <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />,
    grid: <CartesianGrid vertical={false} stroke="var(--line)" />,
    tip: (
      <Tooltip
        cursor={kind === "bar" ? { fill: "var(--panel-2)" } : { stroke: "var(--line-2)", strokeWidth: 1 }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="card px-3 py-2 text-[12px] shadow-lg">
              <div className="text-muted">{fmtDate(String(label), { weekday: "short", day: "numeric", month: "short" })}</div>
              <div className="num font-medium">{String(payload[0].value)} {unit}</div>
            </div>
          );
        }}
      />
    ),
  };
  return (
    <div className="h-[180px] -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {axis.grid}{axis.x}{axis.y}{axis.tip}
            <Line dataKey="value" stroke="var(--s-done)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "var(--panel)", strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
            {axis.grid}{axis.x}{axis.y}{axis.tip}
            <Bar dataKey="value" fill="var(--s-done)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
