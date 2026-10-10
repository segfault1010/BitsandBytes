import type { Seed } from "./seed";
import type { CivicEvent, CivicState, Project, Review } from "./types";

/** Current state = seed + events, replayed in order. Pure, so it is easy to test. */
export function buildState(seed: Seed, events: CivicEvent[]): CivicState {
  const projects: Project[] = seed.projects.map((p) => ({ ...p, location: { ...p.location } }));
  const byId = new Map(projects.map((p) => [p.id, p]));
  const reviews: Record<string, Review> = {};
  const all = [...seed.events, ...events];

  for (const event of all) {
    switch (event.type) {
      case "PROJECT_PROPOSED": {
        const project = { ...event.payload.project };
        projects.push(project);
        byId.set(project.id, project);
        break;
      }
      case "DATES_CHANGED": {
        const project = event.projectId ? byId.get(event.projectId) : undefined;
        if (project) {
          project.plannedStart = event.payload.newStart;
          project.plannedEnd = event.payload.newEnd;
        }
        break;
      }
      case "CONFLICT_REVIEWED":
        reviews[event.payload.conflictId] = { ...event.payload, reviewedAt: event.createdAt };
        break;
      case "REPORT_ADDED":
        break;
    }
  }

  return { departments: seed.departments, roads: seed.roads, projects, events: all, reviews };
}
