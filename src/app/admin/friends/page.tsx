import { loadAdminStats, type AdminUser } from "@/lib/admin-stats";
import { diffDays, fmtDate } from "@/lib/cat";
import { AdminShell, Locked, adminAccess } from "../shell";
import { Person, Stat } from "../ui";

export const metadata = { title: "Friends · CAT Sprint admin", robots: { index: false } };

// Who is friends with whom: friend groups (connected clusters), each person's friends, pending requests.
export default async function AdminFriendsPage() {
  const { local, ok } = await adminAccess();
  if (!ok) return <Locked />;
  const { people, friends, today } = await loadAdminStats();
  const byId = new Map(people.map((p) => [p.id, p]));

  const adj = new Map<string, Set<string>>();
  for (const f of friends.pairs) {
    if (f.status !== "accepted") continue;
    for (const [x, y] of [[f.a, f.b], [f.b, f.a]]) {
      if (!adj.has(x)) adj.set(x, new Set());
      adj.get(x)!.add(y);
    }
  }
  // Friend groups: everyone reachable through friends-of-friends, largest first.
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const group: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const id = stack.pop()!;
      group.push(id);
      for (const n of adj.get(id) ?? []) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    }
    groups.push(group);
  }
  groups.sort((a, b) => b.length - a.length);

  const pending = friends.pairs.filter((f) => f.status === "pending").sort((a, b) => a.since.localeCompare(b.since));
  const alone = people.filter((p) => p.onboarded && !adj.has(p.id));
  const name = (p: AdminUser) => p.name ?? p.email ?? "?";

  return (
    <AdminShell local={local} tab="/admin/friends">
      <div className="mt-6">
        <div className="label">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Friends</h1>
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Friendships" value={friends.accepted} />
        <Stat label="Pending requests" value={friends.pending} />
        <Stat label="Friend groups" value={groups.length} sub={groups.length ? `largest: ${groups[0].length} people` : undefined} />
        <Stat label="Onboarded, no friends" value={alone.length} />
      </div>

      <h2 className="mt-8 text-[15px] font-semibold">Friend groups</h2>
      <p className="text-[12px] text-muted">People connected through friends (or friends of friends). Each person lists their direct friends.</p>
      <div className="mt-3 space-y-3">
        {groups.map((g, i) => (
          <div key={g[0]} className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-line text-[12px] text-muted num">Group {i + 1} · {g.length} people</div>
            <ul className="divide-y divide-line">
              {g.map((id) => byId.get(id)).filter((p): p is AdminUser => !!p).sort((a, b) => name(a).localeCompare(name(b))).map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="sm:w-56 shrink-0"><Person p={p} /></div>
                  <div className="flex flex-wrap gap-1.5 text-[12px]">
                    <span className="text-muted">friends with</span>
                    {[...(adj.get(p.id) ?? [])].map((f) => byId.get(f)).filter((f): f is AdminUser => !!f).map((f) => (
                      <span key={f.id} className="chip !h-6 !text-[12px]">{name(f)}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!groups.length && <p className="card px-4 py-8 text-center text-muted text-[13px]">No friendships yet.</p>}
      </div>

      <h2 className="mt-8 text-[15px] font-semibold">Pending requests · {pending.length}</h2>
      <ul className="mt-3 card divide-y divide-line">
        {pending.map((f) => {
          const a = byId.get(f.a), b = byId.get(f.b);
          if (!a || !b) return null;
          const age = diffDays(today, f.since);
          return (
            <li key={`${f.a}-${f.b}`} className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-[13px]">
              <Person p={a} /><span className="text-muted">→</span><Person p={b} />
              <span className="ml-auto text-[12px] text-muted num">{age === 0 ? "today" : `${age}d waiting`} · {fmtDate(f.since)}</span>
            </li>
          );
        })}
        {!pending.length && <li className="px-4 py-6 text-center text-muted text-[13px]">None.</li>}
      </ul>

      <h2 className="mt-8 text-[15px] font-semibold">Onboarded, no friends · {alone.length}</h2>
      <ul className="mt-3 card p-4 flex flex-wrap gap-3">
        {alone.map((p) => <li key={p.id}><Person p={p} /></li>)}
        {!alone.length && <li className="text-muted text-[13px]">Everyone has at least one friend.</li>}
      </ul>
    </AdminShell>
  );
}
