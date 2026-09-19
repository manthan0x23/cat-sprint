-- Sectional test scores, sectionals planned per day, plus which "what's new" pop-up each user has already dismissed.
CREATE TABLE IF NOT EXISTS "sectional_result" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "section" text NOT NULL,
  "name" text NOT NULL,
  "score" real NOT NULL,
  "note" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sectional_user_date" ON "sectional_result" ("userId", "date");
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "seenUpdate" text;
--> statement-breakpoint
ALTER TABLE "day_plan" ADD COLUMN IF NOT EXISTS "sectionals" jsonb;
