import Link from "next/link";
import type { AdminUser } from "@/lib/admin-stats";
import { Avatar } from "@/components/avatar";

export function Stat({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: string; href?: string }) {
  const body = (
    <>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight num">{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-muted num">{sub}</div>}
    </>
  );
  return href
    ? <Link href={href} className="card p-4 hover:border-line-2 transition-colors">{body}</Link>
    : <div className="card p-4">{body}</div>;
}

export function Person({ p }: { p: AdminUser }) {
  const body = <><Avatar src={p.image} name={p.name ?? p.email} size={24} /><span className="truncate">{p.name ?? p.email}</span></>;
  const cls = "inline-flex items-center gap-2 min-w-0 text-[13px]";
  return p.username ? <Link href={`/u/${p.username}`} className={`${cls} hover:underline`}>{body}</Link> : <span className={cls}>{body}</span>;
}
