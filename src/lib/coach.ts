import type { UserState } from "./data";
import { addDays, daysToExam, fmtHour, SECTIONS, SECTION_META, unitLabel } from "./cat";
import { minutesToH } from "./progress";

// The coach engine.
//   1. classify() decides the SITUATION from numbers (rules → reliable timing).
//   2. prompt() hands the model the facts + situation + the user's chosen tone.
//   3. fallback() writes a specific, number-heavy message if AI is unavailable.

export type Situation =
  | "morning" | "morning-mock" | "morning-comeback" | "morning-streak"
  | "applause" | "almost" | "evening-on-track" | "behind" | "way-behind" | "ignored" | "last-call"
  | "night" | "mock-eve";

export type SentRow = { kind: string; meta: { doneMinutes: number; ratio: number; situation: string } | null };

export type CoachContext = {
  sentToday: SentRow[];
  sentYesterday: SentRow[];
  friendsDoneToday: string[]; // first names of friends who've finished today
  friendsCount: number;
};

/** Fixed IST check-ins (3 PM and 8 PM always, if inside the study window). */
export const CHECKPOINTS = [12, 15, 18, 20, 22];

export function checkpointsFor(start: number, end: number) {
  return CHECKPOINTS.filter((h) => h >= start + 1 && h <= end);
}

export function remaining(s: UserState) {
  const t = s.todayPlan?.targets;
  if (!t) return { text: "", minutes: 0, items: [] as string[] };
  const items = SECTIONS.map((k) => ({ k, n: Math.max(0, t[k] - s.todayDone[k]) }))
    .filter((x) => x.n > 0)
    .map((x) => unitLabel(x.k, x.n));
  if (s.todayPlan?.type === "mock") {
    if (!s.todayPlan.mockDone) items.unshift("the mock");
    if (!s.todayPlan.analysisDone) items.splice(s.todayPlan.mockDone ? 0 : 1, 0, "the analysis");
  }
  const minutes = Math.max(0, s.stats.today.planned - s.stats.today.done);
  return { text: items.join(", "), minutes, items };
}

export function yesterdayRow(s: UserState) {
  const y = addDays(s.today, -1);
  return s.stats.history.find((h) => h.date === y && h.planned > 0) ?? null;
}

/** Warnings sent yesterday after which no further progress was logged. */
export function ignoredYesterday(s: UserState, ctx: CoachContext) {
  const y = yesterdayRow(s);
  if (!y) return 0;
  return ctx.sentYesterday.filter((r) => r.meta && isWarning(r.meta.situation) && Math.abs(r.meta.doneMinutes - y.done) < 1).length;
}

function isWarning(sit: string) {
  return sit === "behind" || sit === "way-behind" || sit === "ignored" || sit === "last-call";
}

export function classifyMorning(s: UserState): Situation {
  const y = yesterdayRow(s);
  if (y && y.ratio < 0.5) return "morning-comeback";
  if (s.todayPlan?.type === "mock") return "morning-mock";
  if (y && y.ratio >= 1 && s.stats.streak >= 2) return "morning-streak";
  return "morning";
}

/** What to say at a check-in (or null = stay quiet). */
export function classifyCheckpoint(s: UserState, ctx: CoachContext, hour: number): Situation | null {
  const planned = s.stats.today.planned;
  if (!planned) return null;
  const ratio = s.stats.today.done / planned;
  if (ratio >= 1) return ctx.sentToday.some((r) => r.kind === "applause") ? null : "applause";
  if (ratio >= 0.75) return "almost";
  const lastWarn = [...ctx.sentToday].reverse().find((r) => r.meta && isWarning(r.meta.situation));
  const noProgressSinceWarn = lastWarn?.meta && Math.abs(lastWarn.meta.doneMinutes - s.stats.today.done) < 1;
  if (hour >= 22) return "last-call";
  const st = s.stats.todayStatus;
  if (st === "ahead" || st === "on-track") return hour >= 20 ? "evening-on-track" : null;
  if (noProgressSinceWarn) return "ignored";
  return st === "behind" ? "behind" : "way-behind";
}

export const TITLES: Record<Situation, (s: UserState) => string> = {
  morning: () => "Today's plan",
  "morning-mock": (s) => `${s.todayPlan?.mockName ?? "Mock"} day`,
  "morning-comeback": () => "Yesterday's shortfall",
  "morning-streak": (s) => `${s.stats.streak}-day streak`,
  applause: () => "Day complete",
  almost: () => "Almost there",
  "evening-on-track": () => "Evening check-in",
  behind: (s) => `${fmtHour(s.hour)} check-in`,
  "way-behind": (s) => `${fmtHour(s.hour)}: you're falling behind`,
  ignored: () => "No progress since last reminder",
  "last-call": () => "Last call for today",
  night: () => "Day summary",
  "mock-eve": () => "Mock tomorrow",
};

// ---------- Facts for the model ----------
function lastMockLine(m: UserState["mocks"][number]) {
  const secs = m.varc != null || m.dilr != null || m.qa != null ? ` (VARC ${m.varc ?? "?"}, DILR ${m.dilr ?? "?"}, QA ${m.qa ?? "?"})` : "";
  const notes = Object.entries(m.sectionNotes ?? {}).map(([k, v]) => `${SECTION_META[k as keyof typeof SECTION_META]?.short ?? k}: "${v}"`).join("; ");
  return `${m.name}, score ${m.score ?? "?"}${secs}.${notes ? ` Their notes: ${notes}.` : ""}`;
}

export function facts(s: UserState, ctx?: CoachContext) {
  const t = s.todayPlan;
  const y = yesterdayRow(s);
  const rem = remaining(s);
  const lines = [
    `Name: ${s.firstName}. Days to CAT (29 Nov 2026): ${daysToExam(s.today)}. Target: ${s.profile.targetPercentile} %ile.`,
    s.profile.dreamColleges.length ? `Dream colleges: ${s.profile.dreamColleges.join(", ")}.` : "",
    s.profile.why ? `Their own "why", in their words: "${s.profile.why}"` : "",
    s.profile.weakSections.length ? `Weak sections: ${s.profile.weakSections.map((w) => SECTION_META[w as keyof typeof SECTION_META]?.short ?? w).join(", ")}.` : "",
    t ? `Today: ${t.type} day${t.mockName ? ` (${t.mockName})` : ""}. Targets: ${SECTIONS.map((k) => unitLabel(k, t.targets[k])).join(", ")}.` : "No plan today.",
    `Done today: ${SECTIONS.map((k) => `${SECTION_META[k].short} ${s.todayDone[k]}`).join(", ")} = ${Math.round((s.stats.today.ratio || 0) * 100)}% of today's work.`,
    rem.text ? `Still left today: ${rem.text} (~${minutesToH(rem.minutes)}).` : "Nothing left today.",
    `Time now: ${fmtHour(s.hour)} IST. Study window ends ${fmtHour(s.profile.studyEndHour)} (${Math.max(0, s.profile.studyEndHour - s.hour).toFixed(1)}h left).`,
    y ? `Yesterday: ${Math.round(y.ratio * 100)}% done.` : "",
    ctx ? `Nudges ignored yesterday: ${ignoredYesterday(s, ctx)}.` : "",
    `14-day consistency ${Math.round(s.stats.consistency * 100)}%. Streak ${s.stats.streak} days. Backlog ${minutesToH(s.stats.debtMinutes)} (= +${Math.round(s.stats.extraPerDay)} min/day until CAT).`,
    s.projection
      ? `Mock score now ~${s.projection.base.toFixed(0)}; projected on CAT day at current consistency: ${s.projection.projected.toFixed(0)}. Finishing today → ${s.impact.scoreIfDone?.toFixed(1)}; skipping → ${s.impact.scoreIfSkip?.toFixed(1)}.`
      : `No score projection yet (fewer than 2 mock scores).`,
    s.mocks.length ? `Last mock: ${lastMockLine(s.mocks.at(-1)!)}` : "",
    `Mocks taken so far: ${s.mocksTaken}; ${s.mocksPlannedLeft} planned before CAT.`,
    s.week.goal
      ? `Locked weekly goal (${s.week.daysLeft} days left in the week): ${Math.round((s.week.pct ?? 0) * 100)}% done. Remaining per day to hit it: ${SECTIONS.filter((k) => (s.week.perDayNeeded?.[k] ?? 0) > 0).map((k) => unitLabel(k, s.week.perDayNeeded![k])).join(", ") || "nothing, goal met"}.`
      : "No weekly goal locked yet this week.",
    ctx && ctx.friendsCount ? `Friends who already finished today: ${ctx.friendsDoneToday.length ? ctx.friendsDoneToday.join(", ") : "none yet"} (of ${ctx.friendsCount}).` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const SITUATION_BRIEF: Record<Situation, string> = {
  morning: "Morning brief. Name the single most important thing today and connect it to their target/why.",
  "morning-mock": "Mock day morning. Tell them how to approach today's mock and why the analysis after it matters more.",
  "morning-comeback": "They slacked yesterday (and may have ignored nudges). Call it out bluntly with the numbers: what yesterday cost (backlog, consistency). Then demand a comeback today with one concrete first task. No coddling.",
  "morning-streak": "They finished yesterday and are on a streak. Acknowledge it in one line, then raise the bar for today.",
  applause: "They just finished today's full plan. Applaud genuinely and specifically (use numbers). Tell them to rest or do light revision, not burn out.",
  almost: "They are 75%+ done. Push them to close the day: name exactly what's left and how little time it takes.",
  "evening-on-track": "Evening, they're on pace. Short, confident nudge listing exactly what's left to finish tonight.",
  behind: "They're behind for this time of day. Name the gap and the cost of skipping, then one specific next 45-minute action.",
  "way-behind": "They're far behind (maybe nothing logged). Be direct about the gap and what skipping costs, then a tiny, specific first action to start NOW.",
  ignored: "They ignored the previous nudge: nothing logged since. Escalate. Call out the ignoring, use their own 'why' against the excuse, then give a 25-minute micro-task.",
  "last-call": "Last call of the night, day not done. State what's left and what the day will cost if they stop now. Offer the smallest meaningful thing they can still do tonight.",
  night: "Day summary.",
  "mock-eve": "Mock tomorrow. Practical prep advice.",
};

const INTENSITY: Record<string, string> = {
  gentle: "Tone: supportive, encouraging coach. Acknowledge effort, never shame.",
  firm: "Tone: direct, professional coach. State the facts and the cost plainly, no fluff.",
  strict: "Tone: strict, demanding mentor. Blunt about missed work and its cost, holds them to their stated goal, but always professional: no sarcasm, taunts, slang or insults.",
};

export function prompt(s: UserState, sit: Situation, ctx?: CoachContext) {
  const tone = s.profile.coachIntensity;
  // praise is always delivered straight, even in strict mode
  const effectiveTone = (sit === "applause" || sit === "morning-streak") && tone === "strict" ? "firm" : tone;
  return `${facts(s, ctx)}

SITUATION: ${SITUATION_BRIEF[sit]}
${INTENSITY[effectiveTone] ?? INTENSITY.firm}
Language: clear, professional English. No slang, no Hindi words, no emojis.
Format: a phone notification. Max 2 sentences, under 260 characters. Use at least one concrete number from the facts. No hashtags, no quotes around the message, no greeting like "Hey".`;
}

// ---------- Rule-based fallbacks (used when AI is unavailable) ----------
function pick<T>(arr: T[], key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return arr[Math.abs(h) % arr.length];
}

export function fallback(s: UserState, sit: Situation, ctx?: CoachContext): string {
  const strict = s.profile.coachIntensity === "strict";
  const rem = remaining(s);
  const pct = Math.round((s.stats.today.ratio || 0) * 100);
  const left = daysToExam(s.today);
  const y = yesterdayRow(s);
  const ign = ctx ? ignoredYesterday(s, ctx) : 0;
  const cost = s.impact.scoreIfSkip != null && s.impact.scoreIfDone != null
    ? `Skipping lowers your projected mock score from ${s.impact.scoreIfDone.toFixed(1)} to ${s.impact.scoreIfSkip.toFixed(1)}.`
    : `Skipping adds ${minutesToH(rem.minutes)} to your backlog.`;
  const friend = ctx?.friendsDoneToday[0];
  const key = s.today + sit;
  const mockName = s.todayPlan?.mockName ?? "Your mock";

  switch (sit) {
    case "morning":
      return `${left} days to CAT. Today's plan: ${rem.text}. Complete the first block before ${fmtHour(s.profile.studyStartHour + 1)}.`;
    case "morning-mock":
      return `${mockName} is scheduled today. Attempt it in one sitting at your CAT slot, then spend as long on the analysis as on the mock itself.`;
    case "morning-comeback": {
      const ignLine = ign ? ` ${ign} reminder${ign > 1 ? "s were" : " was"} not acted on.` : "";
      return `Yesterday you completed ${Math.round((y?.ratio ?? 0) * 100)}% of the plan.${ignLine} Your backlog is now ${minutesToH(s.stats.debtMinutes)}.${strict ? ` That is not the pace a ${s.profile.targetPercentile} percentile requires.` : ""} Start today with one DILR set.`;
    }
    case "morning-streak":
      return `${s.stats.streak} consecutive days completed. Keep it going today: ${rem.text}.`;
    case "applause":
      return `Today's plan is complete: ${minutesToH(s.stats.today.done)} of focused work. This is the consistency a ${s.profile.targetPercentile} percentile is built on. Rest well.`;
    case "almost":
      return `${pct}% complete. Only ${rem.text} remain (about ${minutesToH(rem.minutes)}). Finish the day.`;
    case "evening-on-track":
      return `You are on pace. Remaining for tonight: ${rem.text}.`;
    case "behind":
    case "way-behind":
      return pick([
        `It is ${fmtHour(s.hour)} and you are at ${pct}% of today's plan. ${cost} Start one DILR set now.`,
        `${friend ? `${friend} has already completed today's plan. ` : ""}You are at ${pct}%. ${cost} Next 45 minutes: 20 QA questions.`,
      ], key);
    case "ignored":
      return `No progress has been logged since the last reminder.${strict ? ` Your stated goal is ${s.profile.targetPercentile}; today's gap works against it.` : ""} Commit 25 minutes now: 10 QA questions.`;
    case "last-call":
      return `Today stands at ${pct}%. Remaining: ${rem.text}. Complete at least one DILR set before you stop, or ${minutesToH(rem.minutes)} moves to your backlog.`;
    case "night":
      return nightSummary(s);
    case "mock-eve":
      return `${s.tomorrowPlan?.mockName ?? "Mock"} is tomorrow. Sleep by 11 PM, take it at your CAT slot, and reserve two hours afterwards for analysis.`;
  }
}

export function nightSummary(s: UserState) {
  const pct = Math.round((s.stats.today.ratio || 0) * 100);
  const tail = s.tomorrowPlan
    ? s.tomorrowPlan.type === "mock"
      ? ` Tomorrow: ${s.tomorrowPlan.mockName ?? "mock"}. Sleep on time.`
      : ` Tomorrow: ${s.tomorrowPlan.targets.qa} QA · ${s.tomorrowPlan.targets.rc} RC · ${s.tomorrowPlan.targets.va} VA · ${s.tomorrowPlan.targets.dilr} DILR.`
    : "";
  const verdict = pct >= 100 ? "Day closed. Solid." : pct >= 70 ? "Most of it done." : "Short day.";
  const debt = s.stats.debtMinutes + Math.max(0, s.stats.today.planned - s.stats.today.done);
  return `${verdict} ${pct}% of today. Backlog now ${minutesToH(debt)}. ${daysToExam(s.today) - 1} days left.${tail}`;
}

/** What the dashboard coach card should talk about right now, and its AI cache key. */
export function dashboardSlot(s: UserState, ctx: CoachContext): { sit: Situation; kind: string } {
  const morning = classifyMorning(s);
  let sit: Situation;
  if (s.hour < s.profile.studyStartHour + 2 || (morning === "morning-comeback" && s.hour < 12 && s.stats.today.done === 0)) sit = morning;
  else if (s.hour >= s.profile.studyEndHour) sit = "night";
  else if (!s.stats.today.planned) sit = morning;
  else sit = classifyCheckpoint(s, { ...ctx, sentToday: [] }, s.hour) ?? "evening-on-track";
  // Morning text shares the cache with the morning notification; later ones are cached per 3-hour block.
  return { sit, kind: sit.startsWith("morning") ? "brief" : `dash-${sit}-${Math.floor(s.hour / 3)}` };
}

// Back-compat helpers
export const briefPrompt = (s: UserState, ctx?: CoachContext) => prompt(s, classifyMorning(s), ctx);
export const fallbackBrief = (s: UserState, ctx?: CoachContext) => fallback(s, classifyMorning(s), ctx);
