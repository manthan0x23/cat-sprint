import Link from "next/link";
import clsx from "clsx";
import { isAdmin, isLocalAdmin } from "@/lib/admin";
import { Logo } from "@/components/logo";
import { LockButton, UnlockForm } from "./unlock-form";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/friends", label: "Friends" },
] as const;

/** Local dev on localhost is always admin; in production it needs the admin password. Pages must check this before loading data. */
export async function adminAccess() {
  const local = await isLocalAdmin();
  return { local, ok: local || (await isAdmin()) };
}

export function Locked() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-8">
      <Logo />
      <UnlockForm />
    </main>
  );
}

export function AdminShell({ local, tab, children }: { local: boolean; tab: (typeof TABS)[number]["href"]; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin"><Logo /></Link>
        {local ? <span className="chip">Local admin</span> : <LockButton />}
      </div>
      <nav className="mt-6 flex gap-1 border-b border-line" aria-label="Admin sections">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.href === tab ? "page" : undefined}
            className={clsx("px-3 py-2 -mb-px text-[14px] border-b-2 transition-colors",
              t.href === tab ? "border-accent text-ink font-medium" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
