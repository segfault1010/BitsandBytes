import { describe, expect, it } from "vitest";
import { nextProjectId, projectDetail, projectSummaries } from "./registry";
import { SEED } from "./seed";
import { buildState } from "./state";
import type { CivicEvent } from "./types";

const review = (status: "ACKNOWLEDGED" | "DISMISSED"): CivicEvent => ({
  id: "ev-1",
  type: "CONFLICT_REVIEWED",
  projectId: "P04",
  payload: {
    conflictId: "CONCURRENT_WORKS:P04:P05",
    status,
    note: "Checked on site with both teams.",
  },
  createdAt: "2026-10-10T10:00:00.000Z",
});

const count = (events: CivicEvent[], id: string) =>
  projectSummaries(buildState(SEED, events)).find((p) => p.id === id)!.conflictCount;

describe("registry read models", () => {
  it("counts open flags per project, and stops counting a flag once it is dismissed", () => {
    expect(count([], "P04")).toBe(1);
    expect(count([review("ACKNOWLEDGED")], "P04")).toBe(1); // acknowledged still needs coordinating
    expect(count([review("DISMISSED")], "P04")).toBe(0);
    expect(count([review("DISMISSED")], "P05")).toBe(1); // P05's other flag (with P06) is still open
  });

  it("returns a project's reports and review status in its detail", () => {
    const detail = projectDetail(buildState(SEED, [review("ACKNOWLEDGED")]), "P04")!;
    expect(detail.conflicts[0].review?.status).toBe("ACKNOWLEDGED");
    expect(projectDetail(buildState(SEED, []), "P03")!.reports).toHaveLength(2);
    expect(projectDetail(buildState(SEED, []), "NOPE")).toBeNull();
  });

  it("gives new proposals the next free id", () => {
    expect(nextProjectId(buildState(SEED, []))).toBe("P17");
  });
});
