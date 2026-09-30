"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { addDays, fmtDate, SECTION_META, type Section } from "@/lib/cat";
import type { AdminUser as Row } from "@/lib/admin-stats";
import { STATUSES, type Status } from "./statuses";


const SORTS = [
  { id: "name", label: "Name" },
  { id: "recent", label: "Last active" },
  { id: "active", label: "Most active (30d)" },
  { id: "logs", label: "Most logs (7d)" },
  { id: "friends", label: "Most friends" },
] as const;
type Sort = (typeof SORTS)[number]["id"];

function matchesStatus(u: Row, status: Status, today: string) {
  const week = addDays(today, -6);
  switch (status) {
    case "all": return true;
    case "onboarded": return u.onboarded;
    case "not-onboarded": return !u.onboarded;
    case "active-today": return u.lastActive === today;
    case "active-7d": return !!u.lastActive && u.lastActive >= week;
    case "inactive": return u.onboarded && (!u.lastActive || u.lastActive < week);
  }
}

function sortRows(rows: Row[], sort: Sort) {
  const by: Record<Sort, (a: Row, b: Row) => number> = {
    name: () => 0, // rows arrive sorted by name
    recent: (a, b) => (b.lastActive ?? "").localeCompare(a.lastActive ?? ""),
    active: (a, b) => b.activeDays30 - a.activeDays30 || b.requests30 - a.requests30,
    logs: (a, b) => b.logs7 - a.logs7,
    friends: (a, b) => b.friends - a.friends,
  };
  return [...rows].sort(by[sort]);
}

const sectionLabel = (s: string) => SECTION_META[s as Section]?.label ?? s;
const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Details({ u }: { u: Row }) {
  const item = (label: string, value: React.ReactNode) => (
    <div><dt className="label">{label}</dt><dd className="mt-0.5">{value}</dd></div>
  );
  const activity = (
    <dl className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      {item("Last active", u.lastActive ? <span className="num">{fmtDate(u.lastActive)}</span> : <span className="text-muted">Never</span>)}
      {item("Active days", <span className="num">{u.activeDays7} / 7 · {u.activeDays30} / 30</span>)}
      {item("Requests (30d)", <span className="num">{u.requests30}</span>)}
      {item("Logs (7d) · mocks", <span className="num">{u.logs7} · {u.mocks}</span>)}
      {item("Friends", <span className="num">{u.friends}</span>)}
      {item("Onboarded", u.onboardedOn ? <span className="num">{fmtDate(u.onboardedOn)}</span> : <span className="text-muted">No</span>)}
      {item("Profile", u.visibility ?? "—")}
      {item("Push", u.pushOn ? "On" : "Off")}
    </dl>
  );
  if (u.targetPercentile == null) return <div className="space-y-3">{activity}<p className="text-muted">No goals yet — onboarding not finished.</p></div>;
  return (
    <div className="space-y-4">
    {activity}
    <dl className="grid gap-3 sm:grid-cols-2 border-t border-line pt-3">
      {item("Target", <span className="num">{u.targetPercentile} %ile</span>)}
      {item("Weak sections", u.weakSections?.length ? u.weakSections.map(sectionLabel).join(", ") : <span className="text-muted">None picked</span>)}
      {item("Dream colleges", u.dreamColleges?.length ? u.dreamColleges.join(", ") : <span className="text-muted">None</span>)}
      {item("Study window", u.studyStartHour != null && u.studyEndHour != null ? <span className="num">{hour(u.studyStartHour)}–{hour(u.studyEndHour)}</span> : "—")}
      <div className="sm:col-span-2">{item("Why", u.why ? <span className="whitespace-pre-wrap break-words">{u.why}</span> : <span className="text-muted">Not written</span>)}</div>
    </dl>
    </div>
  );
}

export function UsersList({ rows, today, initialStatus }: { rows: Row[]; today: string; initialStatus: Status }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>(initialStatus);
  const [sort, setSort] = useState<Sort>("name");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [college, setCollege] = useState("");
  const [hasWhy, setHasWhy] = useState(false);
  // Every dream college anyone listed, matched case-insensitively ("iima" and "IIMA" are one option).
  const colleges = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const c of rows.flatMap((u) => u.dreamColleges ?? [])) {
      const key = c.trim().toLowerCase();
      if (key && !byKey.has(key)) byKey.set(key, c.trim());
    }
    return [...byKey].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const needle = q.trim().toLowerCase();
  const filtering = !!(needle || college || hasWhy || status !== "all");
  const shown = sortRows(rows, sort).filter((u) =>
    matchesStatus(u, status, today) &&
    (!needle || [u.name, u.email, u.username].some((v) => v?.toLowerCase().includes(needle))) &&
    (!college || (u.dreamColleges ?? []).some((c) => c.trim().toLowerCase() === college)) &&
    (!hasWhy || !!u.why?.trim()));
  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  return (
    <>
      <label className="mt-4 relative block">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input className="input !pl-9" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or @username" autoFocus aria-label="Search users" />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select className="input !w-auto !h-9 text-[13px]" value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Filter by status">
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="input !w-auto !h-9 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort users">
          {SORTS.map((s) => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
        </select>
        <select className="input !w-auto !h-9 text-[13px]" value={college} onChange={(e) => setCollege(e.target.value)} aria-label="Filter by dream college">
          <option value="">All colleges</option>
          {colleges.map(([key, label]) => <option key={key} value={key}>Wants {label}</option>)}
        </select>
        <label className="chip cursor-pointer select-none !h-9">
          <input type="checkbox" checked={hasWhy} onChange={(e) => setHasWhy(e.target.checked)} /> Wrote a why
        </label>
      </div>
      {filtering && <p className="mt-2 text-[12px] text-muted num">{shown.length} of {rows.length} match</p>}

      <ul className="mt-3 card divide-y divide-line overflow-hidden">
        {shown.map((u) => {
          const isOpen = open.has(u.id);
          const body = (
            <>
              <Avatar src={u.image} name={u.name ?? u.email} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium truncate">{u.name ?? "No name"}</div>
                <div className="text-[12.5px] text-muted truncate">{u.email}</div>
                <div className="text-[11.5px] text-muted num truncate">
                  {u.lastActive === today ? <span className="text-good">● active today</span> : u.lastActive ? `seen ${fmtDate(u.lastActive)}` : "never seen"}
                  {u.onboarded && <> · {u.activeDays30}/30 days · {u.logs7} logs this wk · {u.friends} friend{u.friends === 1 ? "" : "s"}</>}
                </div>
              </div>
              {u.username
                ? <span className="flex items-center gap-1 text-[12px] text-muted num shrink-0">@{u.username}<ChevronRight size={15} /></span>
                : <span className="text-[12px] text-muted shrink-0">Not onboarded</span>}
            </>
          );
          return (
            <li key={u.id}>
              <div className="flex items-stretch">
                {u.username
                  ? <Link href={`/u/${u.username}`} className="flex flex-1 min-w-0 items-center gap-3 pl-4 pr-2 py-3 hover:bg-panel-2 transition-colors">{body}</Link>
                  : <div className="flex flex-1 min-w-0 items-center gap-3 pl-4 pr-2 py-3 opacity-60">{body}</div>}
                <button type="button" onClick={() => toggle(u.id)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} details for ${u.name ?? u.email}`}
                  className="px-3 text-muted hover:bg-panel-2 transition-colors">
                  <ChevronDown size={17} className={clsx("transition-transform", isOpen && "rotate-180")} />
                </button>
              </div>
              {isOpen && <div className="px-4 pb-4 pt-1 text-[13px]"><Details u={u} /></div>}
            </li>
          );
        })}
        {!shown.length && <li className="px-4 py-8 text-center text-muted text-[13px]">{rows.length ? "No users match." : "No users yet."}</li>}
      </ul>
    </>
  );
}
