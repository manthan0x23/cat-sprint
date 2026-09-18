import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { dayPlans, templates, weeklyGoals } from "@/db/schema";
import { requireProfile } from "@/lib/data";
import { istNow, weekStartOf } from "@/lib/cat";
import { SYSTEM_TEMPLATES } from "@/lib/templates";
import { PlannerView } from "./planner-view";

export default async function PlannerPage() {
  const { user, profile } = await requireProfile();
  const today = istNow().date;
  const [plans, custom, goal] = await Promise.all([
    db.select().from(dayPlans).where(eq(dayPlans.userId, user.id)).orderBy(asc(dayPlans.date)),
    db.select().from(templates).where(eq(templates.ownerId, user.id)),
    db.query.weeklyGoals.findFirst({ where: and(eq(weeklyGoals.userId, user.id), eq(weeklyGoals.weekStart, weekStartOf(today))) }),
  ]);
  return (
    <PlannerView
      today={today}
      weekGoal={goal ? { targets: goal.targets, mocks: goal.mocks } : null}
      plans={plans.map(({ date, type, targets, mockName, note, tag, mockDone, analysisDone }) => ({ date, type, targets, mockName, note, tag, mockDone, analysisDone }))}
      templates={[...SYSTEM_TEMPLATES.map((t) => ({ ...t, custom: false })), ...custom.map((t) => ({ ...t, custom: true }))]}
      currentTemplate={profile.templateId}
    />
  );
}
