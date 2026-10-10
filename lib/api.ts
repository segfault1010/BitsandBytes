// Typed browser client for our own /api routes. Pages and components call only these functions.

import type {
  CivicEvent,
  Conflict,
  DetectResult,
  MetaResponse,
  Project,
  ProjectDetail,
  ProjectDraft,
  ProjectSummary,
  ReportCategory,
  Review,
  ReviewStatus,
  StoreMode,
  UncheckedProject,
} from "./types";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Extra fields from the error body, e.g. `conflicts` on JUSTIFICATION_REQUIRED. */
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiRequestError(
      res.status,
      err.code ?? "HTTP_ERROR",
      err.message ?? `Request failed (${res.status})`,
      body,
    );
  }
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  health: () =>
    request<{ ok: boolean; mode: StoreMode; asOf: string; projects: number; events: number }>(
      "/api/health",
    ),

  meta: () => request<MetaResponse>("/api/meta"),

  projects: (filters: { roadId?: string; departmentId?: string; status?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v) as [string, string][],
    );
    return request<ProjectSummary[]>(`/api/projects${qs.size ? `?${qs}` : ""}`);
  },

  project: (id: string) => request<ProjectDetail>(`/api/projects/${encodeURIComponent(id)}`),

  conflicts: () =>
    request<{ conflicts: (Conflict & { review: Review | null })[]; unchecked: UncheckedProject[] }>(
      "/api/conflicts",
    ),

  /** Live check of a proposed work. Saves nothing. */
  checkDraft: (draft: ProjectDraft) =>
    request<DetectResult>("/api/conflicts/check", post({ draft })),

  /** Throws ApiRequestError with code JUSTIFICATION_REQUIRED (status 422) if open flags remain. */
  submitDraft: (draft: ProjectDraft, justification?: string) =>
    request<{ project: Project; conflicts: Conflict[] }>(
      "/api/projects",
      post({ draft, justification }),
    ),

  addReport: (
    projectId: string,
    report: { category: ReportCategory; description: string; name?: string },
  ) =>
    request<{ event: CivicEvent }>(
      `/api/projects/${encodeURIComponent(projectId)}/reports`,
      post(report),
    ),

  reschedule: (
    projectId: string,
    change: { newStart: string; newEnd: string | null; reason: string },
  ) =>
    request<{ project: Project; event: CivicEvent }>(
      `/api/projects/${encodeURIComponent(projectId)}/reschedule`,
      post(change),
    ),

  review: (conflictId: string, review: { status: ReviewStatus; note: string }) =>
    request<{ event: CivicEvent }>(`/api/conflicts/${encodeURIComponent(conflictId)}/review`, {
      method: "PUT",
      body: JSON.stringify(review),
    }),

  reset: (token: string) =>
    request<{ ok: boolean }>("/api/admin/reset", {
      method: "POST",
      headers: { "x-reset-token": token },
    }),
};
