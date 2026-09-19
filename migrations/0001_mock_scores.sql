-- Mocks track raw scores only; percentile is gone. Per-section notes (qa/dilr/va/rc).
ALTER TABLE "mock_result" ADD COLUMN IF NOT EXISTS "sectionNotes" jsonb;
--> statement-breakpoint
ALTER TABLE "mock_result" DROP COLUMN IF EXISTS "percentile";
