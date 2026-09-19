// The one-time "what's new" pop-up. Bump `id` when announcing something new; each user sees
// it once (profile.seenUpdate). New sign-ups get the current id at onboarding, so they skip it.
export const WHATS_NEW = {
  id: "2026-09-custom-plan-sectionals",
  title: "New: your own plan + sectionals",
  items: [
    { icon: "plan", title: "Build your own plan", body: "Split the weeks to CAT into your own phases and set every weekday: practice, mock or rest.", href: "/planner", cta: "Open planner" },
    { icon: "sectional", title: "Sectionals", body: "Plan VARC, DILR or QA sectionals on any day in the Planner, then log scores on the Mocks page to see each section's trend.", href: "/mocks", cta: "Go to mocks" },
  ],
} as const;
