"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { SECTION_META, type Section } from "@/lib/cat";

type Row = {
  id: string; name: string | null; email: string | null; image: string | null; username: string | null;
  // Null when the user has no profile row yet (signed up, never onboarded).
  targetPercentile: number | null; dreamColleges: string[] | null; weakSections: string[] | null;
  why: string | null; studyStartHour: number | null; studyEndHour: number | null;
};

const sectionLabel = (s: string) => SECTION_META[s as Section]?.label ?? s;
const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Details({ u }: { u: Row }) {
  if (u.targetPercentile == null) return <p className="text-muted">No goals yet — onboarding not finished.</p>;
  const item = (label: string, value: React.ReactNode) => (
    <div><dt className="label">{label}</dt><dd className="mt-0.5">{value}</dd></div>
  );
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {item("Target", <span className="num">{u.targetPercentile} %ile</span>)}
      {item("Weak sections", u.weakSections?.length ? u.weakSections.map(sectionLabel).join(", ") : <span className="text-muted">None picked</span>)}
      {item("Dream colleges", u.dreamColleges?.length ? u.dreamColleges.join(", ") : <span className="text-muted">None</span>)}
      {item("Study window", u.studyStartHour != null && u.studyEndHour != null ? <span className="num">{hour(u.studyStartHour)}–{hour(u.studyEndHour)}</span> : "—")}
      <div className="sm:col-span-2">{item("Why", u.why ? <span className="whitespace-pre-wrap break-words">{u.why}</span> : <span className="text-muted">Not written</span>)}</div>
    </dl>
  );
}

export function UsersList({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
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
  const filtering = !!(needle || college || hasWhy);
  const shown = rows.filter((u) =>
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
                <button type="button" onClick={() => toggle(u.id)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} goals for ${u.name ?? u.email}`}
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
