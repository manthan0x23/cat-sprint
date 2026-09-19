"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, LayoutDashboard, LineChart, LogOut, Menu, Percent, Settings, UserRound, Users, X } from "lucide-react";
import { ThemeSwitcher } from "./theme-switcher";

const items = [
  { href: "/dashboard", label: "Today", desc: "Log progress, see your pace", icon: LayoutDashboard },
  { href: "/planner", label: "Planner", desc: "Every day to 29 Nov", icon: CalendarDays },
  { href: "/mocks", label: "Mocks", desc: "Scores and trend", icon: LineChart },
  { href: "/percentiles", label: "Score vs %ile", desc: "What past CATs needed", icon: Percent },
  { href: "/friends", label: "Friends", desc: "Today's board, nudges", icon: Users },
  { href: "/settings", label: "Settings", desc: "Goal, coach, notifications", icon: Settings },
];

export function NavSheet({ user, username, requests, logout }: {
  user: { name: string; email: string; image: string | null };
  username: string | null;
  requests: number;
  logout: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setOpen(false); } // close on navigation

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const current = items.find((i) => path.startsWith(i.href));
  // The header uses backdrop-filter, which traps position:fixed children. Portal the sheet to <body>.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  return (
    <>
      {/* Desktop: the main pages are visible links, so the app's shape is obvious without opening anything. */}
      <nav aria-label="Main" className="hidden md:flex items-center gap-0.5 mr-1">
        {items.filter((i) => i.href !== "/settings").map(({ href, label, icon: Icon }) => {
          const active = current?.href === href;
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={clsx("relative inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-colors",
                active ? "bg-accent-soft text-ink" : "text-muted hover:text-ink hover:bg-panel-2")}>
              <Icon size={14} className={active ? "text-accent" : undefined} />
              {label}
              {href === "/friends" && requests > 0 && <span className="size-1.5 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>

      <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}
        className="group relative inline-flex items-center gap-2 h-9 pl-3 pr-1 rounded-full border border-line bg-panel hover:border-line-2 transition-colors">
        <Menu size={15} className="text-muted group-hover:text-ink transition-colors" />
        <span className="text-[13px] font-medium md:hidden">Menu</span>
        <Avatar image={user.image} name={user.name} size={26} />
        {requests > 0 && <span className="absolute -top-1 -right-1 size-4 rounded-full bg-accent text-white text-[10px] grid place-items-center num ring-2 ring-bg">{requests}</span>}
      </button>

      {mounted && createPortal(<>
      <div aria-hidden={!open}
        className={clsx("fixed inset-0 z-50 transition-[opacity,backdrop-filter] duration-300",
          open ? "opacity-100 backdrop-blur-md bg-black/25 pointer-events-auto" : "opacity-0 backdrop-blur-0 bg-transparent pointer-events-none")}
        onClick={() => setOpen(false)} />

      <aside role="dialog" aria-modal="true" aria-label="Navigation"
        className={clsx(
          "fixed z-50 bg-panel border-line shadow-2xl flex flex-col transition-[transform,visibility] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[22px] border-t pb-[env(safe-area-inset-bottom)]",
          "md:inset-x-auto md:right-3 md:top-3 md:bottom-3 md:w-[360px] md:max-h-none md:rounded-[20px] md:border",
          open ? "visible translate-y-0 md:translate-x-0" : "invisible translate-y-full md:translate-y-0 md:translate-x-[calc(100%+24px)]",
        )}>
        <div className="md:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-2" />
        <div className="flex items-center gap-3 px-5 pt-4 pb-4 border-b border-line">
          <Avatar image={user.image} name={user.name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{user.name}</div>
            <div className="text-[12px] text-muted truncate num">{username ? `@${username}` : user.email}</div>
          </div>
          <button onClick={() => setOpen(false)} className="size-8 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-panel-2" aria-label="Close menu"><X size={17} /></button>
        </div>

        <nav className="p-2.5 overflow-y-auto">
          {items.map(({ href, label, desc, icon: Icon }, i) => {
            const active = path.startsWith(href);
            return (
              <Link key={href} href={href}
                style={{ transitionDelay: open ? `${60 + i * 30}ms` : "0ms" }}
                className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300",
                  open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
                  active ? "bg-accent-soft" : "hover:bg-panel-2")}>
                <span className={clsx("size-9 rounded-lg grid place-items-center border", active ? "bg-panel border-accent/30 text-accent" : "bg-panel-2 border-line text-ink-2")}>
                  <Icon size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 text-[14px] font-medium">
                    {label}
                    {href === "/friends" && requests > 0 && <span className="chip !h-5 !px-1.5 !text-[10.5px] !bg-accent !text-white !border-accent num">{requests} new</span>}
                  </span>
                  <span className="block text-[12px] text-muted truncate">{desc}</span>
                </span>
              </Link>
            );
          })}
          {username && (
            <Link href={`/u/${username}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-panel-2">
              <span className="size-9 rounded-lg grid place-items-center border bg-panel-2 border-line text-ink-2"><UserRound size={16} /></span>
              <span className="text-[14px] font-medium">Your profile</span>
            </Link>
          )}
        </nav>

        <div className="mt-auto p-4 border-t border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="label">Theme</span>
            <ThemeSwitcher />
          </div>
          <form action={logout}>
            <button className="btn btn-ghost btn-sm"><LogOut size={13} /> Sign out</button>
          </form>
        </div>
        <div className="hidden md:block px-5 pb-3 -mt-1 text-[11px] text-muted"><kbd className="num">Ctrl/⌘ K</kbd> to toggle · <kbd className="num">Esc</kbd> to close</div>
      </aside>
      </>, document.body)}
    </>
  );
}

function Avatar({ image, name, size }: { image: string | null; name: string; size: number }) {
  return (
    <span className="shrink-0 rounded-full overflow-hidden border border-line bg-panel-2 grid place-items-center text-muted font-medium"
      style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        : (name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
