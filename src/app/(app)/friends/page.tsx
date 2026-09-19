import Link from "next/link";
import clsx from "clsx";
import { Flame, LineChart, Trophy } from "lucide-react";
import { requireProfile } from "@/lib/data";
import { basicProfiles, friendIds, pendingRequests, sharedStats } from "@/lib/social";
import { minutesToH } from "@/lib/progress";
import { Avatar } from "@/components/avatar";
import { AddFriend, RequestButtons, CancelRequest, NudgeButton } from "./client";

export default async function FriendsPage() {
  const { user, profile } = await requireProfile();
  const ids = await friendIds(user.id);
  const [people, reqs, stats, meStats] = await Promise.all([
    basicProfiles(ids),
    pendingRequests(user.id),
    Promise.all(ids.map(async (id) => [id, await sharedStats(id)] as const)),
    sharedStats(user.id),
  ]);

  const board = [
    { id: user.id, me: true, p: { id: user.id, name: user.name, image: user.image, username: profile.username, target: profile.targetPercentile }, s: meStats },
    ...stats.map(([id, s]) => ({ id, me: false, p: people.get(id)!, s })),
  ].filter((r) => r.p && r.s)
    .sort((a, b) => (b.s!.todayMinutes - a.s!.todayMinutes) || (b.s!.streak - a.s!.streak));

  const done = board.filter((r) => !r.me && (r.s!.todayPct ?? 0) >= 1).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="label">Friends</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your squad</h1>
          <p className="mt-1 text-muted text-sm">
            {ids.length ? <>{done} of {ids.length} friend{ids.length > 1 ? "s have" : " has"} finished today&apos;s plan.</> : "Studying alongside people you know makes skipping harder."}
          </p>
        </div>
        {profile.username && (
          <Link href={`/u/${profile.username}`} className="chip num hover:border-line-2">Your profile · @{profile.username}</Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2 overflow-hidden">
          <div className="px-5 pt-5 flex items-center justify-between">
            <span className="label inline-flex items-center gap-1.5"><Trophy size={12} /> Today&apos;s board</span>
            <span className="text-[12px] text-muted">ranked by hours logged today · mocks = total taken</span>
          </div>
          <ul className="mt-3">
            {board.map((r, i) => {
              const pct = r.s!.todayPct;
              return (
                <li key={r.id} className={clsx("px-5 py-3 border-t border-line flex items-center gap-3", r.me && "bg-accent-soft/50")}>
                  <span className="num text-muted w-5 text-[13px]">{i + 1}</span>
                  <Avatar src={r.p.image} name={r.p.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {r.p.username ? (
                        <Link href={`/u/${r.p.username}`} className="font-medium text-[14px] truncate hover:underline">{r.me ? "You" : r.p.name}</Link>
                      ) : <span className="font-medium text-[14px]">{r.me ? "You" : r.p.name}</span>}
                      {r.p.username && <span className="text-[12px] text-muted num truncate">@{r.p.username}</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 max-w-[260px] rounded-full bg-line overflow-hidden">
                        <div className={clsx("h-full rounded-full", (pct ?? 0) >= 1 ? "bg-good" : "bg-[var(--s-done)]")} style={{ width: `${Math.min(100, (pct ?? 0) * 100)}%` }} />
                      </div>
                      <span className="text-[12px] num text-muted w-24">
                        {pct == null ? "rest day" : `${Math.round(pct * 100)}% · ${minutesToH(r.s!.todayMinutes)}`}
                      </span>
                    </div>
                  </div>
                  <span className="chip num hidden sm:inline-flex" title="Mocks taken">
                    <LineChart size={12} className="text-accent" />{r.s!.mocksTaken} mock{r.s!.mocksTaken === 1 ? "" : "s"}
                    {r.s!.lastMockScore != null && <span className="text-muted">· last {r.s!.lastMockScore}</span>}
                  </span>
                  <span className="chip num hidden sm:inline-flex" title="Streak"><Flame size={12} className={r.s!.streak ? "text-warn" : "text-muted"} />{r.s!.streak}</span>
                  {!r.me && <NudgeButton userId={r.id} />}
                </li>
              );
            })}
          </ul>
          {!ids.length && <div className="px-5 py-6 border-t border-line text-sm text-muted">No friends yet. Add someone by username →</div>}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <span className="label">Add a friend</span>
            {profile.username ? <AddFriend /> : (
              <p className="mt-2 text-sm text-muted">Set a username in <Link href="/settings" className="text-accent hover:underline">Settings</Link> first.</p>
            )}
          </div>
          {reqs.incoming.length > 0 && (
            <div className="card p-5">
              <span className="label">Requests</span>
              <ul className="mt-3 space-y-3">
                {reqs.incoming.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <Avatar src={r.person.image} name={r.person.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium truncate">{r.person.name}</div>
                      <div className="text-[12px] text-muted num">@{r.person.username}</div>
                    </div>
                    <RequestButtons id={r.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reqs.outgoing.length > 0 && (
            <div className="card p-5">
              <span className="label">Sent</span>
              <ul className="mt-3 space-y-2">
                {reqs.outgoing.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-[13.5px]">
                    <span className="num">@{r.person.username}</span>
                    <CancelRequest userId={r.person.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
