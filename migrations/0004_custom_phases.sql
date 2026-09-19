-- Custom templates can define their own phases; each planned day remembers which phase it belongs to.
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "phases" jsonb;
--> statement-breakpoint
ALTER TABLE "day_plan" ADD COLUMN IF NOT EXISTS "phase" text;
