import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Flame, Lock, Target } from "lucide-react";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { requireProfile } from "@/lib/data";
import { isAdmin } from "@/lib/admin";
import { normalizeUsername, relation, sharedStats } from "@/lib/social";
import { daysToExam } from "@/lib/cat";
import { minutesToH } from "@/lib/progress";
import { Avatar } from "@/components/avatar";
import { Heatmap } from "@/components/dash/heatmap";
import { MockChart } from "../../mocks/client";
import { targetBand } from "@/lib/cat-history";
import { FriendAction } from "../../friends/client";

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const { user: viewer } = await requireProfile();
  const u = normalizeUsername(decodeURIComponent(username));
  const p = await db.query.profiles.findFirst({ where: eq(profiles.username, u) });
  if (!p) notFound();
  const person = await db.query.users.findFirst({ where: eq(users.id, p.userId) });
  const rel = await relation(viewer.id, p.userId);
  const canSee = rel.kind === "self" || rel.kind === "friends" || p.visibility === "public" || (await isAdmin());
  const s = canSee ? await sharedStats(p.userId) : null;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="card p-5 md:p-6 relative overflow-hidden">
        <div className="grid-bg absolute inset-0 -z-0 opacity-70" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar src={person?.image ?? null} name={person?.name ?? u} size={64} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{person?.name ?? u}</h1>
            <div className="text-muted num text-[13.5px]">@{u}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip num"><Target size={12} /> Target {p.targetPercentile}</span>
              {p.dreamColleges.slice(0, 4).map((c) => <span key={c} className="chip">{c}</span>)}
            </div>
          </div>
          {rel.kind !== "self" && (
            <FriendAction userId={p.userId} username={u} kind={rel.kind} requestId={"id" in rel ? rel.id : undefined} />
          )}
        </div>
      </div>

      {!s ? (
        <div className="card p-8 text-center">
          <Lock size={18} className="mx-auto text-muted" />
          <p className="mt-2 font-medium">Stats are visible to friends</p>
          <p className="text-sm text-muted mt-1">Add @{u} as a friend to see their streak, consistency and mock trend.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            <Tile k="Today" v={s.todayPct == null ? "Rest" : `${Math.round(s.todayPct * 100)}%`} sub={s.todayPct == null ? "" : minutesToH(s.todayMinutes)} />
            <Tile k="Streak" v={`${s.streak}d`} icon={<Flame size={13} className={s.streak ? "text-warn" : "text-muted"} />} />
            <Tile k="Mocks taken" v={String(s.mocksTaken)} sub={`${s.mocksPlannedLeft} planned before CAT`} />
            <Tile k="14-day consistency" v={`${Math.round(s.consistency * 100)}%`} />
            <Tile k="Projected score" v={s.projected != null ? s.projected.toFixed(0) : "—"} sub={s.projected == null ? (s.mocks ? "needs 2 mocks" : "hidden") : `target ${s.target} %ile`} />
          </div>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="card p-5 md:col-span-2">
              <span className="label">Last 4 weeks</span>
              <div className="mt-4"><Heatmap history={s.history} today={s.today} /></div>
            </div>
            <div className="card p-5 md:col-span-3">
              <div className="flex items-center justify-between">
                <span className="label">Mock trend</span>
                <span className="text-[12px] text-muted num">{daysToExam(s.today)} days to CAT</span>
              </div>
              {s.mocks == null ? (
                <p className="mt-4 text-sm text-muted">@{u} keeps mock scores private.</p>
              ) : s.mocks.length ? (
                <div className="mt-4"><MockChart data={s.mocks.map((m) => ({ ...m, varc: null, dilr: null, qa: null }))} band={(() => { const b = targetBand(s.target); return b && { pct: s.target, ...b }; })()} /></div>
              ) : <p className="mt-4 text-sm text-muted">No mocks logged yet.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ k, v, sub, icon }: { k: string; v: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="label">{k}</div>
      <div className="mt-2 num text-2xl font-medium inline-flex items-center gap-1.5">{icon}{v}</div>
      {sub && <div className="text-[12px] text-muted mt-0.5 num">{sub}</div>}
    </div>
  );
}
