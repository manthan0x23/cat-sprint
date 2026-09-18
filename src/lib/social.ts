import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { friendships, profiles, users } from "@/db/schema";
import { loadUserState } from "./data";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const RESERVED = new Set(["admin", "api", "me", "settings", "friends", "dashboard", "planner", "mocks", "cat", "sprint", "support"]);

export function normalizeUsername(u: string) {
  return u.trim().toLowerCase().replace(/^@/, "");
}

export async function relation(viewerId: string, otherId: string) {
  if (viewerId === otherId) return { kind: "self" as const };
  const row = await db.query.friendships.findFirst({
    where: or(
      and(eq(friendships.requesterId, viewerId), eq(friendships.addresseeId, otherId)),
      and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, viewerId)),
    ),
  });
  if (!row) return { kind: "none" as const };
  if (row.status === "accepted") return { kind: "friends" as const, id: row.id };
  return row.requesterId === viewerId ? { kind: "outgoing" as const, id: row.id } : { kind: "incoming" as const, id: row.id };
}

export async function friendIds(userId: string) {
  const rows = await db.select().from(friendships).where(
    and(eq(friendships.status, "accepted"), or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))),
  );
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export async function pendingRequests(userId: string) {
  const rows = await db.select().from(friendships).where(
    and(eq(friendships.status, "pending"), or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))),
  );
  const ids = rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  const people = await basicProfiles(ids);
  return {
    incoming: rows.filter((r) => r.addresseeId === userId).map((r) => ({ id: r.id, person: people.get(r.requesterId)! })).filter((x) => x.person),
    outgoing: rows.filter((r) => r.requesterId === userId).map((r) => ({ id: r.id, person: people.get(r.addresseeId)! })).filter((x) => x.person),
  };
}

export async function basicProfiles(ids: string[]) {
  if (!ids.length) return new Map<string, BasicProfile>();
  const rows = await db
    .select({ id: users.id, name: users.name, image: users.image, username: profiles.username, target: profiles.targetPercentile })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}
export type BasicProfile = { id: string; name: string | null; image: string | null; username: string | null; target: number };

/** Stats a friend (or anyone, if public) may see. Never includes the "why" or notification settings. */
export async function sharedStats(userId: string) {
  const s = await loadUserState(userId);
  if (!s) return null;
  return {
    todayPct: s.stats.today.planned ? Math.min(1.5, s.stats.today.done / s.stats.today.planned) : null,
    todayMinutes: s.stats.today.done,
    todayType: s.todayPlan?.type ?? "rest",
    streak: s.stats.streak,
    consistency: s.stats.consistency,
    history: s.stats.history.slice(-28),
    today: s.today,
    mocks: s.profile.showMocks ? s.mocks.map((m) => ({ date: m.date, name: m.name, percentile: m.percentile })) : null,
    projected: s.profile.showMocks ? s.projection?.projected ?? null : null,
    target: s.profile.targetPercentile,
    dreamColleges: s.profile.dreamColleges,
  };
}
export type SharedStats = NonNullable<Awaited<ReturnType<typeof sharedStats>>>;
