import { describe, expect, it } from "vitest";
import { generatePhased, generatePlan, presetPhases } from "../plan-generator";
import { SYSTEM_TEMPLATES } from "../templates";
import { computeStats, projectScore, skipImpact, plannedMinutes, expectedFraction } from "../progress";
import { istNow, daysToExam, weekday, unitMinutes } from "../cat";

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
    expect(w.find((d) => d.tag === "Balanced")!.targets).toEqual({ qa: 25, rc: 3, va: 7, dilr: 6 });
  });
});

describe("computeStats", () => {
  const t = { qa: 50, rc: 10, va: 15, dilr: 5 };
  const plans = [
    { date: "2026-09-16", type: "practice" as const, targets: t },
    { date: "2026-09-17", type: "practice" as const, targets: t },
    { date: "2026-09-18", type: "practice" as const, targets: t },
    { date: "2026-09-19", type: "practice" as const, targets: t },
  ];
  it("realistic hours: the 50/10/15/5 plan is ~9h in September", () => {
    const h = plannedMinutes(plans[0]) / 60;
    expect(h).toBeGreaterThan(8.5);
    expect(h).toBeLessThan(9.5);
  });
  it("speed improves toward CAT (practice overhead 1.6× → 1.25×)", () => {
    expect(unitMinutes("dilr", "2026-08-31")).toBeCloseTo(16 * 1.6); // ≥90 days out
    expect(unitMinutes("dilr", "2026-11-29")).toBeCloseTo(16 * 1.25);
    expect(unitMinutes("qa", "2026-11-01")).toBeLessThan(unitMinutes("qa", "2026-09-18"));
  });
  it("debt from a skipped day spreads over remaining days", () => {
    const s = computeStats({
      plans,
      doneByDate: { "2026-09-16": t },
      today: "2026-09-18",
      hour: 15,
      window: { start: 7, end: 23 },
      exam: "2026-09-20",
    });
    const day17 = plannedMinutes(plans[1]);
    expect(s.debtMinutes).toBeCloseTo(day17);
    expect(s.remainingDays).toBe(2);
    expect(s.extraPerDay).toBeCloseTo(day17 / 2);
    expect(s.consistency).toBeCloseTo(0.5, 1);
    expect(s.todayStatus).toBe("way-behind"); // 3pm, nothing logged
    expect(s.streak).toBe(0);
  });
  it("expected fraction at 3pm in 7–23 window is 50%", () => expect(expectedFraction(15, 7, 23)).toBe(0.5));
});

describe("projection", () => {
  const mocks = [
    { date: "2026-09-06", score: 80 },
    { date: "2026-09-13", score: 94 },
  ];
  it("needs 2 mocks", () => expect(projectScore(mocks.slice(0, 1), "2026-09-18", 1)).toBeNull());
  it("consistency scales the improvement rate", () => {
    const full = projectScore(mocks, "2026-09-18", 1)!;
    const half = projectScore(mocks, "2026-09-18", 0.5)!;
    expect(full.rate).toBe(1); // 2/day, capped
    expect(full.base).toBe(95.5); // capped line through the mean (87 @ 8.5 days ago)
    expect(full.projected).toBe(95.5 + 72); // 72 days to 29 Nov
    expect(half.projected).toBe(95.5 + 36);
  });
  it("skipping today lowers projection", () => {
    const t = { qa: 50, rc: 10, va: 15, dilr: 5 };
    const plans = ["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"].map((date) => ({ date, type: "practice" as const, targets: t }));
    const s = computeStats({
      plans, doneByDate: { "2026-09-15": t, "2026-09-16": t, "2026-09-17": t },
      today: "2026-09-18", hour: 15, window: { start: 7, end: 23 }, exam: "2026-11-29",
    });
    const imp = skipImpact(s, [{ date: "2026-09-01", score: 70 }, { date: "2026-09-15", score: 75 }], "2026-09-18");
    expect(imp.scoreIfSkip!).toBeLessThan(imp.scoreIfDone!);
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
  it("remaining lists what's left", () => expect(remaining(mk(0.8, 15)).text).toBe("10 QA Qs, 2 RC passages, 3 VA Qs, 1 DILR set"));
});

describe("weekly goal", async () => {
  const { weekStatus } = await import("../week");
  const { weekStartOf } = await import("../cat");
  const t = { qa: 50, rc: 10, va: 15, dilr: 5 };
  const plans = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]
    .map((date) => ({ date, type: "practice", targets: t, mockDone: false }));
  it("week is Monday–Sunday IST", () => expect(weekStartOf("2026-09-18")).toBe("2026-09-14"));
  it("goal stays fixed when daily plan is cut; remaining work spreads over days left", () => {
    const cut = plans.map((p) => (p.date >= "2026-09-18" ? { ...p, targets: { qa: 10, rc: 2, va: 3, dilr: 1 } } : p));
    const w = weekStatus({
      today: "2026-09-18", plans: cut,
      doneByDate: { "2026-09-14": t, "2026-09-15": t },
      goal: { targets: { qa: 300, rc: 60, va: 90, dilr: 30 }, mocks: 0 },
    });
    expect(w.daysLeft).toBe(3);
    expect(w.done.qa).toBe(100);
    expect(w.perDayNeeded!.qa).toBe(67); // (300-100)/3 rounded up
    expect(w.planBelowGoal).toEqual(["qa", "rc", "va", "dilr"]);
  });
});

describe("past CAT curves", async () => {
  const { CAT_CURVES, percentileFor, scoreFor, targetBand, percentileBand } = await import("../cat-history");
  const y2025 = CAT_CURVES.find((c) => c.year === 2025)!;
  it("published rows are exact, gaps are interpolated", () => {
    expect(scoreFor(y2025, 99)).toEqual({ score: 84.8, exact: true });
    expect(scoreFor(y2025, 99.25)!.score).toBeCloseTo((84.8 + 93) / 2);
    expect(scoreFor(y2025, 99.25)!.exact).toBe(false);
  });
  it("curves are monotonic", () => {
    for (const c of CAT_CURVES) for (let i = 1; i < c.points.length; i++) {
      expect(c.points[i][0]).toBeGreaterThan(c.points[i - 1][0]);
      expect(c.points[i][1]).toBeGreaterThan(c.points[i - 1][1]);
    }
  });
  it("99 %ile band spans the easiest and toughest year", () => {
    const b = targetBand(99)!;
    expect(b.lo).toBe(76.15); // 2023
    expect(b.hi).toBe(98); // 2021
  });
  it("never extrapolates past the top published row", () => {
    expect(percentileFor(CAT_CURVES[0], 150)).toEqual({ pct: 99.9, atLeast: true });
    expect(percentileBand(40).belowAll).toBe(true);
  });
});

describe("fmtPct", async () => {
  const { fmtPct } = await import("../cat-history");
  it("never rounds up into the next percentile", () => {
    expect(fmtPct(98.96)).toBe("98.9");
    expect(fmtPct(99.999)).toBe("99.99");
    expect(fmtPct(99.9)).toBe("99.9");
    expect(fmtPct(99.5)).toBe("99.5");
  });
});

describe("custom phases", () => {
  const t = { qa: 20, rc: 2, va: 8, dilr: 2 };
  const mockTop = { qa: 5, rc: 0, va: 0, dilr: 0 };
  const zero = { qa: 0, rc: 0, va: 0, dilr: 0 };
  const P = { type: "practice" as const, targets: t };
  const phases = [
    // Mon..Sun: mock on Sun
    { name: "Foundation", until: "2026-10-18", week: [P, P, P, P, P, P, { type: "mock" as const, targets: mockTop }] },
    // Wed + Sun mocks, Sat rest
    { name: "Mocks", until: "2026-11-28", week: [P, P, { type: "mock" as const, targets: zero }, P, P, { type: "rest" as const, targets: zero }, { type: "mock" as const, targets: zero }] },
  ];
  const plan = generatePhased("2026-09-19", phases);

  it("covers every day and ends on CAT", () => {
    expect(plan[0].date).toBe("2026-09-19");
    expect(plan.at(-1)!).toMatchObject({ date: "2026-11-29", tag: "CAT", phase: null });
  });
  it("uses each phase's weekday pattern", () => {
    const by = new Map(plan.map((d) => [d.date, d]));
    expect(by.get("2026-09-20")).toMatchObject({ type: "mock", targets: mockTop, phase: "Foundation" }); // Sun
    expect(by.get("2026-10-18")!.phase).toBe("Foundation"); // `until` is inclusive
    expect(by.get("2026-10-19")).toMatchObject({ type: "practice", phase: "Mocks" });
    expect(by.get("2026-10-21")!.type).toBe("mock"); // Wed
    expect(by.get("2026-10-24")!.type).toBe("rest"); // Sat
  });
  it("numbers mocks in order", () => {
    const names = plan.filter((d) => d.type === "mock").map((d) => d.mockName);
    expect(names[0]).toBe("Mock 1");
    expect(names.at(-1)).toBe(`Mock ${names.length}`);
  });
  it("generatePlan routes phased templates to the phase generator", () => {
    const tpl = { ...SYSTEM_TEMPLATES[1], id: "x", phases };
    expect(generatePlan({ start: "2026-09-19", template: tpl })).toEqual(plan);
  });
  it("system plans label each day with its phase", () => {
    const sys = generatePlan({ start: "2026-09-18", template: manthan });
    expect(sys[0].phase).toBe("Build");
    expect(sys.find((d) => d.date === "2026-11-25")!.phase).toBe("Consolidate");
  });
  it("preset phases are contiguous and end the day before CAT", () => {
    const ps = presetPhases(manthan, "2026-09-19");
    expect(ps.map((p) => p.name)).toEqual(["Foundation", "Mock phase", "Final week"]);
    expect(ps.at(-1)!.until).toBe("2026-11-28");
    for (let i = 1; i < ps.length; i++) expect(ps[i].until > ps[i - 1].until).toBe(true);
    expect(ps.every((p) => p.week.length === 7)).toBe(true);
  });
});
