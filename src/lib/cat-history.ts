// Past CAT overall *scaled* score needed for each percentile, from published post-result analyses.
// Scaled score ≈ raw marks after IIM's per-slot normalisation (+3 / −1 per MCQ).
// Max marks: 198 in 2021–23 (66 Qs), 204 in 2024–25 (68 Qs).
//
// Sources (checked 19 Sep 2026):
//   2021–2024: Cracku, cracku.in/cat-score-vs-percentile-2024 (5-year table)
//   2025:      Cracku, cracku.in/cat-score-vs-percentile-2025 ("based on CAT 2025 scorecard data")
//   100 %ile (topper) rows: IMS, imsindia.com/blog/cat/cat-score-vs-percentile
// Cross-checked with iQuanta's 5-year table; they agree within ~3 marks except CAT 2021 at 99.9
// (Cracku 124, iQuanta 117). Rows where sources clearly conflicted (2022 and 2024 at 98) are left out.

// topper = highest scaled score that year (100 %ile). Shown for context only, never interpolated to:
// the curve between 99.9 and 100 is too sparse for a straight line to mean anything.
export type Curve = { year: number; maxMarks: number; topper?: number; points: [pct: number, score: number][] };

export const CAT_CURVES: Curve[] = [
  { year: 2021, maxMarks: 198, points: [[90, 60], [95, 73], [97, 82], [99, 98], [99.5, 110], [99.9, 124]] },
  { year: 2022, maxMarks: 198, points: [[90, 49], [95, 62], [97, 72], [99, 84], [99.5, 92], [99.9, 109]] },
  { year: 2023, maxMarks: 198, points: [[90, 44.36], [95, 54.86], [97, 61.45], [98, 66.68], [99, 76.15], [99.5, 84.29], [99.9, 101.43]], topper: 132 },
  { year: 2024, maxMarks: 204, points: [[90, 58], [95, 70], [97, 78.9], [99, 95.13], [99.5, 103.97], [99.9, 127]], topper: 151 },
  { year: 2025, maxMarks: 204, points: [[90, 51.5], [95, 62.3], [97, 70], [98, 76], [99, 84.8], [99.5, 93], [99.9, 111.48], [99.95, 118.37], [99.99, 132.79]], topper: 137 },
];

/** Percentile rows shown in the reference table. */
export const TABLE_PCTS = [90, 95, 97, 98, 99, 99.5, 99.9, 99.95, 99.99];

function interp(points: [number, number][], x: number, from: 0 | 1): number | null {
  const to = from === 0 ? 1 : 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (x >= a[from] && x <= b[from]) return a[to] + ((x - a[from]) / (b[from] - a[from] || 1)) * (b[to] - a[to]);
  }
  return null;
}

/** Score that year's CAT needed for a percentile. `exact` = a published row, else interpolated. Null outside the data. */
export function scoreFor(curve: Curve, pct: number) {
  const row = curve.points.find((p) => p[0] === pct);
  if (row) return { score: row[1], exact: true };
  const v = interp(curve.points, pct, 0);
  return v == null ? null : { score: v, exact: false };
}

/** Percentile a score would have got that year. Beyond the top row: ">= that percentile". */
export function percentileFor(curve: Curve, score: number): { pct: number; atLeast?: boolean; below?: boolean } {
  const first = curve.points[0], last = curve.points.at(-1)!;
  if (score < first[1]) return { pct: first[0], below: true };
  if (score >= last[1]) return { pct: last[0], atLeast: true };
  return { pct: interp(curve.points, score, 1)! };
}

/** Range of scores a target percentile needed across the years we have data for. */
export function targetBand(pct: number) {
  const byYear = CAT_CURVES.flatMap((c) => { const r = scoreFor(c, pct); return r ? [{ year: c.year, score: r.score }] : []; });
  if (!byYear.length) return null;
  const scores = byYear.map((r) => r.score);
  return { lo: Math.min(...scores), hi: Math.max(...scores), byYear };
}

/** Range of percentiles a score would have got across years, e.g. 99.2–99.8. */
export function percentileBand(score: number) {
  const r = CAT_CURVES.map((c) => percentileFor(c, score));
  const pcts = r.map((x) => x.pct);
  const hi = Math.max(...pcts);
  // "+" only when the top of the range is itself capped by the data (score beyond that year's top row).
  return { lo: Math.min(...pcts), hi, belowAll: r.every((x) => x.below), aboveSome: r.some((x) => x.atLeast && x.pct === hi) };
}

/** Rounds DOWN so we never overstate a percentile (98.96 shows as 98.9, not 99). */
export function fmtPct(p: number) {
  const f = 10 ** (p >= 99 ? 2 : p >= 90 ? 1 : 0);
  return String(Math.floor(p * f + 1e-9) / f);
}
