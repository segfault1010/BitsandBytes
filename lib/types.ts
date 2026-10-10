// CivicTrack data contract. Frozen at 1:45 PM: changes go through the lead (role A).

/** Calendar date, 'YYYY-MM-DD'. Never a timestamp; all day maths happen in UTC (see lib/dates.ts). */
export type ISODate = string;

export type WorkType = "EXCAVATION" | "RESURFACING" | "SURFACE_OTHER";

/** OVERDUE is not a status: it is computed from plannedEnd and the demo date (see isOverdue). */
export type Status = "PROPOSED" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface Department {
  id: string;
  name: string;
  shortName: string;
  contactEmail: string;
}

export interface Road {
  id: string;
  name: string;
  ward: string;
  /** [lat, lng] points along the street, in chainage order (0 m is the first point). */
  coords: [number, number][];
  /** Computed from coords at load time, never typed by hand. */
  lengthM: number;
}

/** A stretch of one road, as chainage: metres from the road's first point. */
export interface Location {
  roadId: string;
  fromM: number;
  toM: number;
}

export interface Project {
  id: string;
  title: string;
  purpose: string;
  departmentId: string;
  contractor: string;
  contactName: string;
  contactPhone: string;
  workType: WorkType;
  status: Status;
  location: Location;
  plannedStart: ISODate | null;
  plannedEnd: ISODate | null;
  actualStart: ISODate | null;
  actualEnd: ISODate | null;
  locationApproximate: boolean;
  datesTentative: boolean;
  isEmergency: boolean;
  /** Who restores the road surface afterwards. */
  restorationBy?: string;
  /** Ids of projects deliberately aligned with this one ("dig once"). */
  coordinatedWith: string[];
}

/** The fields an officer fills in when proposing a work. The server assigns the id and status. */
export type ProjectDraft = Omit<Project, "id" | "status" | "actualStart" | "actualEnd"> & {
  actualStart?: null;
  actualEnd?: null;
};

export type EventType = "PROJECT_PROPOSED" | "REPORT_ADDED" | "DATES_CHANGED" | "CONFLICT_REVIEWED";

export type ReportCategory = "NO_WORK_SEEN" | "HAZARD" | "POOR_QUALITY" | "TRAFFIC" | "OTHER";
export type ReviewStatus = "OPEN" | "ACKNOWLEDGED" | "DISMISSED";

export interface ProjectProposedPayload {
  project: Project;
  justification?: string;
}
export interface ReportAddedPayload {
  category: ReportCategory;
  description: string;
  name?: string;
}
export interface DatesChangedPayload {
  oldStart: ISODate | null;
  oldEnd: ISODate | null;
  newStart: ISODate | null;
  newEnd: ISODate | null;
  reason: string;
}
export interface ConflictReviewedPayload {
  conflictId: string;
  status: ReviewStatus;
  note: string;
}

/** Every change is an append-only event. Seeded history uses the same shape (ids start with "seed-"). */
export type CivicEvent =
  | EventBase<"PROJECT_PROPOSED", ProjectProposedPayload>
  | EventBase<"REPORT_ADDED", ReportAddedPayload>
  | EventBase<"DATES_CHANGED", DatesChangedPayload>
  | EventBase<"CONFLICT_REVIEWED", ConflictReviewedPayload>;

interface EventBase<T extends EventType, P> {
  id: string;
  type: T;
  projectId: string | null;
  payload: P;
  /** ISO timestamp. */
  createdAt: string;
}

export type ConflictRule = "CONCURRENT_WORKS" | "RESURFACE_PROTECTION" | "REPEAT_EXCAVATION";
export type Severity = "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

/** Computed by lib/engine.ts on every request; never stored. */
export interface Conflict {
  /** `${rule}:${idA}:${idB}` with ids sorted, so the same pair always has the same id. */
  id: string;
  rule: ConflictRule;
  /** COORDINATED = the two projects are linked via coordinatedWith, so it is shown as info. */
  kind: "CONFLICT" | "COORDINATED";
  severity: Severity;
  confidence: Confidence;
  projectIds: [string, string];
  roadId: string;
  overlapM: { fromM: number; toM: number; lengthM: number };
  /** Set for CONCURRENT_WORKS. Both end days count. */
  overlapDates?: { start: ISODate; end: ISODate; days: number };
  /** Set for sequential rules: later start minus earlier end, in calendar days. */
  gapDays?: number;
  explanation: string;
  suggestedAction: string;
  caveats: string[];
  /** Only on checkProposed results: the other project's window, for the "Join window" button. */
  joinWindow?: { projectId: string; start: ISODate; end: ISODate };
}

export interface UncheckedProject {
  projectId: string;
  reason: string;
}

export interface DetectResult {
  conflicts: Conflict[];
  unchecked: UncheckedProject[];
}

export interface EngineConfig {
  /** Days after a resurfacing during which excavation on that stretch is flagged. */
  protectionDays: number;
  /** Max days between two separate digs on the same stretch before it stops being flagged. */
  repeatGapDays: number;
  /** End date assumed for a project with no end date: start + this many days. */
  assumedDurationDays: number;
  /** Metres added on each side of a stretch whose location is approximate. */
  approxToleranceM: number;
}

export type Review = ConflictReviewedPayload & { reviewedAt: string };

/** The current state of the register: seed + events, replayed in order. */
export interface CivicState {
  departments: Department[];
  roads: Road[];
  projects: Project[];
  events: CivicEvent[];
  reviews: Record<string, Review>;
}

// ---- API response shapes (see lib/api.ts) ----

export type ProjectSummary = Project & {
  conflictCount: number;
  reportCount: number;
  overdue: OverdueInfo;
};

export interface OverdueInfo {
  overdue: boolean;
  daysLate: number;
}

export interface ProjectDetail {
  project: Project;
  department: Department | null;
  road: Road | null;
  overdue: OverdueInfo;
  /** All events for this project, oldest first: proposals, date changes, reports. */
  history: CivicEvent[];
  reports: (ReportAddedPayload & { id: string; createdAt: string })[];
  conflicts: (Conflict & { review: Review | null })[];
}

export interface MetaResponse {
  departments: Department[];
  roads: Road[];
  config: EngineConfig;
  asOf: ISODate;
  dataNotice: string;
  mode: StoreMode;
}

export type StoreMode = "db" | "memory" | "degraded";

export interface ApiError {
  error: { code: string; message: string };
}
