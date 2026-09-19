"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Row = { id: string; name: string | null; email: string | null; image: string | null; username: string | null };

export function UsersList({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((u) => [u.name, u.email, u.username].some((v) => v?.toLowerCase().includes(needle))) : rows;

  return (
    <>
      <label className="mt-4 relative block">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input className="input !pl-9" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or @username" autoFocus aria-label="Search users" />
      </label>
      {needle && <p className="mt-2 text-[12px] text-muted num">{shown.length} of {rows.length} match</p>}

      <ul className="mt-3 card divide-y divide-line overflow-hidden">
        {shown.map((u) => {
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
              {u.username
                ? <Link href={`/u/${u.username}`} className="flex items-center gap-3 px-4 py-3 hover:bg-panel-2 transition-colors">{body}</Link>
                : <div className="flex items-center gap-3 px-4 py-3 opacity-60">{body}</div>}
            </li>
          );
        })}
        {!shown.length && <li className="px-4 py-8 text-center text-muted text-[13px]">{rows.length ? "No users match." : "No users yet."}</li>}
      </ul>
    </>
  );
}
