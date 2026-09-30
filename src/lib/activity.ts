import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { userActivity } from "@/db/schema";
import { istNow } from "./cat";

/**
 * Counts one request for this user today (IST). Runs after the response so it never slows a page,
 * and at most once per request (layout + page both call requireUser). Failures are swallowed:
 * analytics must never break the app.
 */
export const recordVisit = cache((userId: string) => {
  after(async () => {
    const { date } = istNow();
    try {
      await db
        .insert(userActivity)
        .values({ userId, date })
        .onConflictDoUpdate({
          target: [userActivity.userId, userActivity.date],
          set: { hits: sql`${userActivity.hits} + 1`, lastAt: sql`now()` },
        });
    } catch (e) {
      console.error("recordVisit failed", e);
    }
  });
});
