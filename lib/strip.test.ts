import { describe, expect, it } from "vitest";
import { toDay } from "./dates";
import { detect, DRAFT_ID } from "./engine";
import { SEED } from "./seed";
import {
  fitLabel,
  metreStep,
  metreTicks,
  monthStep,
  monthTicks,
  scaleLinear,
  span,
  stripBars,
  stripFlags,
  stripWindow,
  MAX_WINDOW_DAYS,
} from "./strip";
import type { Project } from "./types";

function project(overrides: Partial<Project> & { id: string }): Project {
  return {
    title: "Test work",
    purpose: "test",
    departmentId: "D1",
    contractor: "Demo Contractor",
    contactName: "Demo",
    contactPhone: "000",
    workType: "EXCAVATION",
    status: "PLANNED",
    location: { roadId: "R1", fromM: 0, toM: 500 },
    plannedStart: "2026-10-12",
    plannedEnd: "2026-10-20",
    actualStart: null,
    actualEnd: null,
    locationApproximate: false,
    datesTentative: false,
    isEmergency: false,
    coordinatedWith: [],
    ...overrides,
  };
}

describe("scales", () => {
  it("maps dates to x and metres to y linearly", () => {
    const x = scaleLinear([toDay("2026-08-01"), toDay("2026-09-01")], [50, 360]);
    expect(x(toDay("2026-08-01"))).toBe(50);
    expect(x(toDay("2026-09-01"))).toBe(360);
    expect(x(toDay("2026-08-16"))).toBeCloseTo(200, 6); // 15 of 31 days
    const y = scaleLinear([0, 2000], [20, 220]);
    expect(y(0)).toBe(20);
    expect(y(500)).toBe(70);
    expect(y(2000)).toBe(220);
  });

  it("maps a zero-width domain to the middle instead of dividing by zero", () => {
    expect(scaleLinear([5, 5], [0, 100])(5)).toBe(50);
  });

  it("widens thin spans symmetrically", () => {
    expect(span(10, 30, 2)).toEqual([10, 30]);
    expect(span(30, 10, 2)).toEqual([10, 30]);
    expect(span(10, 11, 4)).toEqual([8.5, 12.5]);
  });
});

describe("stripBars", () => {
  it("uses actual dates over planned, skips cancelled, undated and other-road works", () => {
    const bars = stripBars(
      [
        project({ id: "A", actualStart: "2026-10-14", actualEnd: "2026-10-22" }),
        project({ id: "B", status: "CANCELLED" }),
        project({ id: "C", plannedStart: null, plannedEnd: null }),
        project({ id: "D", location: { roadId: "R2", fromM: 0, toM: 100 } }),
      ],
      "R1",
    );
    expect(bars.map((b) => b.id)).toEqual(["A"]);
    expect(bars[0]).toMatchObject({ start: "2026-10-14", end: "2026-10-22", assumedEnd: false });
    // The last day counts: a bar ends at the start of the day after.
    expect(bars[0].endDay - bars[0].startDay).toBe(9);
  });

  it("assumes start + 60 days when the end date is missing", () => {
    const [bar] = stripBars(
      [project({ id: "A", plannedStart: "2026-10-25", plannedEnd: null })],
      "R1",
    );
    expect(bar).toMatchObject({ end: "2026-12-24", assumedEnd: true });
  });

  it("puts the draft last and lets it replace a project with the draft id", () => {
    const draft = project({ id: DRAFT_ID, status: "PROPOSED", plannedStart: "2026-09-01" });
    const bars = stripBars(
      [
        project({ id: DRAFT_ID }),
        project({ id: "B", plannedStart: "2026-11-01", plannedEnd: "2026-11-02" }),
      ],
      "R1",
      draft,
    );
    expect(bars.map((b) => [b.id, b.isDraft])).toEqual([
      ["B", false],
      [DRAFT_ID, true],
    ]);
    expect(bars[1].start).toBe("2026-09-01");
  });
});

describe("Lakeview Rd (seed)", () => {
  const road = SEED.roads.find((r) => r.id === "R1")!;
  const onRoad = SEED.projects.filter((p) => p.location.roadId === "R1");
  const { conflicts } = detect(SEED.projects, { roads: SEED.roads });
  const bars = stripBars(onRoad, road.id);
  const flags = stripFlags(conflicts, bars, road.id);

  it("draws P01, P02 and P03 in start order", () => {
    expect(bars.map((b) => b.id)).toEqual(["P01", "P03", "P02"]);
  });

  it("places the resurface-protection gap between P01's end and P02's start", () => {
    expect(flags).toHaveLength(1);
    const [gap] = flags;
    expect(gap).toMatchObject({ shape: "gap", coordinated: false, fromM: 800, toM: 1200 });
    expect(gap.startDay).toBe(toDay("2026-08-21")); // the day after P01's last day
    expect(gap.endDay).toBe(toDay("2026-11-03")); // P02's first day
    expect(gap.days).toBe(conflicts.find((c) => c.id === gap.id)!.gapDays);
  });

  it("pads the window by 10 days around the works and includes the demo date", () => {
    const win = stripWindow(bars, flags, "2026-10-10")!;
    expect(win.startDay).toBe(toDay("2026-08-01") - 10);
    expect(win.endDay).toBe(toDay("2026-11-20") + 1 + 10);
  });
});

describe("stripFlags", () => {
  it("draws concurrent works from the conflict's own overlap dates, both end days included", () => {
    const { conflicts } = detect(SEED.projects, { roads: SEED.roads });
    const bars = stripBars(SEED.projects, "R2");
    const overlap = stripFlags(conflicts, bars, "R2").find((f) => f.shape === "overlap")!;
    expect(overlap).toMatchObject({
      id: "CONCURRENT_WORKS:P04:P05",
      days: 4,
      fromM: 600,
      toM: 900,
    });
    expect(overlap.endDay - overlap.startDay).toBe(4);
  });

  it("skips flags on other roads and gaps whose works are not drawn", () => {
    const { conflicts } = detect(SEED.projects, { roads: SEED.roads });
    const r2 = stripBars(SEED.projects, "R2").filter((b) => b.id !== "P06");
    const flags = stripFlags(conflicts, r2, "R2");
    expect(flags.map((f) => f.id)).toEqual(["CONCURRENT_WORKS:P04:P05"]);
  });

  it("marks coordinated works", () => {
    const a = project({ id: "A", coordinatedWith: ["B"] });
    const b = project({ id: "B", plannedStart: "2026-10-15", plannedEnd: "2026-10-30" });
    const flags = stripFlags(detect([a, b]).conflicts, stripBars([a, b], "R1"), "R1");
    expect(flags).toHaveLength(1);
    expect(flags[0].coordinated).toBe(true);
  });
});

describe("stripWindow", () => {
  it("is null when nothing is dated", () => {
    expect(stripWindow([], [], "2026-10-10")).toBeNull();
  });

  it("stretches to include a demo date far from the works", () => {
    const bars = stripBars([project({ id: "A" })], "R1");
    const win = stripWindow(bars, [], "2027-03-01", 5)!;
    expect(win.startDay).toBe(toDay("2026-10-12") - 5);
    expect(win.endDay).toBe(toDay("2027-03-01") + 1 + 5);
  });
});

describe("axis ticks", () => {
  it("ticks the 1st of each month, with the year on the first tick and on January", () => {
    const ticks = monthTicks(toDay("2026-10-15"), toDay("2027-03-01"));
    expect(ticks.map((t) => t.label)).toEqual(["Nov 2026", "Dec", "Jan 2027", "Feb"]);
    expect(ticks[0].day).toBe(toDay("2026-11-01"));
  });

  it("aligns multi-month steps to January", () => {
    const ticks = monthTicks(toDay("2026-02-10"), toDay("2027-12-31"), 3);
    expect(ticks.map((t) => t.label)).toEqual([
      "Apr 2026",
      "Jul",
      "Oct",
      "Jan 2027",
      "Apr",
      "Jul",
      "Oct",
    ]);
  });

  it("thins month ticks when days are narrow", () => {
    expect(monthStep(5)).toBe(1);
    expect(monthStep(1)).toBe(2);
    expect(monthStep(0.1)).toBe(12);
  });

  it("picks round metre steps adapted to the road length", () => {
    expect(metreStep(2245)).toBe(500);
    expect(metreStep(900)).toBe(200);
    expect(metreStep(1200, 6)).toBe(200);
    expect(metreStep(12_000)).toBe(2500);
    expect(metreTicks(2245)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(metreTicks(1000)).toEqual([0, 200, 400, 600, 800, 1000]);
  });
});

describe("fitLabel", () => {
  it("returns the first label that fits, or null", () => {
    expect(fitLabel(["4 days", "4d"], { w: 60, h: 20 }, 11)).toBe("4 days");
    expect(fitLabel(["4 days", "4d"], { w: 30, h: 20 }, 11)).toBe("4d");
    expect(fitLabel(["4 days", "4d"], { w: 10, h: 20 }, 11)).toBeNull();
    expect(fitLabel(["P01"], { w: 100, h: 8 }, 11)).toBeNull();
  });
});

describe("malformed dates", () => {
  it("treats a half-typed 6-digit year as a missing end instead of a 200,000-year window", () => {
    const typing = project({ id: "DRAFT", plannedStart: "2026-10-25", plannedEnd: "202612-02-20" });
    const bars = stripBars([], "R1", typing);
    expect(bars).toHaveLength(1);
    expect(bars[0].assumedEnd).toBe(true);
    const win = stripWindow(bars, [], "2026-10-10")!;
    expect(win.endDay - win.startDay).toBeLessThan(200);
  });

  it("caps the window and the month ticks however far apart the works are", () => {
    const early = project({ id: "A", plannedStart: "2000-01-01", plannedEnd: "2000-01-02" });
    const late = project({ id: "B", plannedStart: "2090-01-01", plannedEnd: "2090-01-02" });
    const win = stripWindow(stripBars([early, late], "R1"), [], "2026-10-10")!;
    expect(win.endDay - win.startDay).toBeLessThanOrEqual(MAX_WINDOW_DAYS + 20);
    expect(monthTicks(toDay("2000-01-01"), toDay("2090-01-01")).length).toBeLessThanOrEqual(240);
  });
});
