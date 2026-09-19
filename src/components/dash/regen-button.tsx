"use client";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { regenerateBrief } from "@/app/actions";

export function RegenButton({ left }: { left: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const out = left <= 0;
  return (
    <span className="inline-flex items-center gap-2">
      {msg && <span className="text-[11.5px] text-muted">{msg}</span>}
      <button onClick={() => start(async () => setMsg((await regenerateBrief()).message))} disabled={pending || out}
        className="text-muted hover:text-ink disabled:opacity-40 disabled:hover:text-muted"
        title={out ? "No AI rewrites left today (shared free quota). Resets at midnight IST." : `Rewrite with latest numbers (${left} AI call${left === 1 ? "" : "s"} left today)`}>
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
      </button>
    </span>
  );
}
