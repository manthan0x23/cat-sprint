import { describe, expect, it } from "vitest";
import { generatePlan } from "../plan-generator";
import { SYSTEM_TEMPLATES } from "../templates";
import { computeStats, projectPercentile, skipImpact, plannedMinutes, expectedFraction } from "../progress";
import { istNow, daysToExam, weekday } from "../cat";

const manthan = SYSTEM_TEMPLATES[0];

describe("dates", () => {
  it("IST conversion rolls over at 18:30 UTC", () => {
    expect(istNow(new Date("2026-09-18T18:29:00Z")).date).toBe("2026-09-18");
    expect(istNow(new Date("2026-09-18T18:31:00Z")).date).toBe("2026-09-19");
    expect(istNow(new Date("2026-09-18T09:30:00Z")).hour).toBe(15);
  });
  it("72 days from 18 Sep to CAT", () => expect(daysToExam("2026-09-18")).toBe(72));
  it("CAT day is a Sunday", () => expect(weekday("2026-11-29")).toBe(0));
});

describe("generatePlan", () => {
  const plan = generatePlan({ start: "2026-09-18", template: manthan });
  const mocks = plan.filter((d) => d.type === "mock");
  it("covers every day through exam day", () => {
    expect(plan[0].date).toBe("2026-09-18");
    expect(plan.at(-1)!.date).toBe("2026-11-29");
    expect(plan).toHaveLength(73);
    expect(plan.at(-1)!.tag).toBe("CAT");
    expect(plan.at(-2)!.type).toBe("rest");
  });
  it("never schedules mocks on consecutive days", () => {
    for (let i = 1; i < mocks.length; i++) {
      const gap = (Date.parse(mocks[i].date) - Date.parse(mocks[i - 1].date)) / 86400000;
      expect(gap).toBeGreaterThanOrEqual(2);
    }
  });
  it("ramps frequency: fewer mocks early, more in the final 3 weeks", () => {
    const early = mocks.filter((d) => d.date < "2026-10-18").length; // first ~4 weeks
    const peak = mocks.filter((d) => d.date >= "2026-11-08").length; // last 3 weeks
    expect(early).toBeLessThanOrEqual(9);
    expect(peak).toBeGreaterThanOrEqual(7);
  });
  it("last mock is Sunday 22 Nov, none in the taper", () => {
    expect(mocks.at(-1)!.date).toBe("2026-11-22");
    expect(weekday(mocks.at(-1)!.date)).toBe(0);
  });
  it("day after a mock is a review day, day before a Sunday mock is light", () => {
    const i = plan.findIndex((d) => d.date === "2026-09-27");
    expect(plan[i].type).toBe("mock");
    expect(plan[i + 1].tag).toBe("Review");
    expect(plan[i - 1].tag).toBe("Light");
  });
  it("practice days rotate focus instead of repeating", () => {
    const tags = new Set(plan.filter((d) => d.type === "practice").map((d) => d.tag));
    expect(tags).toEqual(expect.objectContaining({}));
    expect(["Balanced", "QA focus", "VARC focus", "DILR focus"].every((t) => tags.has(t))).toBe(true);
  });
  it("weakness template doubles weak sections", () => {
    const w = generatePlan({ start: "2026-09-18", template: SYSTEM_TEMPLATES[3], weak: ["dilr"] });
    expect(w.find((d) => d.tag === "Balanced")!.targets).toEqual({ qa: 28, rc: 6, va: 8, dilr: 8 });
  });
});

describe("computeStats", () => {
  const t = { qa: 50, rc: 10, va: 15, dilr: 5 }; // 100 + 25 + 22.5 + 60 = 207.5 min
  const plans = [
    { date: "2026-09-16", type: "practice" as const, targets: t },
    { date: "2026-09-17", type: "practice" as const, targets: t },
    { date: "2026-09-18", type: "practice" as const, targets: t },
    { date: "2026-09-19", type: "practice" as const, targets: t },
  ];
  it("planned minutes", () => expect(plannedMinutes(plans[0])).toBe(207.5));
  it("debt from a skipped day spreads over remaining days", () => {
    const s = computeStats({
      plans,
      doneByDate: { "2026-09-16": t },
      today: "2026-09-18",
      hour: 15,
      window: { start: 7, end: 23 },
      exam: "2026-09-20",
    });
    expect(s.debtMinutes).toBe(207.5);
    expect(s.remainingDays).toBe(2);
    expect(s.extraPerDay).toBeCloseTo(103.75);
    expect(s.consistency).toBeCloseTo(0.5);
    expect(s.todayStatus).toBe("way-behind"); // 3pm, nothing logged
    expect(s.streak).toBe(0);
  });
  it("expected fraction at 3pm in 7–23 window is 50%", () => expect(expectedFraction(15, 7, 23)).toBe(0.5));
});

describe("projection", () => {
  const mocks = [
    { date: "2026-09-06", percentile: 80 },
    { date: "2026-09-13", percentile: 83.5 },
  ];
  it("needs 2 mocks", () => expect(projectPercentile(mocks.slice(0, 1), "2026-09-18", 1)).toBeNull());
  it("consistency scales the improvement rate", () => {
    const full = projectPercentile(mocks, "2026-09-18", 1)!;
    const half = projectPercentile(mocks, "2026-09-18", 0.5)!;
    expect(full.rate).toBe(-0.015); // capped
    expect(full.projected).toBeGreaterThan(half.projected);
    expect(full.projected).toBeGreaterThan(90);
    expect(full.projected).toBeLessThan(97);
  });
  it("skipping today lowers projection", () => {
    const t = { qa: 50, rc: 10, va: 15, dilr: 5 };
    const plans = ["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"].map((date) => ({ date, type: "practice" as const, targets: t }));
    const s = computeStats({
      plans, doneByDate: { "2026-09-15": t, "2026-09-16": t, "2026-09-17": t },
      today: "2026-09-18", hour: 15, window: { start: 7, end: 23 }, exam: "2026-11-29",
    });
    const imp = skipImpact(s, [{ date: "2026-09-01", percentile: 70 }, { date: "2026-09-15", percentile: 75 }], "2026-09-18");
    expect(imp.percentileIfSkip!).toBeLessThan(imp.percentileIfDone!);
  });
});

describe("coach classification", async () => {
  const { classifyCheckpoint, classifyMorning, checkpointsFor, remaining } = await import("../coach");
  const t = { qa: 50, rc: 10, va: 15, dilr: 5 };
  const mk = (doneFrac: number, hour: number, yesterdayRatio: number | null = 1) => {
    const plans = [
      { date: "2026-09-17", type: "practice" as const, targets: t },
      { date: "2026-09-18", type: "practice" as const, targets: t },
    ];
    const f = (x: number) => ({ qa: Math.round(50 * x), rc: Math.round(10 * x), va: Math.round(15 * x), dilr: Math.round(5 * x) });
    const doneByDate = { "2026-09-18": f(doneFrac), ...(yesterdayRatio != null ? { "2026-09-17": f(yesterdayRatio) } : {}) };
    const stats = computeStats({ plans, doneByDate, today: "2026-09-18", hour, window: { start: 7, end: 23 }, exam: "2026-11-29" });
    return {
      today: "2026-09-18", hour, stats, projection: null, mocks: [], firstName: "M",
      impact: skipImpact(stats, [], "2026-09-18"),
      todayPlan: { ...plans[1], mockName: null, mockDone: false, analysisDone: false, note: null },
      tomorrowPlan: null, nextMock: null, plans, todayDone: doneByDate["2026-09-18"],
      profile: { studyStartHour: 7, studyEndHour: 23, targetPercentile: 99, dreamColleges: [], why: "", weakSections: [], coachIntensity: "firm" },
    } as never;
  };
  const ctx = { sentToday: [], sentYesterday: [], friendsDoneToday: [], friendsCount: 0 };

  it("3 PM and 8 PM are always check-ins in a 7–23 window", () => {
    expect(checkpointsFor(7, 23)).toEqual([12, 15, 18, 20, 22]);
    expect(checkpointsFor(18, 23)).toEqual([20, 22]);
  });
  it("nothing done at 3 PM → way-behind", () => expect(classifyCheckpoint(mk(0, 15), ctx, 15)).toBe("way-behind"));
  it("80% done → push to finish", () => expect(classifyCheckpoint(mk(0.8, 15), ctx, 15)).toBe("almost"));
  it("done → applause once", () => {
    expect(classifyCheckpoint(mk(1, 15), ctx, 15)).toBe("applause");
    expect(classifyCheckpoint(mk(1, 20), { ...ctx, sentToday: [{ kind: "applause", meta: null }] }, 20)).toBeNull();
  });
  it("on pace at 3 PM stays quiet", () => expect(classifyCheckpoint(mk(0.55, 15), ctx, 15)).toBeNull());
  it("ignored warning escalates", () => {
    const s = mk(0.1, 20) as { stats: { today: { done: number } } };
    const sent = [{ kind: "cp-15", meta: { doneMinutes: s.stats.today.done, ratio: 0.1, situation: "way-behind" } }];
    expect(classifyCheckpoint(s as never, { ...ctx, sentToday: sent }, 20)).toBe("ignored");
  });
  it("bad yesterday → comeback morning", () => expect(classifyMorning(mk(0, 8, 0.2))).toBe("morning-comeback"));
  it("remaining lists what's left", () => expect(remaining(mk(0.8, 15)).text).toBe("10 QA, 2 RC, 3 VA, 1 DILR set"));
});
