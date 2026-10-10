import { describe, expect, it } from "vitest";
import { haversineM, roadLengthM, sliceRoad } from "./geo";

// Roughly 1.11 km per 0.01° of latitude.
const line: [number, number][] = [
  [12.97, 77.59],
  [12.98, 77.59],
  [12.99, 77.59],
];

describe("geo", () => {
  it("measures a polyline within 1% of the expected length", () => {
    const expected = 2 * 1111.95; // 0.01° of latitude ≈ 1111.95 m
    expect(Math.abs(roadLengthM(line) - expected) / expected).toBeLessThan(0.01);
  });

  it("returns the whole line for the full chainage range", () => {
    expect(sliceRoad(line, 0, roadLengthM(line) + 1)).toEqual(line);
  });

  it("interpolates the start and end points of a middle slice", () => {
    const slice = sliceRoad(line, 500, 1500);
    expect(slice).toHaveLength(3);
    expect(haversineM(line[0], slice[0])).toBeCloseTo(500, 0);
    expect(slice[1]).toEqual(line[1]);
    expect(haversineM(line[0], slice[2])).toBeCloseTo(1500, 0);
  });

  it("returns an empty slice for an empty or inverted range", () => {
    expect(sliceRoad(line, 800, 800)).toEqual([]);
    expect(sliceRoad(line, 900, 100)).toEqual([]);
  });
});
