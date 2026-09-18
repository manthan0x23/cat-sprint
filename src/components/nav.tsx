"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, LineChart, Settings, Users } from "lucide-react";
import clsx from "clsx";

const items = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/mocks", label: "Mocks", icon: LineChart },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function TopNav({ requests = 0 }: { requests?: number }) {
  const path = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-1">
      {items.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={clsx(
            "px-3 h-8 inline-flex items-center rounded-lg text-[13.5px] transition-colors",
            path.startsWith(href) ? "bg-panel border border-line text-ink font-medium" : "text-muted hover:text-ink",
          )}
        >
          {label}
          {href === "/friends" && requests > 0 && <span className="ml-1.5 size-4 rounded-full bg-accent text-white text-[10px] grid place-items-center num">{requests}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-panel/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={clsx("flex flex-col items-center gap-1 py-2.5 text-[11px]", path.startsWith(href) ? "text-ink" : "text-muted")}>
            <Icon size={18} strokeWidth={path.startsWith(href) ? 2.2 : 1.7} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
