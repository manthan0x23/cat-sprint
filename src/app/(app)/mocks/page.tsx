import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { dayPlans, mockResults } from "@/db/schema";
import { requireProfile } from "@/lib/data";
import { fmtDate, istNow, SECTION_META } from "@/lib/cat";
import { MockForm, MockChart, DeleteMock } from "./client";

export default async function MocksPage() {
  const { user } = await requireProfile();
  const today = istNow().date;
  const [mocks, upcoming] = await Promise.all([
    db.select().from(mockResults).where(eq(mockResults.userId, user.id)).orderBy(asc(mockResults.date)),
    db.select().from(dayPlans).where(and(eq(dayPlans.userId, user.id), eq(dayPlans.type, "mock"), gte(dayPlans.date, today))).orderBy(asc(dayPlans.date)),
  ]);
  const suggestedName = upcoming[0]?.date === today ? upcoming[0].mockName ?? "" : "";

  return (
    <div className="space-y-4">
      <div>
        <div className="label">Mocks</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your mock trend</h1>
        <p className="mt-1 text-muted text-sm">Track raw scores, not mock percentiles: those depend on who else took that test series. Every mock you log sharpens the score projection on your dashboard.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="label">Score by mock</span>
          </div>
          {mocks.length ? (
            <div className="mt-4"><MockChart data={mocks} /></div>
          ) : (
            <div className="mt-4 h-[240px] grid place-items-center rounded-xl border border-dashed border-line-2 text-muted text-sm">No mocks logged yet</div>
          )}
        </div>
        <div className="card p-5">
          <span className="label">Log a mock</span>
          <MockForm today={today} suggestedName={suggestedName} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2 overflow-hidden">
          <div className="px-5 pt-5 label">History</div>
          <div className="overflow-x-auto">
            <table className="w-full mt-3 text-[13.5px]">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  {["Date", "Mock", "Score", "VARC", "DILR", "QA", ""].map((h) => <th key={h} className="px-5 py-2 font-normal label">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...mocks].reverse().map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0 align-top">
                    <td className="px-5 py-2.5 num text-muted whitespace-nowrap">{fmtDate(m.date)}</td>
                    <td className="px-5 py-2.5">
                      <div className="font-medium">{m.name}</div>
                      {m.learnings && <div className="text-[12px] text-muted mt-0.5 max-w-xs">{m.learnings}</div>}
                      {m.sectionNotes && (
                        <dl className="mt-1 space-y-0.5 text-[12px] max-w-xs">
                          {(["qa", "dilr", "va", "rc"] as const).filter((k) => m.sectionNotes?.[k]).map((k) => (
                            <div key={k} className="flex gap-1.5"><dt className="label shrink-0 pt-px">{SECTION_META[k].short}</dt><dd className="text-muted">{m.sectionNotes![k]}</dd></div>
                          ))}
                        </dl>
                      )}
                    </td>
                    <td className="px-5 py-2.5 num font-medium">{m.score ?? "—"}</td>
                    <td className="px-5 py-2.5 num">{m.varc ?? "—"}</td>
                    <td className="px-5 py-2.5 num">{m.dilr ?? "—"}</td>
                    <td className="px-5 py-2.5 num">{m.qa ?? "—"}</td>
                    <td className="px-5 py-2.5"><DeleteMock id={m.id} /></td>
                  </tr>
                ))}
                {!mocks.length && <tr><td colSpan={7} className="px-5 py-6 text-muted text-center">Nothing yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-5">
          <span className="label">Upcoming mocks</span>
          <ul className="mt-3 space-y-1.5 max-h-[320px] overflow-y-auto">
            {upcoming.map((u) => (
              <li key={u.date} className="flex justify-between text-[13.5px]">
                <span>{u.mockName}</span>
                <span className="num text-muted">{fmtDate(u.date, { weekday: "short", day: "numeric", month: "short" })}</span>
              </li>
            ))}
            {!upcoming.length && <li className="text-muted text-sm">None planned. Add some in the Planner.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
