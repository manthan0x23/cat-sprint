import type { UserState } from "./data";
import { addDays, daysToExam, fmtHour, SECTIONS, SECTION_META } from "./cat";
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
    .map((x) => `${x.n} ${SECTION_META[x.k].short}${x.k === "dilr" ? (x.n > 1 ? " sets" : " set") : ""}`);
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
  "morning-comeback": () => "About yesterday…",
  "morning-streak": (s) => `🔥 ${s.stats.streak}-day streak`,
  applause: () => "Day closed 👏",
  almost: () => "So close. Finish it",
  "evening-on-track": () => "Evening check-in",
  behind: (s) => `${fmtHour(s.hour)} check-in`,
  "way-behind": (s) => `${fmtHour(s.hour)}: you're falling behind`,
  ignored: () => "Still nothing?",
  "last-call": () => "Last call for today",
  night: () => "Day summary",
  "mock-eve": () => "Mock tomorrow",
};

// ---------- Facts for the model ----------
export function facts(s: UserState, ctx?: CoachContext) {
  const t = s.todayPlan;
  const y = yesterdayRow(s);
  const rem = remaining(s);
  const lines = [
    `Name: ${s.firstName}. Days to CAT (29 Nov 2026): ${daysToExam(s.today)}. Target: ${s.profile.targetPercentile} %ile.`,
    s.profile.dreamColleges.length ? `Dream colleges: ${s.profile.dreamColleges.join(", ")}.` : "",
    s.profile.why ? `Their own "why", in their words: "${s.profile.why}"` : "",
    s.profile.weakSections.length ? `Weak sections: ${s.profile.weakSections.map((w) => SECTION_META[w as keyof typeof SECTION_META]?.short ?? w).join(", ")}.` : "",
    t ? `Today: ${t.type} day${t.mockName ? ` (${t.mockName})` : ""}. Targets: ${SECTIONS.map((k) => `${SECTION_META[k].short} ${t.targets[k]}`).join(", ")}.` : "No plan today.",
    `Done today: ${SECTIONS.map((k) => `${SECTION_META[k].short} ${s.todayDone[k]}`).join(", ")} = ${Math.round((s.stats.today.ratio || 0) * 100)}% of today's work.`,
    rem.text ? `Still left today: ${rem.text} (~${minutesToH(rem.minutes)}).` : "Nothing left today.",
    `Time now: ${fmtHour(s.hour)} IST. Study window ends ${fmtHour(s.profile.studyEndHour)} (${Math.max(0, s.profile.studyEndHour - s.hour).toFixed(1)}h left).`,
    y ? `Yesterday: ${Math.round(y.ratio * 100)}% done.` : "",
    ctx ? `Nudges ignored yesterday: ${ignoredYesterday(s, ctx)}.` : "",
    `14-day consistency ${Math.round(s.stats.consistency * 100)}%. Streak ${s.stats.streak} days. Backlog ${minutesToH(s.stats.debtMinutes)} (= +${Math.round(s.stats.extraPerDay)} min/day until CAT).`,
    s.projection
      ? `Projected CAT %ile at current consistency: ${s.projection.projected.toFixed(1)}. Finishing today → ${s.impact.percentileIfDone?.toFixed(1)}; skipping → ${s.impact.percentileIfSkip?.toFixed(1)}.`
      : `No percentile projection yet (fewer than 2 mocks).`,
    s.mocks.length ? `Last mock: ${s.mocks.at(-1)!.name}, ${s.mocks.at(-1)!.percentile} %ile.` : "",
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
  gentle: "Tone: warm, supportive coach. Encourage, never shame.",
  firm: "Tone: direct, no-nonsense coach. Honest about the cost, zero fluff.",
  savage: "Tone: savage friend who roasts you because they want you in an IIM. Witty taunts about the behaviour (never about identity, intelligence or family). Sharp, a bit cheeky, still ends with a concrete action.",
};
const LANGUAGE: Record<string, string> = {
  english: "Language: English.",
  hinglish: "Language: Hinglish (Hindi + English mixed, written in Latin script, the way Indian college friends text, e.g. 'bhai', 'chal', 'abhi').",
};

export function prompt(s: UserState, sit: Situation, ctx?: CoachContext) {
  const tone = s.profile.coachIntensity;
  // applause/streak should never be savage-negative
  const effectiveTone = (sit === "applause" || sit === "morning-streak") && tone === "savage" ? "firm" : tone;
  return `${facts(s, ctx)}

SITUATION: ${SITUATION_BRIEF[sit]}
${INTENSITY[effectiveTone]}
${LANGUAGE[s.profile.coachLanguage]}
Format: a phone notification. Max 2 sentences, under 260 characters. Use at least one concrete number from the facts. No hashtags, no quotes around the message, no greeting like "Hey".`;
}

// ---------- Rule-based fallbacks (used when AI is unavailable) ----------
function pick<T>(arr: T[], key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return arr[Math.abs(h) % arr.length];
}

export function fallback(s: UserState, sit: Situation, ctx?: CoachContext): string {
  const hi = s.profile.coachLanguage === "hinglish";
  const savage = s.profile.coachIntensity === "savage";
  const rem = remaining(s);
  const pct = Math.round((s.stats.today.ratio || 0) * 100);
  const left = daysToExam(s.today);
  const y = yesterdayRow(s);
  const ign = ctx ? ignoredYesterday(s, ctx) : 0;
  const cost = s.impact.percentileIfSkip != null && s.impact.percentileIfDone != null
    ? hi ? `Skip kiya toh projection ${s.impact.percentileIfDone.toFixed(1)} → ${s.impact.percentileIfSkip.toFixed(1)}.` : `Skipping drops your projection ${s.impact.percentileIfDone.toFixed(1)} → ${s.impact.percentileIfSkip.toFixed(1)} %ile.`
    : hi ? `Skip kiya toh backlog +${minutesToH(rem.minutes)}.` : `Skipping adds ${minutesToH(rem.minutes)} to your backlog.`;
  const friend = ctx?.friendsDoneToday[0];
  const key = s.today + sit;

  switch (sit) {
    case "morning":
      return hi
        ? `${left} din bache. Aaj ka target: ${rem.text}. Pehla block ${fmtHour(s.profile.studyStartHour + 1)} se pehle khatam karo.`
        : `${left} days left. Today: ${rem.text}. Get the first block done before ${fmtHour(s.profile.studyStartHour + 1)}.`;
    case "morning-mock":
      return hi
        ? `${s.todayPlan?.mockName ?? "Mock"} aaj. Ek sitting mein do, phir utna hi time analysis ko do. Percentile wahi se hilta hai.`
        : `${s.todayPlan?.mockName ?? "Mock"} today. One sitting, real exam slot, then give the analysis as long as the mock. That's where the percentile moves.`;
    case "morning-comeback": {
      const ignLine = ign ? (hi ? ` ${ign} reminders ignore kiye.` : ` You ignored ${ign} reminder${ign > 1 ? "s" : ""}.`) : "";
      return hi
        ? `Kal sirf ${Math.round((y?.ratio ?? 0) * 100)}% hua.${ignLine} Backlog ab ${minutesToH(s.stats.debtMinutes)}. ${savage ? "IIM wale wait nahi karenge. " : ""}Aaj comeback: pehle 1 DILR set, abhi.`
        : `Yesterday: ${Math.round((y?.ratio ?? 0) * 100)}% done.${ignLine} Backlog is now ${minutesToH(s.stats.debtMinutes)}. ${savage ? "The IIM seat isn't going to wait for you. " : ""}Comeback starts with 1 DILR set, now.`;
    }
    case "morning-streak":
      return hi
        ? `${s.stats.streak} din ki streak 🔥 Aaj bhi wahi: ${rem.text}.`
        : `${s.stats.streak}-day streak. Keep the chain: ${rem.text} today.`;
    case "applause":
      return hi
        ? `Aaj ka plan khatam. ${minutesToH(s.stats.today.done)} ka kaam. Solid. Ab thoda rest, kal phir.`
        : `Full plan done: ${minutesToH(s.stats.today.done)} of work. That's how ${s.profile.targetPercentile} gets built. Rest well.`;
    case "almost":
      return hi
        ? `${pct}% ho gaya, bas ${rem.text} bacha (~${minutesToH(rem.minutes)}). Khatam karke hi uthna.`
        : `${pct}% done. Only ${rem.text} left (~${minutesToH(rem.minutes)}). Close it out.`;
    case "evening-on-track":
      return hi ? `Pace sahi hai. Raat tak: ${rem.text}.` : `On pace. Tonight's finish line: ${rem.text}.`;
    case "behind":
    case "way-behind":
      return pick(hi
        ? [`${fmtHour(s.hour)} ho gaye aur sirf ${pct}% hua. ${cost} Abhi 1 DILR set start karo.`,
           `${friend ? `${friend} aaj ka khatam kar chuka hai. ` : ""}Tum ${pct}% pe ho. ${cost} Abhi 20 QA.`]
        : [`It's ${fmtHour(s.hour)} and you're at ${pct}%. ${cost} Start 1 DILR set now.`,
           `${friend ? `${friend} has already finished today. ` : ""}You're at ${pct}%. ${cost} Next 45 min: 20 QA.`], key);
    case "ignored":
      return hi
        ? `Pichla reminder ignore hua, ek bhi question log nahi. ${savage ? "Netflix CAT nahi dilayega. " : ""}Sirf 25 min: 10 QA. Chalo.`
        : `Last reminder: ignored, nothing logged since. ${savage ? "Scrolling won't get you into an IIM. " : ""}Just 25 minutes: 10 QA. Go.`;
    case "last-call":
      return hi
        ? `Aaj ka ${pct}% hi hua. Bacha: ${rem.text}. Kam se kam 1 DILR set karke so jao, warna backlog +${minutesToH(rem.minutes)}.`
        : `Day's at ${pct}%. Left: ${rem.text}. Do at least 1 DILR set before bed, or ${minutesToH(rem.minutes)} rolls into backlog.`;
    case "night":
      return nightSummary(s);
    case "mock-eve":
      return hi
        ? `Kal ${s.tomorrowPlan?.mockName ?? "mock"} hai. 11 baje tak so jao, real slot pe do, baad mein 2 ghante analysis.`
        : `${s.tomorrowPlan?.mockName ?? "Mock"} tomorrow. Sleep by 11, take it at your real CAT slot, block 2 hours after for analysis.`;
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
