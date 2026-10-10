import { describe, expect, it } from "vitest";
import { checkProposed, detect, DRAFT_ID, isOverdue, suggestStart } from "./engine";
import type { Project, ProjectDraft } from "./types";

let seq = 0;
function project(
  overrides: Partial<Project> & { from?: number; to?: number; road?: string },
): Project {
  const { from = 0, to = 500, road = "R1", ...rest } = overrides;
  seq += 1;
  return {
    id: `T${String(seq).padStart(2, "0")}`,
    title: "Test work",
    purpose: "test",
    departmentId: "D1",
    contractor: "Demo Contractor",
    contactName: "Demo",
    contactPhone: "000",
    workType: "EXCAVATION",
    status: "PLANNED",
    location: { roadId: road, fromM: from, toM: to },
    plannedStart: "2026-10-12",
    plannedEnd: "2026-10-20",
    actualStart: null,
    actualEnd: null,
    locationApproximate: false,
    datesTentative: false,
    isEmergency: false,
    coordinatedWith: [],
    ...rest,
  };
}

describe("detect", () => {
  it("flags the brief's example: 12–20 Oct vs 17–25 Oct on the same stretch overlaps 4 days", () => {
    const a = project({
      workType: "RESURFACING",
      plannedStart: "2026-10-12",
      plannedEnd: "2026-10-20",
    });
    const b = project({ plannedStart: "2026-10-17", plannedEnd: "2026-10-25" });
    const { conflicts } = detect([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].rule).toBe("CONCURRENT_WORKS");
    expect(conflicts[0].overlapDates).toEqual({ start: "2026-10-17", end: "2026-10-20", days: 4 });
    expect(conflicts[0].severity).toBe("HIGH");
    expect(conflicts[0].explanation).toContain("4 days (17–20 Oct)");
    expect(conflicts[0].explanation).toContain("not a finding of fault");
  });

  it("counts both end days: A ends on the day B starts is a 1-day overlap", () => {
    const a = project({ plannedStart: "2026-10-01", plannedEnd: "2026-10-10" });
    const b = project({ plannedStart: "2026-10-10", plannedEnd: "2026-10-15" });
    expect(detect([a, b]).conflicts[0].overlapDates?.days).toBe(1);
  });

  it("does not flag touching stretches, but flags a 1 m overlap", () => {
    const a = project({ from: 0, to: 500 });
    const touching = project({ from: 500, to: 900 });
    const overlapping = project({ from: 499, to: 900, road: "R2" });
    const a2 = project({ from: 0, to: 500, road: "R2" });
    expect(detect([a, touching]).conflicts).toHaveLength(0);
    const { conflicts } = detect([a2, overlapping]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapM).toEqual({ fromM: 499, toM: 500, lengthM: 1 });
  });

  it("does not flag the same dates on different roads", () => {
    expect(detect([project({ road: "R1" }), project({ road: "R2" })]).conflicts).toHaveLength(0);
  });

  it("flags excavation 66 days after resurfacing on an overlapping stretch", () => {
    const resurfacing = project({
      workType: "RESURFACING",
      status: "COMPLETED",
      from: 0,
      to: 1200,
      plannedStart: "2026-08-01",
      plannedEnd: "2026-08-20",
      actualStart: "2026-08-01",
      actualEnd: "2026-08-20",
    });
    const dig = project({
      from: 500,
      to: 1000,
      plannedStart: "2026-10-25",
      plannedEnd: "2026-11-05",
    });
    const { conflicts } = detect([resurfacing, dig]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      rule: "RESURFACE_PROTECTION",
      severity: "HIGH",
      gapDays: 66,
      overlapM: { fromM: 500, toM: 1000, lengthM: 500 },
    });
  });

  it("does not flag digging first and resurfacing afterwards (the correct order)", () => {
    const dig = project({ plannedStart: "2026-10-01", plannedEnd: "2026-10-10" });
    const resurfacing = project({
      workType: "RESURFACING",
      plannedStart: "2026-11-01",
      plannedEnd: "2026-11-05",
    });
    expect(detect([dig, resurfacing]).conflicts).toHaveLength(0);
  });

  it("flags two digs 21 days apart as REPEAT_EXCAVATION, but not 95 days apart", () => {
    const first = project({ plannedStart: "2026-10-17", plannedEnd: "2026-10-25" });
    const near = project({ plannedStart: "2026-11-15", plannedEnd: "2026-11-30" });
    const { conflicts } = detect([first, near]);
    expect(conflicts[0]).toMatchObject({
      rule: "REPEAT_EXCAVATION",
      gapDays: 21,
      severity: "MEDIUM",
    });

    const early = project({ road: "R3", plannedStart: "2026-07-01", plannedEnd: "2026-07-08" });
    const far = project({ road: "R3", plannedStart: "2026-10-11", plannedEnd: "2026-10-18" });
    expect(detect([early, far]).conflicts).toHaveLength(0);
  });

  it("skips cancelled works and pairs of completed works; a completed resurfacing still protects", () => {
    const a = project({});
    const cancelled = project({ status: "CANCELLED" });
    expect(detect([a, cancelled]).conflicts).toHaveLength(0);

    const doneA = project({ road: "R2", status: "COMPLETED" });
    const doneB = project({ road: "R2", status: "COMPLETED" });
    expect(detect([doneA, doneB]).conflicts).toHaveLength(0);
  });

  it("assumes an end date when it is missing, and lists works with no start date as unchecked", () => {
    const openEnded = project({ plannedStart: "2026-10-25", plannedEnd: null });
    const later = project({ plannedStart: "2026-12-01", plannedEnd: "2026-12-10" });
    const noStart = project({ plannedStart: null, plannedEnd: null });
    const { conflicts, unchecked } = detect([openEnded, later, noStart]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].rule).toBe("CONCURRENT_WORKS");
    expect(conflicts[0].confidence).toBe("MEDIUM");
    expect(conflicts[0].caveats.join(" ")).toContain("assumed 60 days");
    expect(unchecked).toEqual([{ projectId: noStart.id, reason: expect.any(String) }]);
  });

  it("applies the 100 m tolerance to approximate locations and lowers confidence", () => {
    const approx = project({ from: 100, to: 700, locationApproximate: true, datesTentative: true });
    const near = project({ from: 750, to: 1000 });
    const { conflicts } = detect([approx, near]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapM).toEqual({ fromM: 750, toM: 800, lengthM: 50 });
    expect(conflicts[0].confidence).toBe("LOW");
  });

  it("shows linked works as COORDINATED and emergency works as INFO", () => {
    const a = project({});
    const b = project({ coordinatedWith: [a.id] });
    const linked = detect([a, b]).conflicts[0];
    expect(linked.kind).toBe("COORDINATED");
    expect(linked.severity).toBe("INFO");

    const c = project({ road: "R2" });
    const emergency = project({ road: "R2", isEmergency: true });
    const flagged = detect([c, emergency]).conflicts[0];
    expect(flagged.kind).toBe("CONFLICT");
    expect(flagged.severity).toBe("INFO");
  });

  it("is deterministic: shuffled input gives identical output, each pair exactly once", () => {
    const works = [
      project({ plannedStart: "2026-10-01", plannedEnd: "2026-10-10" }),
      project({ plannedStart: "2026-10-05", plannedEnd: "2026-10-15" }),
      project({ plannedStart: "2026-10-12", plannedEnd: "2026-10-20" }),
    ];
    const forward = detect(works);
    const backward = detect([...works].reverse());
    expect(backward).toEqual(forward);
    const ids = forward.conflicts.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  });
});

describe("checkProposed", () => {
  it("returns only the proposal's flags, offers a join window, and does not change its input", () => {
    const existingA = project({
      plannedStart: "2026-11-03",
      plannedEnd: "2026-11-20",
      from: 800,
      to: 1500,
    });
    const existingB = project({
      plannedStart: "2026-11-10",
      plannedEnd: "2026-11-25",
      from: 800,
      to: 1500,
    });
    const register = [existingA, existingB];
    const snapshot = structuredClone(register);
    const draft: ProjectDraft = {
      ...project({}),
      actualStart: null,
      actualEnd: null,
      location: { roadId: "R1", fromM: 500, toM: 1000 },
      plannedStart: "2026-10-25",
      plannedEnd: "2026-11-05",
    };

    const { conflicts } = checkProposed(draft, register);
    expect(register).toEqual(snapshot);
    expect(conflicts.every((c) => c.projectIds.includes(DRAFT_ID))).toBe(true);
    const withA = conflicts.find((c) => c.projectIds.includes(existingA.id))!;
    expect(withA.overlapM.lengthM).toBe(200);
    expect(withA.overlapDates).toEqual({ start: "2026-11-03", end: "2026-11-05", days: 3 });
    expect(withA.joinWindow).toEqual({
      projectId: existingA.id,
      start: "2026-11-03",
      end: "2026-11-20",
    });

    const joined = checkProposed(
      {
        ...draft,
        plannedStart: "2026-11-03",
        plannedEnd: "2026-11-20",
        coordinatedWith: [existingA.id],
      },
      register,
    );
    expect(joined.conflicts.find((c) => c.projectIds.includes(existingA.id))?.kind).toBe(
      "COORDINATED",
    );
  });
});

describe("suggestStart", () => {
  const draftFrom = (p: Project): ProjectDraft => ({ ...p, actualStart: null, actualEnd: null });

  it("returns the proposed start when it is already flag-free", () => {
    const existing = project({ road: "S1", plannedStart: "2026-10-01", plannedEnd: "2026-10-05" });
    const draft = draftFrom(
      project({ road: "S2", plannedStart: "2026-10-03", plannedEnd: "2026-10-04" }),
    );
    expect(suggestStart(draft, [existing], "2026-10-01")).toBe("2026-10-03");
  });

  it("moves past a dig on the same stretch and its 90-day repeat window, keeping the duration", () => {
    const existing = project({ road: "S3", plannedStart: "2026-10-01", plannedEnd: "2026-10-10" });
    const draft = draftFrom(
      project({ road: "S3", plannedStart: "2026-10-05", plannedEnd: "2026-10-07" }),
    );
    // Clear only when the gap after 10 Oct exceeds 90 days: 9 Jan 2027 (gap 91).
    expect(suggestStart(draft, [existing], "2026-10-01")).toBe("2027-01-09");
  });

  it("never suggests a date before the demo date", () => {
    const draft = draftFrom(
      project({ road: "S4", plannedStart: "2026-01-01", plannedEnd: "2026-01-02" }),
    );
    expect(suggestStart(draft, [], "2026-10-10")).toBe("2026-10-10");
  });

  it("returns null when every day in the scan is blocked", () => {
    const existing = project({ road: "S5", plannedStart: "2026-10-01", plannedEnd: "2026-12-31" });
    const draft = draftFrom(
      project({ road: "S5", plannedStart: "2026-10-05", plannedEnd: "2026-10-07" }),
    );
    expect(suggestStart(draft, [existing], "2026-10-01", {}, 30)).toBeNull();
  });
});

describe("isOverdue", () => {
  it("is overdue when the planned end has passed and the work is still open", () => {
    const drain = project({
      status: "IN_PROGRESS",
      plannedStart: "2026-09-01",
      plannedEnd: "2026-10-05",
    });
    expect(isOverdue(drain, "2026-10-10")).toEqual({ overdue: true, daysLate: 5 });
    expect(isOverdue({ ...drain, status: "COMPLETED" }, "2026-10-10").overdue).toBe(false);
    expect(isOverdue(drain, "2026-10-05").overdue).toBe(false);
  });
});
