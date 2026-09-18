import { Suspense } from "react";
import type { UserState } from "@/lib/data";
import { fmtHour } from "@/lib/cat";
import { minutesToH } from "@/lib/progress";
import { ignoredYesterday, yesterdayRow } from "@/lib/coach";
import { getCoach } from "./coach-card";
import { WelcomeModal, type WelcomeRow } from "./welcome";

function part(hour: number) {
  if (hour < 12) return { key: "morning", title: "Good morning" };
  if (hour < 16) return { key: "afternoon", title: "Afternoon check-in" };
  if (hour < 20) return { key: "evening", title: "Evening check-in" };
  return { key: "night", title: "Night check-in" };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function Welcome({ s }: { s: UserState }) {
  const p = part(s.hour);
  const y = yesterdayRow(s);
  const t = s.stats.today;
  const expected = t.planned ? s.stats.todayExpected / t.planned : 0;
  const todayRatio = t.planned ? t.done / t.planned : 0;

  const rows: WelcomeRow[] = [];
  if (y) rows.push({ k: "Yesterday", v: `${pct(y.ratio)} · ${minutesToH(y.done)} of ${minutesToH(y.planned)}`, tone: y.ratio >= 1 ? "good" : y.ratio >= 0.6 ? "warn" : "bad" });
  if (t.planned) rows.push({
    k: "Today so far",
    v: `${pct(todayRatio)}${s.hour >= s.profile.studyStartHour ? ` · target by ${fmtHour(s.hour)}: ~${pct(expected)}` : ""}`,
    tone: todayRatio >= 1 ? "good" : todayRatio + 0.15 >= expected ? "muted" : todayRatio + 0.35 >= expected ? "warn" : "bad",
  });
  rows.push(s.week.goal
    ? { k: "Weekly goal (locked)", v: `${pct(s.week.pct ?? 0)} · ${s.week.daysLeft}d left`, tone: (s.week.pct ?? 0) >= 1 ? "good" : "muted" }
    : { k: "Weekly goal", v: "not locked yet", tone: "warn" });
  rows.push({ k: "Backlog", v: s.stats.debtMinutes > 0 ? `${minutesToH(s.stats.debtMinutes)} (+${Math.round(s.stats.extraPerDay)} min/day)` : "none", tone: s.stats.debtMinutes > 120 ? "bad" : s.stats.debtMinutes > 0 ? "warn" : "good" });
  rows.push({ k: "Streak · mocks taken", v: `${s.stats.streak} days · ${s.mocksTaken}` });

  const bad = (y && y.ratio < 0.5) || s.stats.todayStatus === "way-behind";
  const warn = (y && y.ratio < 0.8) || s.stats.todayStatus === "behind";
  const tone = bad ? "bad" : warn ? "warn" : "good";

  return (
    <WelcomeModal storageKey={`welcome:${s.today}:${p.key}`} title={`${p.title}, ${s.firstName}`} tone={tone} rows={rows}>
      <Suspense fallback={<span className="text-muted">Reading your numbers…</span>}>
        <CoachLine s={s} />
      </Suspense>
    </WelcomeModal>
  );
}

async function CoachLine({ s }: { s: UserState }) {
  const { text, ctx } = await getCoach(s);
  const ign = ignoredYesterday(s, ctx);
  return (
    <>
      {text}
      {ign > 0 && s.hour < 16 && <span className="block mt-2 text-[12.5px] text-bad">You didn&apos;t act on {ign} reminder{ign > 1 ? "s" : ""} yesterday.</span>}
    </>
  );
}
