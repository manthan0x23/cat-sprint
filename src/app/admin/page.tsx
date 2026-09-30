import { loadAdminStats, type AdminStats, type AdminUser } from "@/lib/admin-stats";
import { fmtDate, SECTION_META, SECTIONS } from "@/lib/cat";
import { AdminShell, Locked, adminAccess } from "./shell";
import { DailyChart } from "./charts";
import { Person, Stat } from "./ui";

export const metadata = { title: "Analytics · CAT Sprint admin", robots: { index: false } };

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);

export default async function AdminOverviewPage() {
  const { local, ok } = await adminAccess();
  if (!ok) return <Locked />;
  const s = await loadAdminStats();
  const byId = new Map(s.people.map((p) => [p.id, p]));
  const activeToday = s.active.todayIds.map((id) => byId.get(id)).filter((p): p is AdminUser => !!p);

  return (
    <AdminShell local={local} tab="/admin">
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Analytics</h1>
        </div>
        <span className="chip num">{fmtDate(s.today, { weekday: "short", day: "numeric", month: "short" })} · IST</span>
      </div>

      <Section title="Active users" note="Active = opened the app, or logged practice / a mock / a sectional that day.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="DAU (today)" value={s.active.dau} sub={`${s.active.yesterday} yesterday`} />
          <Stat label="WAU (7 days)" value={s.active.wau} />
          <Stat label="MAU (30 days)" value={s.active.mau} sub={`of ${s.users.onboarded} onboarded`} />
          <Stat label="Stickiness" value={pct(s.active.stickiness)} sub={`avg DAU ${s.active.avgDau30.toFixed(1)} ÷ MAU`} />
        </div>
        <Card title="Daily active users · 30 days"><DailyChart data={s.active.series} kind="line" unit="active" /></Card>
        <Card title={`Active today · ${activeToday.length}`}>
          {activeToday.length ? (
            <ul className="flex flex-wrap gap-2">
              {activeToday.map((p) => <li key={p.id}><Person p={p} /></li>)}
            </ul>
          ) : <p className="text-[13px] text-muted">Nobody yet today.</p>}
        </Card>
      </Section>

      <Section title="Users">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Signed up" value={s.users.total} href="/admin/users" />
          <Stat label="Onboarded" value={s.users.onboarded} sub={pct(s.users.total ? s.users.onboarded / s.users.total : null) + " of sign-ups"} href="/admin/users?status=onboarded" />
          <Stat label="Not onboarded" value={s.users.notOnboarded} sub="signed in, never finished" href="/admin/users?status=not-onboarded" />
          <Stat label="New (7 days)" value={s.users.onboarded7} sub={`${s.users.onboardedToday} today · ${s.users.onboarded30} in 30d`} />
          <Stat label="Have a friend" value={s.friends.withFriend} sub={pct(s.users.onboarded ? s.friends.withFriend / s.users.onboarded : null) + " of onboarded"} href="/admin/friends" />
          <Stat label="Push on" value={s.users.pushOn} sub="subscribed + enabled" />
          <Stat label="Public profile" value={s.users.public} />
          <Stat label="Never active" value={s.users.neverActive} sub="onboarded, no activity seen" href="/admin/users?status=inactive" />
        </div>
        <Card title="Onboardings per day · 30 days"><DailyChart data={s.users.onboardedSeries} unit="onboarded" /></Card>
      </Section>

      <Section title="Progress logs" note="Counted by when the entry was saved (IST), not the day it was logged for.">
        <LogsTable logs={s.logs} />
        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Log entries per day"><DailyChart data={s.logs.series} unit="entries" /></Card>
          <Card title="People logging per day"><DailyChart data={s.logs.loggersSeries} unit="people" /></Card>
        </div>
      </Section>

      <Section title="Requests" note={s.trackingSince
        ? `Page loads + actions by signed-in users. Tracked since ${fmtDate(s.trackingSince)}.`
        : "Page loads + actions by signed-in users. Nothing tracked yet — starts with the next visit after this deploy."}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Today" value={s.requests.today} />
          <Stat label="Yesterday" value={s.requests.yesterday} />
          <Stat label="7 days" value={s.requests.last7} />
          <Stat label="Per active user today" value={s.active.dau ? (s.requests.today / s.active.dau).toFixed(1) : "—"} />
        </div>
        <Card title="Requests per day · 30 days"><DailyChart data={s.requests.series} unit="requests" /></Card>
      </Section>

      <Section title="Mocks, goals & system">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Mocks logged" value={s.mocks.total} sub={`${s.mocks.last7} in 7d · ${s.mocks.today} today`} />
          <Stat label="Avg mock score (30d)" value={s.mocks.avgScore30 == null ? "—" : s.mocks.avgScore30.toFixed(1)} sub={`${s.mocks.scored30} scored mocks`} />
          <Stat label="Sectionals (7d)" value={s.mocks.sectionals7} />
          <Stat label="Weekly goals set" value={s.goalsThisWeek} sub="this week" />
          <Stat label="AI calls today" value={`${s.ai.today} / ${s.ai.budget}`} sub={`${s.ai.last7} in 7d`} />
          <Stat label="Notifications today" value={s.notifications.today} sub={`${s.notifications.week} in 7d`} />
          <Stat label="Friendships" value={s.friends.accepted} sub={`${s.friends.pending} pending`} href="/admin/friends" />
        </div>
        {!!s.notifications.byKind.length && (
          <Card title="Notifications by kind · 7 days">
            <ul className="text-[13px] divide-y divide-line">
              {s.notifications.byKind.map(([k, n]) => <li key={k} className="flex justify-between py-1.5"><span>{k}</span><span className="num">{n}</span></li>)}
            </ul>
          </Card>
        )}
      </Section>

      <Section title="Retention" note="Rows: people who onboarded that week. Columns: share of them active in each week after (W0 = the week they joined).">
        <Cohorts cohorts={s.cohorts} />
      </Section>

      <Section title={`Slipping away · ${s.atRisk.length}`} note="Onboarded and active in the last 30 days, but nothing in the last 3 days.">
        <Card>
          {s.atRisk.length ? (
            <ul className="divide-y divide-line">
              {s.atRisk.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2 text-[13px]">
                  <Person p={p} />
                  <span className="ml-auto text-muted num">last seen {fmtDate(p.lastActive!)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-[13px] text-muted">Nobody — everyone recently active is still showing up.</p>}
        </Card>
      </Section>

      <Section title="Who they are" note="Onboarded users only.">
        <div className="grid gap-3 md:grid-cols-3">
          <Card title="Target percentile"><Tally rows={s.audience.targets.map((t) => ({ label: t.label, n: t.n }))} total={s.users.onboarded} /></Card>
          <Card title="Weak sections"><Tally rows={s.audience.weak.map((w) => ({ label: SECTION_META[w.section].label, n: w.n }))} total={s.users.onboarded} /></Card>
          <Card title="Top dream colleges">
            {s.audience.colleges.length ? <Tally rows={s.audience.colleges} total={s.users.onboarded} /> : <p className="text-[13px] text-muted">None listed.</p>}
          </Card>
        </div>
      </Section>
    </AdminShell>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 space-y-3">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {note && <p className="text-[12px] text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      {title && <div className="label mb-3">{title}</div>}
      {children}
    </div>
  );
}

function LogsTable({ logs }: { logs: AdminStats["logs"] }) {
  const cols = [
    { label: "Today", w: logs.today },
    { label: "Yesterday", w: logs.yesterday },
    { label: "This week", w: logs.thisWeek },
    { label: "Last week", w: logs.lastWeek },
    { label: "30 days", w: logs.last30 },
  ];
  const rows: { label: string; get: (w: (typeof cols)[number]["w"]) => number }[] = [
    { label: "Entries", get: (w) => w.entries },
    { label: "People logging", get: (w) => w.loggers },
    ...SECTIONS.map((k) => ({ label: `${SECTION_META[k].short} ${SECTION_META[k].unit}`, get: (w: (typeof cols)[number]["w"]) => w.units[k] })),
  ];
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-[13px] num">
        <thead>
          <tr className="text-muted text-left">
            <th className="px-4 py-2 font-normal" />
            {cols.map((c) => <th key={c.label} className="px-3 py-2 font-normal text-right whitespace-nowrap">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="px-4 py-2 text-left font-normal text-ink-2 whitespace-nowrap">{r.label}</th>
              {cols.map((c) => <td key={c.label} className="px-3 py-2 text-right">{r.get(c.w).toLocaleString("en-IN")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cohorts({ cohorts }: { cohorts: AdminStats["cohorts"] }) {
  const width = Math.max(...cohorts.map((c) => c.retained.length));
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-[12.5px] num">
        <thead>
          <tr className="text-muted">
            <th className="px-4 py-2 font-normal text-left">Joined week of</th>
            <th className="px-3 py-2 font-normal text-right">Users</th>
            {Array.from({ length: width }, (_, k) => <th key={k} className="px-2 py-2 font-normal">W{k}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {cohorts.map((c) => (
            <tr key={c.weekStart}>
              <td className="px-4 py-1.5 whitespace-nowrap">{fmtDate(c.weekStart)}</td>
              <td className="px-3 py-1.5 text-right">{c.size}</td>
              {Array.from({ length: width }, (_, k) => {
                const v = c.retained[k];
                return (
                  <td key={k} className="px-1 py-1">
                    {v != null && c.size > 0 && (
                      <div className="rounded px-1.5 py-1 text-center" title={`${Math.round(v * c.size)} of ${c.size}`}
                        style={{ background: `color-mix(in srgb, var(--s-done) ${Math.round(v * 70)}%, transparent)`, color: v > 0.55 ? "white" : undefined }}>
                        {pct(v)}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tally({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  return (
    <ul className="space-y-2 text-[13px]">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-2"><span className="truncate">{r.label}</span><span className="num text-muted">{r.n}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-panel-2 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${total ? (r.n / total) * 100 : 0}%`, background: "var(--s-done)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
