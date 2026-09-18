"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

export type WelcomeRow = { k: string; v: string; tone?: "good" | "warn" | "bad" | "muted" };

// Shows once per (IST date × part of day): morning, afternoon, evening, night → up to 4 a day.
export function WelcomeModal({ storageKey, title, tone, rows, children }: {
  storageKey: string; title: string; tone: "good" | "warn" | "bad"; rows: WelcomeRow[]; children: React.ReactNode;
}) {
  const seen = useSyncExternalStore(
    () => () => {},
    () => { try { return localStorage.getItem(storageKey) === "1"; } catch { return true; } },
    () => true,
  );
  const [closed, setClosed] = useState(false);
  const show = !seen && !closed;
  const close = () => {
    try { localStorage.setItem(storageKey, "1"); } catch {}
    setClosed(true);
  };
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { try { localStorage.setItem(storageKey, "1"); } catch {} setClosed(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, storageKey]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4" onClick={close}>
      <div className={clsx("card w-full md:max-w-md rounded-b-none md:rounded-b-[14px] overflow-hidden rise",
        tone === "bad" && "!border-bad/40", tone === "warn" && "!border-warn/40")} onClick={(e) => e.stopPropagation()}>
        <div className={clsx("px-5 pt-5 pb-4", tone === "bad" ? "bg-bad-soft/60" : tone === "warn" ? "bg-warn-soft/60" : "bg-good-soft/50")}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
            <button onClick={close} className="text-muted hover:text-ink" aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <ul className="px-5 py-3 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.k} className="flex justify-between gap-4 py-2 text-[13.5px]">
              <span className="text-muted">{r.k}</span>
              <span className={clsx("num text-right", r.tone === "bad" && "text-bad", r.tone === "warn" && "text-warn", r.tone === "good" && "text-good")}>{r.v}</span>
            </li>
          ))}
        </ul>
        <div className="px-5 pb-5">
          <div className="rounded-xl border border-line bg-panel-2 p-3.5 text-[14px] leading-relaxed">{children}</div>
          <button onClick={close} className="btn btn-accent w-full mt-4 h-10">Start working</button>
        </div>
      </div>
    </div>
  );
}
