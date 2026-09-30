-- Daily per-user activity (requests + first/last seen) for the admin analytics page. Constraint names match drizzle-kit's.
CREATE TABLE IF NOT EXISTS "user_activity" (
  "userId" text NOT NULL,
  "date" date NOT NULL,
  "hits" integer NOT NULL DEFAULT 1,
  "firstAt" timestamp NOT NULL DEFAULT now(),
  "lastAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "user_activity_userId_date_pk" PRIMARY KEY ("userId", "date"),
  CONSTRAINT "user_activity_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_activity_date" ON "user_activity" ("date");
