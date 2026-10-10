// Guards the demo story: any seed edit that breaks it fails `npm test` (and so the Vercel build).

import { describe, expect, it } from "vitest";
import expected from "@/data/seed/expected-conflicts.json";
import { AS_OF } from "./config";
import { isISODate } from "./dates";
import { checkProposed, detect, isOverdue, suggestStart } from "./engine";
import { SEED } from "./seed";
import { buildState } from "./state";
import type { ProjectDraft } from "./types";

const ctx = { departments: SEED.departments, roads: SEED.roads };

describe("seed data", () => {
  it("has unique ids and only references things that exist", () => {
    const ids = SEED.projects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SEED.projects) {
      const road = SEED.roads.find((r) => r.id === p.location.roadId);
      expect(road, `${p.id} road`).toBeDefined();
      expect(
        SEED.departments.some((d) => d.id === p.departmentId),
        `${p.id} department`,
      ).toBe(true);
      expect(p.location.fromM, `${p.id} fromM`).toBeGreaterThanOrEqual(0);
      expect(p.location.toM, `${p.id} toM`).toBeGreaterThan(p.location.fromM);
      expect(
        p.location.toM,
        `${p.id} fits on ${road?.name} (${road?.lengthM} m)`,
      ).toBeLessThanOrEqual(road!.lengthM);
      for (const d of [p.plannedStart, p.plannedEnd, p.actualStart, p.actualEnd]) {
        if (d !== null) expect(isISODate(d), `${p.id} date ${d}`).toBe(true);
      }
      for (const other of p.coordinatedWith) expect(ids).toContain(other);
    }
    for (const e of SEED.events) expect(ids, `event ${e.id}`).toContain(e.projectId);
    for (const r of SEED.roads) expect(r.coords.length, `${r.id} coords`).toBeGreaterThanOrEqual(2);
  });

  it("seeded date changes match the projects' current dates", () => {
    const replayed = buildState(SEED, []).projects;
    expect(replayed).toEqual(SEED.projects);
  });

  it("produces exactly the expected flags", () => {
    const { conflicts, unchecked } = detect(SEED.projects, ctx);
    expect(conflicts.map((c) => c.id).sort()).toEqual([...expected].sort());
    expect(unchecked.map((u) => u.projectId)).toEqual(["P16"]);
  });

  it("keeps the demo numbers: drain overdue by 5 days", () => {
    const drain = SEED.projects.find((p) => p.id === "P03")!;
    expect(isOverdue(drain, AS_OF)).toEqual({ overdue: true, daysLate: 5 });
  });

  it("keeps the demo numbers: proposed cable gets two flags, then one is coordinated", () => {
    const draft: ProjectDraft = {
      title: "Underground power cable",
      purpose: "Demo proposal",
      departmentId: "D-POWER",
      contractor: "Demo",
      contactName: "Demo",
      contactPhone: "000",
      workType: "EXCAVATION",
      location: { roadId: "R1", fromM: 500, toM: 1000 },
      plannedStart: "2026-10-25",
      plannedEnd: "2026-11-05",
      locationApproximate: false,
      datesTentative: false,
      isEmergency: false,
      coordinatedWith: [],
    };
    const { conflicts } = checkProposed(draft, SEED.projects, ctx);
    const protection = conflicts.find((c) => c.rule === "RESURFACE_PROTECTION")!;
    const concurrent = conflicts.find((c) => c.rule === "CONCURRENT_WORKS")!;
    expect(conflicts).toHaveLength(2);
    expect(protection).toMatchObject({
      projectIds: ["DRAFT", "P01"],
      gapDays: 66,
      overlapM: { lengthM: 500 },
    });
    expect(concurrent).toMatchObject({
      projectIds: ["DRAFT", "P02"],
      overlapM: { fromM: 800, toM: 1000, lengthM: 200 },
      overlapDates: { start: "2026-11-03", end: "2026-11-05", days: 3 },
      joinWindow: { projectId: "P02", start: "2026-11-03", end: "2026-11-20" },
    });

    const joined = checkProposed(
      { ...draft, plannedStart: "2026-11-03", plannedEnd: "2026-11-20", coordinatedWith: ["P02"] },
      SEED.projects,
      ctx,
    ).conflicts;
    expect(joined.find((c) => c.projectIds.includes("P02"))?.kind).toBe("COORDINATED");
    expect(joined.find((c) => c.rule === "RESURFACE_PROTECTION")?.kind).toBe("CONFLICT");

    // Earliest flag-free start: the day after the 365-day protection window ends (20 Aug + 366).
    expect(suggestStart(draft, SEED.projects, AS_OF, ctx)).toBe("2027-08-21");
  });
});
