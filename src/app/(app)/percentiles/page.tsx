import { desc, eq, isNotNull, and } from "drizzle-orm";
import { db } from "@/db";
import { mockResults } from "@/db/schema";
import { requireProfile } from "@/lib/data";
import { CAT_CURVES, fmtPct, targetBand } from "@/lib/cat-history";
import { CurvesChart, ScoreChecker } from "./client";
import { PercentileTable, SOURCES } from "./table";

export default async function PercentilesPage() {
  const { user, profile } = await requireProfile();
  const target = profile.targetPercentile;
  const [last] = await db.select({ score: mockResults.score }).from(mockResults)
    .where(and(eq(mockResults.userId, user.id), isNotNull(mockResults.score))).orderBy(desc(mockResults.date)).limit(1);
  const tiles = [99, 99.5, 99.9].map((p) => ({ p, b: targetBand(p)! }));
  const mine = targetBand(target);

  return (
    <div className="space-y-4">
      <div>
        <div className="label">Score vs percentile</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">What past CATs actually needed</h1>
        <p className="mt-1 text-muted text-sm max-w-2xl">
          Five years of published score-to-percentile data. The same percentile moved by 20+ marks between years, because the paper&apos;s difficulty changes.
          Aim for the toughest year, not the easiest.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {tiles.map(({ p, b }) => (
          <div key={p} className={`card p-4 ${p === target ? "ring-1 ring-[var(--s-plan)]" : ""}`}>
            <div className="text-[12px] text-muted">{fmtPct(p)} %ile needed{p === target && " · your target"}</div>
            <div className="mt-1 num text-[28px] leading-none font-medium">{b.lo.toFixed(0)}<span className="text-muted">–</span>{b.hi.toFixed(0)}</div>
            <div className="mt-1.5 text-[11.5px] text-muted num">
              easiest {b.byYear.find((r) => r.score === b.lo)!.year} · toughest {b.byYear.find((r) => r.score === b.hi)!.year} · swing {(b.hi - b.lo).toFixed(0)} marks
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="label">Score needed, by percentile and year</div>
          <div className="mt-3"><CurvesChart target={target} /></div>
        </div>
        <div className="card p-5">
          <div className="label">Check a score</div>
          <p className="mt-1 text-[12.5px] text-muted">{last?.score != null ? "Prefilled with your last mock." : "Try your mock score."} ✓ / ✗ = would it have cleared your {target} %ile.</p>
          <div className="mt-4"><ScoreChecker initial={last?.score ?? null} target={target} /></div>
          {mine && (
            <p className="mt-5 pt-4 border-t border-line text-[12.5px] text-ink-2 leading-relaxed">
              Safe target for <b className="num">{target}</b> %ile: <b className="num">{mine.hi.toFixed(0)}</b> marks. That clears it in all five years.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><PercentileTable target={target} /></div>
        <div className="card p-5 space-y-3 text-[13px] text-ink-2 leading-relaxed">
          <div className="label">What this means</div>
          <p><b>Every mark counts at the top.</b> In 2025, 85 → 93 marks moved you from 99 to 99.5 %ile, and 93 → 111 from 99.5 to 99.9.</p>
          <p><b>Easy years need more marks.</b> 2023 was the toughest paper in this set (99 %ile at 76); 2021 and 2024 were easier (95–98).</p>
          <p><b>Sections matter too.</b> IIM shortlists also have sectional cut-offs, so a high total with one weak section can still miss a call.</p>
          <p><b>Mocks ≠ CAT.</b> Test series vary in difficulty. Use these as a guide for mock scores, not a promise.</p>
          <div className="pt-2 border-t border-line text-[12px] text-muted">
            Data: {SOURCES.map((s, i) => <span key={s.href}>{i > 0 && " · "}<a href={s.href} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.name}</a></span>)}.
            Years: {CAT_CURVES.map((c) => c.year).join(", ")}. Checked 19 Sep 2026.
          </div>
        </div>
      </div>
    </div>
  );
}
