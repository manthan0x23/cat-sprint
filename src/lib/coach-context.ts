import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notificationsSent } from "@/db/schema";
import { addDays } from "./cat";
import type { CoachContext } from "./coach";
import type { UserState } from "./data";
import { basicProfiles, friendIds, sharedStats } from "./social";

export async function loadCoachContext(s: UserState): Promise<CoachContext> {
  const userId = s.profile.userId;
  const [rows, fids] = await Promise.all([
    db.select({ date: notificationsSent.date, kind: notificationsSent.kind, meta: notificationsSent.meta })
      .from(notificationsSent)
      .where(and(eq(notificationsSent.userId, userId), inArray(notificationsSent.date, [s.today, addDays(s.today, -1)]))),
    friendIds(userId),
  ]);
  const [people, stats] = await Promise.all([
    basicProfiles(fids),
    Promise.all(fids.map(async (id) => [id, await sharedStats(id)] as const)),
  ]);
  const friendsDoneToday = stats
    .filter(([, st]) => st && (st.todayPct ?? 0) >= 1)
    .map(([id]) => (people.get(id)?.name ?? "A friend").split(" ")[0]);
  return {
    sentToday: rows.filter((r) => r.date === s.today),
    sentYesterday: rows.filter((r) => r.date !== s.today),
    friendsDoneToday,
    friendsCount: fids.length,
  };
}
