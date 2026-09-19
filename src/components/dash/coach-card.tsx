import { cache } from "react";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { aiCallsLeft, cachedAI } from "@/lib/ai";
import { dashboardSlot, fallback, prompt, TITLES } from "@/lib/coach";
import { loadCoachContext } from "@/lib/coach-context";
import type { UserState } from "@/lib/data";
import { RegenButton } from "./regen-button";

/** Deduped per request, so the coach card and the welcome popup share one AI call. */
export const getCoach = cache(async (state: UserState) => {
  const ctx = await loadCoachContext(state);
  const { sit, kind } = dashboardSlot(state, ctx);
  const { text, ai } = await cachedAI(state.profile.userId, kind, prompt(state, sit, ctx), fallback(state, sit, ctx));
  return { sit, text, ai, ctx };
});

export async function CoachCard({ state }: { state: UserState }) {
  const { sit, text, ai } = await getCoach(state);
  const comeback = sit === "morning-comeback";
  return (
    <div className={clsx("card p-5 relative overflow-hidden", comeback && "!border-bad/35")}>
      <div className={clsx("absolute -top-16 -right-16 size-44 rounded-full blur-2xl", comeback ? "bg-bad/10" : "bg-accent/10")} />
      <div className="flex items-center justify-between">
        <span className="label inline-flex items-center gap-1.5">
          <Sparkles size={12} className={comeback ? "text-bad" : "text-accent"} /> Coach · {TITLES[sit](state)}
        </span>
        <RegenButton left={await aiCallsLeft(state.profile.userId)} />
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink">{text}</p>
      <p className="mt-3 text-[11px] text-muted">
        {ai ? "Written by Qwen from your numbers" : "Rule-based (AI unavailable or daily budget used)"} · {state.profile.coachIntensity} tone
      </p>
    </div>
  );
}

export function CoachSkeleton() {
  return (
    <div className="card p-5">
      <span className="label inline-flex items-center gap-1.5"><Sparkles size={12} className="text-accent pulse" /> Coach is thinking…</span>
      <div className="mt-4 space-y-2">
        <div className="h-3 rounded bg-line w-11/12 pulse" />
        <div className="h-3 rounded bg-line w-4/5 pulse" />
        <div className="h-3 rounded bg-line w-2/3 pulse" />
      </div>
    </div>
  );
}
