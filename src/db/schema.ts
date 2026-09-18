import {
  pgTable, text, timestamp, integer, primaryKey, boolean, jsonb, date, serial, real, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------- Auth.js tables ----------
export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (a) => [primaryKey({ columns: [a.provider, a.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (v) => [primaryKey({ columns: [v.identifier, v.token] })],
);

// ---------- App tables ----------
export type Targets = { qa: number; rc: number; va: number; dilr: number };

export const profiles = pgTable("profile", {
  userId: text("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  username: text("username").unique(), // lowercase [a-z0-9_]{3,20}
  visibility: text("visibility").$type<"friends" | "public">().notNull().default("friends"),
  showMocks: boolean("showMocks").notNull().default(true),
  coachIntensity: text("coachIntensity").$type<"gentle" | "firm" | "strict">().notNull().default("firm"),
  targetPercentile: real("targetPercentile").notNull().default(99),
  dreamColleges: jsonb("dreamColleges").$type<string[]>().notNull().default([]),
  why: text("why").notNull().default(""),
  weakSections: jsonb("weakSections").$type<string[]>().notNull().default([]),
  studyStartHour: integer("studyStartHour").notNull().default(7),
  studyEndHour: integer("studyEndHour").notNull().default(23),
  templateId: text("templateId"),
  notifyPush: boolean("notifyPush").notNull().default(true),
  notifyWhatsapp: boolean("notifyWhatsapp").notNull().default(false),
  notifyEmail: boolean("notifyEmail").notNull().default(true),
  callmebotPhone: text("callmebotPhone"),
  callmebotKey: text("callmebotKey"),
  pushSubscriptions: jsonb("pushSubscriptions").$type<PushSub[]>().notNull().default([]),
  onboarded: boolean("onboarded").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

export const templates = pgTable("template", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("ownerId").references(() => users.id, { onDelete: "cascade" }), // null = system
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  practice: jsonb("practice").$type<Targets>().notNull(),
  mock: jsonb("mock").$type<Targets>().notNull(),
  mocksPerWeek: integer("mocksPerWeek").notNull().default(2),
  finalStretchMocksPerWeek: integer("finalStretchMocksPerWeek").notNull().default(3),
});

export const dayPlans = pgTable(
  "day_plan",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    type: text("type").$type<"practice" | "mock" | "rest">().notNull(),
    targets: jsonb("targets").$type<Targets>().notNull(),
    mockName: text("mockName"),
    mockDone: boolean("mockDone").notNull().default(false),
    analysisDone: boolean("analysisDone").notNull().default(false),
    note: text("note"),
    tag: text("tag"),
  },
  (t) => [uniqueIndex("day_plan_user_date").on(t.userId, t.date)],
);

export const progressLogs = pgTable(
  "progress_log",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    section: text("section").$type<keyof Targets>().notNull(),
    count: integer("count").notNull(),
    correct: integer("correct"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [index("progress_user_date").on(t.userId, t.date)],
);

export const mockResults = pgTable("mock_result", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  name: text("name").notNull(),
  score: real("score"),
  percentile: real("percentile").notNull(),
  varc: real("varc"),
  dilr: real("dilr"),
  qa: real("qa"),
  learnings: text("learnings"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const aiCache = pgTable(
  "ai_cache",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ai_cache_key").on(t.userId, t.date, t.kind)],
);

export const aiUsage = pgTable("ai_usage", {
  date: date("date", { mode: "string" }).primaryKey(),
  count: integer("count").notNull().default(0),
});

export const notificationsSent = pgTable(
  "notification_sent",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    // snapshot when sent, so later checks can tell if the user ignored it
    meta: jsonb("meta").$type<{ doneMinutes: number; ratio: number; situation: string }>(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notif_key").on(t.userId, t.date, t.kind)],
);

// One row per pair. requester -> addressee; accepted = friends both ways.
export const friendships = pgTable(
  "friendship",
  {
    id: serial("id").primaryKey(),
    requesterId: text("requesterId").notNull().references(() => users.id, { onDelete: "cascade" }),
    addresseeId: text("addresseeId").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<"pending" | "accepted">().notNull().default("pending"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("friendship_pair").on(t.requesterId, t.addresseeId),
    index("friendship_addressee").on(t.addresseeId),
  ],
);
