-- Per-user daily AI allowance (shared free-tier quota). Constraint names match drizzle-kit's.
CREATE TABLE IF NOT EXISTS "ai_user_usage" (
  "userId" text NOT NULL,
  "date" date NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "ai_user_usage_userId_date_pk" PRIMARY KEY ("userId", "date"),
  CONSTRAINT "ai_user_usage_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
