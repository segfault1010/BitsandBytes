// Read models built from the current state. Used by the API routes.

import { AS_OF } from "./config";
import { checkProposed, conflictsFor, detect, isOverdue, type EngineContext } from "./engine";
import type {
  CivicState,
  Conflict,
  DetectResult,
  ProjectDetail,
  ProjectDraft,
  ProjectSummary,
  Review,
} from "./types";

export function engineContext(state: CivicState): EngineContext {
  return { departments: state.departments, roads: state.roads };
}

export function allConflicts(state: CivicState): DetectResult {
  return detect(state.projects, engineContext(state));
}

export function checkDraft(state: CivicState, draft: ProjectDraft): DetectResult {
  return checkProposed(draft, state.projects, engineContext(state));
}

/** Flags that still need attention: real conflicts, not coordinated or emergency info. */
export function isOpenFlag(c: Conflict): boolean {
  return c.kind === "CONFLICT" && c.severity !== "INFO";
}

export function withReview(state: CivicState, c: Conflict): Conflict & { review: Review | null } {
  return { ...c, review: state.reviews[c.id] ?? null };
}

export interface ProjectFilters {
  roadId?: string | null;
  departmentId?: string | null;
  status?: string | null;
}

export function projectSummaries(
  state: CivicState,
  filters: ProjectFilters = {},
): ProjectSummary[] {
  const { conflicts } = allConflicts(state);
  return state.projects
    .filter((p) => !filters.roadId || p.location.roadId === filters.roadId)
    .filter((p) => !filters.departmentId || p.departmentId === filters.departmentId)
    .filter((p) => !filters.status || p.status === filters.status)
    .map((p) => ({
      ...p,
      conflictCount: conflictsFor(conflicts, p.id).filter(isOpenFlag).length,
      reportCount: state.events.filter((e) => e.type === "REPORT_ADDED" && e.projectId === p.id)
        .length,
      overdue: isOverdue(p, AS_OF),
    }));
}

export function projectDetail(state: CivicState, id: string): ProjectDetail | null {
  const project = state.projects.find((p) => p.id === id);
  if (!project) return null;
  const history = state.events.filter((e) => e.projectId === id);
  const reports = history.flatMap((e) =>
    e.type === "REPORT_ADDED" ? [{ ...e.payload, id: e.id, createdAt: e.createdAt }] : [],
  );
  return {
    project,
    department: state.departments.find((d) => d.id === project.departmentId) ?? null,
    road: state.roads.find((r) => r.id === project.location.roadId) ?? null,
    overdue: isOverdue(project, AS_OF),
    history,
    reports,
    conflicts: conflictsFor(allConflicts(state).conflicts, id).map((c) => withReview(state, c)),
  };
}

/** Next free id of the form P17. */
export function nextProjectId(state: CivicState): string {
  const max = state.projects.reduce((m, p) => {
    const n = /^P(\d+)$/.exec(p.id);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `P${String(max + 1).padStart(2, "0")}`;
}
