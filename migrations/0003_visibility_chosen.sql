-- Existing users never explicitly picked friends/public; they get a one-time prompt (false = not chosen yet).
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "visibilityChosen" boolean NOT NULL DEFAULT false;
