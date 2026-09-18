import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiCache, aiUsage } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { istNow } from "./cat";

// Free OpenRouter accounts get ~50 requests/day across ALL users of the key,
// so every call goes through a global daily budget and results are cached per user/day/kind.

const MODEL = process.env.OPENROUTER_MODEL || "qwen/qwen3.8-27b:free";
// OpenRouter tries these in order if the primary is down or rate-limited (same free quota).
const FALLBACKS = (process.env.OPENROUTER_FALLBACKS || "google/gemma-4-31b-it:free,deepseek/deepseek-v4-flash-0731:free")
  .split(",").map((m) => m.trim()).filter(Boolean);
const BUDGET = Number(process.env.AI_DAILY_BUDGET || 45);

const SYSTEM = `You are "Sprint", a sharp, warm CAT (IIM entrance exam) coach inside a planner app.
Rules: be concrete and numeric, reference the user's own numbers and goal. Max 3 short sentences unless asked.
No emojis except at most one. No generic motivation clichés. Never invent numbers not given to you.
Indian context: CAT 2026 is on 29 Nov 2026. Sections: VARC (RC+VA), DILR, QA.`;

async function takeBudget(): Promise<boolean> {
  const { date } = istNow();
  const rows = await db
    .insert(aiUsage)
    .values({ date, count: 1 })
    .onConflictDoUpdate({ target: aiUsage.date, set: { count: sql`${aiUsage.count} + 1` } })
    .returning({ count: aiUsage.count });
  return (rows[0]?.count ?? 0) <= BUDGET;
}

function clean(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^["\s]+|["\s]+$/g, "").trim();
}

export async function askAI(prompt: string, maxTokens = 220): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;
  if (!(await takeBudget())) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "CAT Sprint",
      },
      body: JSON.stringify({
        models: [MODEL, ...FALLBACKS.filter((m) => m !== MODEL)].slice(0, 3),
        // Short notification copy: thinking only adds latency and can eat the token budget.
        reasoning: { enabled: false },
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.error("[ai] OpenRouter", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = await res.json();
    const text = clean(json?.choices?.[0]?.message?.content ?? "");
    return text || null;
  } catch (e) {
    console.error("[ai] failed", e);
    return null;
  }
}

/** Cached per (user, IST date, kind). Falls back to `fallback` when AI is unavailable (not cached, so it retries later). */
export async function cachedAI(userId: string, kind: string, prompt: string, fallback: string, opts: { force?: boolean } = {}) {
  const { date } = istNow();
  if (!opts.force) {
    const hit = await db.query.aiCache.findFirst({
      where: and(eq(aiCache.userId, userId), eq(aiCache.date, date), eq(aiCache.kind, kind)),
    });
    if (hit) return { text: hit.text, ai: true };
  }
  const text = await askAI(prompt);
  if (!text) return { text: fallback, ai: false };
  await db
    .insert(aiCache)
    .values({ userId, date, kind, text })
    .onConflictDoUpdate({ target: [aiCache.userId, aiCache.date, aiCache.kind], set: { text, createdAt: new Date() } });
  return { text, ai: true };
}
