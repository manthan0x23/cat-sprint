// Pure validation shared by the server actions and their forms. No db/auth imports, so the
// rules can be unit-tested: a field added here without a matching form input breaks a test
// instead of breaking Save in production.
import { z } from "zod";
import { SECTIONS, SECTION_META, WEEKLY_MAX } from "./cat";

/** What every settings form returns: either saved, or a message to show next to the button. */
export type FormResult = { ok: true } | { ok: false; error: string };

export const sectionSchema = z.enum(SECTIONS);

// Bounds come from SECTION_META/WEEKLY_MAX so the steppers in the UI clamp to exactly what
// these schemas accept. Change a limit there and both sides move together.
const countSchema = (max: number) => z.coerce.number().int().min(0).max(max);

export const targetsSchema = z.object({
  qa: countSchema(SECTION_META.qa.max),
  rc: countSchema(SECTION_META.rc.max),
  va: countSchema(SECTION_META.va.max),
  dilr: countSchema(SECTION_META.dilr.max),
});

/** A whole week's goal, not one day's targets. */
export const weeklyTargetsSchema = z.object({
  qa: countSchema(WEEKLY_MAX.qa),
  rc: countSchema(WEEKLY_MAX.rc),
  va: countSchema(WEEKLY_MAX.va),
  dilr: countSchema(WEEKLY_MAX.dilr),
});

// The goal fields, exactly as the Settings "Goal" form posts them. Onboarding asks for these
// plus a username, a template and a visibility choice; keeping them apart means a field added
// to onboarding can never make saving the goal fail.
export const goalSchema = z.object({
  targetPercentile: z.coerce.number().min(50).max(100),
  dreamColleges: z.string().max(300),
  why: z.string().max(1000),
  weakSections: z.array(sectionSchema),
  studyStartHour: z.coerce.number().int().min(0).max(23),
  studyEndHour: z.coerce.number().int().min(1).max(24),
});

export const onboardSchema = goalSchema.extend({
  username: z.string(),
  templateId: z.string().min(1),
  visibility: z.enum(["friends", "public"]),
});

/** Reads the Goal form's fields out of a submission. Used by both goal save and onboarding. */
export function goalFields(formData: FormData) {
  return {
    targetPercentile: formData.get("targetPercentile"),
    dreamColleges: formData.get("dreamColleges") ?? "",
    why: formData.get("why") ?? "",
    weakSections: formData.getAll("weakSections"),
    studyStartHour: formData.get("studyStartHour"),
    studyEndHour: formData.get("studyEndHour"),
  };
}
