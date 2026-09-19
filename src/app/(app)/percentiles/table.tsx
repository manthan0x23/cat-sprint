import clsx from "clsx";
import { CAT_CURVES, TABLE_PCTS, fmtPct, scoreFor } from "@/lib/cat-history";

export const SOURCES = [
  { name: "Cracku 2021–24", href: "https://cracku.in/cat-score-vs-percentile-2024/" },
  { name: "Cracku 2025", href: "https://cracku.in/cat-score-vs-percentile-2025/" },
  { name: "IMS (toppers)", href: "https://www.imsindia.com/blog/cat/cat-score-vs-percentile/" },
  { name: "iQuanta (cross-check)", href: "https://www.iquanta.in/blog/cat-score-vs-percentile-trend/" },
];

/** Reference: overall scaled score each percentile needed in past CATs, with the user's target row highlighted. */
export function PercentileTable({ target }: { target: number }) {
  const rows = TABLE_PCTS.includes(target) ? TABLE_PCTS : [...TABLE_PCTS, target].sort((a, b) => a - b);
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-5">
        <div className="label">The full table</div>
        <h3 className="mt-1 font-medium">Overall score for each percentile</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full mt-3 text-[13.5px]">
          <thead>
            <tr className="text-left text-muted border-b border-line">
              <th className="px-5 py-2 font-normal label">%ile</th>
              {CAT_CURVES.map((c) => <th key={c.year} className="px-3 py-2 font-normal label text-right"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: `var(--y${c.year})` }} />{c.year}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((p) => (
              <tr key={p} className={clsx("border-b border-line", p === target && "bg-[var(--s-plan)]/10 font-medium")}>
                <td className="px-5 py-2 num">{fmtPct(p)}{p === target && <span className="ml-1.5 text-[11px] text-muted font-normal">your target</span>}</td>
                {CAT_CURVES.map((c) => {
                  const r = scoreFor(c, p);
                  return (
                    <td key={c.year} className={clsx("px-3 py-2 num text-right", (!r || !r.exact) && "text-muted")} title={r && !r.exact ? "interpolated between published rows" : undefined}>
                      {r ? `${r.exact ? "" : "~"}${Math.round(r.score)}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-b border-line text-muted">
              <td className="px-5 py-2">Topper</td>
              {CAT_CURVES.map((c) => <td key={c.year} className="px-3 py-2 num text-right">{c.topper ?? "—"}</td>)}
            </tr>
            <tr className="text-muted">
              <td className="px-5 py-2">Max marks</td>
              {CAT_CURVES.map((c) => <td key={c.year} className="px-3 py-2 num text-right">{c.maxMarks}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-5 py-4 text-[12px] text-muted leading-relaxed space-y-1.5">
        <p>
          Scaled scores after IIM&apos;s slot normalisation, roughly your raw marks. <span className="num">~</span> = interpolated between published rows; — = not published.
          The same percentile swings by 20+ marks between years because paper difficulty changes, so aim for the top of your row, not the bottom.
        </p>
      </div>
    </div>
  );
}
