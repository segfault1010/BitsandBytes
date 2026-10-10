import departmentsJson from "@/data/seed/departments.json";
import historyJson from "@/data/seed/history.json";
import projectsJson from "@/data/seed/projects.json";
import reportsJson from "@/data/seed/reports.json";
import roadsJson from "@/data/seed/roads.json";
import { roadLengthM } from "./geo";
import type { CivicEvent, Department, Project, Road } from "./types";

export interface Seed {
  departments: Department[];
  roads: Road[];
  projects: Project[];
  /** Seeded history (date changes, reports), oldest first. */
  events: CivicEvent[];
}

const roads: Road[] = (roadsJson as Omit<Road, "lengthM">[]).map((r) => ({
  ...r,
  coords: r.coords as [number, number][],
  lengthM: Math.round(roadLengthM(r.coords as [number, number][])),
}));

export const SEED: Seed = {
  departments: departmentsJson as Department[],
  roads,
  projects: projectsJson as Project[],
  events: [...(historyJson as CivicEvent[]), ...(reportsJson as CivicEvent[])].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  ),
};
