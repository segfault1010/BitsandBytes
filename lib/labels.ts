// Human-readable labels and colours shared by the UI.

import type {
  Confidence,
  ConflictRule,
  ReportCategory,
  ReviewStatus,
  Severity,
  Status,
  WorkType,
} from "./types";

export const RULE_LABEL: Record<ConflictRule, string> = {
  CONCURRENT_WORKS: "Same stretch, same time",
  RESURFACE_PROTECTION: "Dig on a recently resurfaced road",
  REPEAT_EXCAVATION: "Same stretch dug twice",
};

export const STATUS_LABEL: Record<Status, string> = {
  PROPOSED: "Proposed",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  EXCAVATION: "Excavation (road is dug)",
  RESURFACING: "Resurfacing",
  SURFACE_OTHER: "Other surface work",
};

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  NO_WORK_SEEN: "No work seen",
  HAZARD: "Safety hazard",
  POOR_QUALITY: "Poor quality",
  TRAFFIC: "Traffic problem",
  OTHER: "Other",
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  DISMISSED: "Dismissed",
};

/** Tailwind classes for small badges. */
export const SEVERITY_CLASS: Record<Severity, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200",
  MEDIUM: "bg-orange-100 text-orange-900 border-orange-200",
  LOW: "bg-yellow-100 text-yellow-900 border-yellow-200",
  INFO: "bg-slate-100 text-slate-700 border-slate-200",
};

export const CONFIDENCE_CLASS: Record<Confidence, string> = {
  HIGH: "bg-slate-800 text-white border-slate-800",
  MEDIUM: "bg-slate-200 text-slate-800 border-slate-300",
  LOW: "bg-white text-slate-600 border-slate-300 border-dashed",
};

export const STATUS_CLASS: Record<Status, string> = {
  PROPOSED: "bg-violet-100 text-violet-900 border-violet-200",
  PLANNED: "bg-sky-100 text-sky-900 border-sky-200",
  IN_PROGRESS: "bg-amber-100 text-amber-900 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-900 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

/** Map line colours (hex, for Leaflet). */
export const STATUS_COLOR: Record<Status, string> = {
  PROPOSED: "#7c3aed",
  PLANNED: "#0284c7",
  IN_PROGRESS: "#d97706",
  COMPLETED: "#059669",
  CANCELLED: "#94a3b8",
};

export const MAP_COLOR = {
  road: "#64748b",
  flagHalo: "#dc2626",
  draft: "#111827",
  overlap: "#dc2626",
  coordinated: "#2563eb",
};
