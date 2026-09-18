"use client";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { regenerateBrief } from "@/app/actions";

export function RegenButton() {
  const [pending, start] = useTransition();
  return (
    <button onClick={() => start(() => regenerateBrief())} disabled={pending} className="text-muted hover:text-ink disabled:opacity-50" title="Rewrite with latest numbers (uses 1 AI call)">
      <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
    </button>
  );
}
