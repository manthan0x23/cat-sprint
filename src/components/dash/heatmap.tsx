import { fmtDate, addDays } from "@/lib/cat";
import type { DayRow } from "@/lib/progress";

// Sequential (one hue, light → dark) = share of the day's plan completed.
function step(r: DayRow | undefined) {
  if (!r || r.planned === 0) return null;
  if (r.ratio >= 1) return 4;
  if (r.ratio >= 0.7) return 3;
  if (r.ratio >= 0.4) return 2;
  if (r.ratio > 0) return 1;
  return 0;
}

export function Heatmap({ history, today, days = 28 }: { history: DayRow[]; today: string; days?: number }) {
  const map = new Map(history.map((h) => [h.date, h]));
  const cells = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d) => {
          const r = map.get(d);
          const s = step(r);
          const title = r
            ? r.planned === 0 ? `${fmtDate(d)} · rest` : `${fmtDate(d)} · ${Math.round(r.ratio * 100)}% of plan`
            : `${fmtDate(d)} · before your plan started`;
          return (
            <div key={d} title={title}
              className="group relative aspect-square rounded-[5px]"
              style={{
                background: s == null ? "transparent" : `var(--heat-${s})`,
                border: s == null ? "1px dashed var(--line-2)" : d === today ? "1.5px solid var(--ink)" : "none",
              }}>
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap card px-2 py-1 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {title}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
        0%
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className="size-3 rounded-[3px]" style={{ background: `var(--heat-${i})` }} />)}
        100%
      </div>
    </div>
  );
}
