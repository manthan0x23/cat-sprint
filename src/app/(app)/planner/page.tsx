import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { dayPlans, templates } from "@/db/schema";
import { requireProfile } from "@/lib/data";
import { istNow } from "@/lib/cat";
import { SYSTEM_TEMPLATES } from "@/lib/templates";
import { PlannerView } from "./planner-view";

export default async function PlannerPage() {
  const { user, profile } = await requireProfile();
  const [plans, custom] = await Promise.all([
    db.select().from(dayPlans).where(eq(dayPlans.userId, user.id)).orderBy(asc(dayPlans.date)),
    db.select().from(templates).where(eq(templates.ownerId, user.id)),
  ]);
  return (
    <PlannerView
      today={istNow().date}
      plans={plans.map(({ date, type, targets, mockName, note, tag, mockDone, analysisDone }) => ({ date, type, targets, mockName, note, tag, mockDone, analysisDone }))}
      templates={[...SYSTEM_TEMPLATES.map((t) => ({ ...t, custom: false })), ...custom.map((t) => ({ ...t, custom: true }))]}
      currentTemplate={profile.templateId}
    />
  );
}
