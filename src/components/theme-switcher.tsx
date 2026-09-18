"use client";
import { useSyncExternalStore } from "react";
import clsx from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "light" | "system" | "dark";
const OPTIONS: { v: Theme; icon: typeof Sun; label: string }[] = [
  { v: "light", icon: Sun, label: "Light" },
  { v: "system", icon: Monitor, label: "System" },
  { v: "dark", icon: Moon, label: "Dark" },
];

const listeners = new Set<() => void>();
function read(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}
function apply(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", t);
  } catch {}
  const el = document.documentElement;
  // Brief global transition so the switch blends instead of snapping
  el.classList.add("theme-anim");
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
  window.setTimeout(() => el.classList.remove("theme-anim"), 350);
  listeners.forEach((l) => l());
}

export function ThemeSwitcher({ className }: { className?: string }) {
  const theme = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => "system" as Theme,
  );
  const idx = OPTIONS.findIndex((o) => o.v === theme);
  return (
    <div role="radiogroup" aria-label="Theme"
      className={clsx("relative inline-grid grid-cols-3 h-8 p-0.5 rounded-full border border-line bg-panel-2", className)}>
      <span aria-hidden className="absolute top-0.5 bottom-0.5 left-0.5 w-7 rounded-full bg-panel border border-line shadow-sm transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ transform: `translateX(${idx * 28}px)` }} />
      {OPTIONS.map(({ v, icon: Icon, label }) => (
        <button key={v} role="radio" aria-checked={theme === v} aria-label={label} title={label} onClick={() => apply(v)}
          className={clsx("relative z-10 size-7 grid place-items-center rounded-full transition-colors", theme === v ? "text-ink" : "text-muted hover:text-ink")}>
          <Icon size={14} strokeWidth={theme === v ? 2.2 : 1.8} />
        </button>
      ))}
    </div>
  );
}
