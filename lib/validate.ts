// Hand-written request validation. Each function returns either a clean value or a message.

import { isISODate, toDay } from "./dates";
import type {
  CivicState,
  ISODate,
  ProjectDraft,
  ReportCategory,
  ReviewStatus,
  WorkType,
} from "./types";

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

const WORK_TYPES: WorkType[] = ["EXCAVATION", "RESURFACING", "SURFACE_OTHER"];
const REPORT_CATEGORIES: ReportCategory[] = [
  "NO_WORK_SEEN",
  "HAZARD",
  "POOR_QUALITY",
  "TRAFFIC",
  "OTHER",
];
const REVIEW_STATUSES: ReviewStatus[] = ["OPEN", "ACKNOWLEDGED", "DISMISSED"];

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function text(v: unknown, field: string, min: number, max: number): Result<string> {
  if (typeof v !== "string") return fail(`${field} is required.`);
  const s = v.trim();
  if (s.length < min) return fail(`${field} must be at least ${min} characters.`);
  if (s.length > max) return fail(`${field} must be at most ${max} characters.`);
  return { ok: true, value: s };
}

function optionalDate(v: unknown, field: string): Result<ISODate | null> {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (!isISODate(v)) return fail(`${field} must be a date in YYYY-MM-DD format.`);
  return { ok: true, value: v };
}

function dateRange(
  startRaw: unknown,
  endRaw: unknown,
  requireStart: boolean,
): Result<[ISODate | null, ISODate | null]> {
  const start = optionalDate(startRaw, "Start date");
  if (!start.ok) return start;
  const end = optionalDate(endRaw, "End date");
  if (!end.ok) return end;
  if (requireStart && !start.value) return fail("Start date is required.");
  if (start.value && end.value && toDay(end.value) < toDay(start.value))
    return fail("End date must be on or after the start date.");
  return { ok: true, value: [start.value, end.value] };
}

export function validateDraft(body: unknown, state: CivicState): Result<ProjectDraft> {
  if (!isObject(body)) return fail("A draft project is required.");
  const title = text(body.title, "Title", 3, 120);
  if (!title.ok) return title;
  const purpose = text(body.purpose ?? "Not stated", "Purpose", 3, 1000);
  if (!purpose.ok) return purpose;
  if (
    typeof body.departmentId !== "string" ||
    !state.departments.some((d) => d.id === body.departmentId)
  )
    return fail("Choose a valid department.");
  if (!WORK_TYPES.includes(body.workType as WorkType)) return fail("Choose a valid work type.");

  const loc = body.location;
  if (!isObject(loc)) return fail("A location is required.");
  const road = state.roads.find((r) => r.id === loc.roadId);
  if (!road) return fail("Choose a valid road.");
  const fromM = Number(loc.fromM);
  const toM = Number(loc.toM);
  if (!Number.isFinite(fromM) || !Number.isFinite(toM) || fromM < 0 || toM <= fromM)
    return fail("The stretch must start at 0 m or more and end after it starts.");
  if (toM > road.lengthM) return fail(`${road.name} is only ${road.lengthM} m long.`);

  const dates = dateRange(body.plannedStart, body.plannedEnd, true);
  if (!dates.ok) return dates;

  const coordinatedWith = Array.isArray(body.coordinatedWith) ? body.coordinatedWith : [];
  if (
    !coordinatedWith.every(
      (id) => typeof id === "string" && state.projects.some((p) => p.id === id),
    )
  )
    return fail("Coordinated projects must exist in the register.");

  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : fallback;
  return {
    ok: true,
    value: {
      title: title.value,
      purpose: purpose.value,
      departmentId: body.departmentId,
      contractor: str(body.contractor, "To be appointed"),
      contactName: str(body.contactName, "Not stated"),
      contactPhone: str(body.contactPhone, "Not stated"),
      workType: body.workType as WorkType,
      location: { roadId: road.id, fromM, toM },
      plannedStart: dates.value[0],
      plannedEnd: dates.value[1],
      locationApproximate: body.locationApproximate === true,
      datesTentative: body.datesTentative === true,
      isEmergency: body.isEmergency === true,
      restorationBy: str(
        body.restorationBy,
        state.departments.find((d) => d.id === body.departmentId)!.shortName,
      ),
      coordinatedWith: coordinatedWith as string[],
    },
  };
}

export function validateJustification(v: unknown): Result<string | undefined> {
  if (v === undefined || v === null || v === "") return { ok: true, value: undefined };
  return text(v, "Justification", 10, 1000);
}

export function validateReport(
  body: unknown,
): Result<{ category: ReportCategory; description: string; name?: string }> {
  if (!isObject(body)) return fail("A report is required.");
  if (!REPORT_CATEGORIES.includes(body.category as ReportCategory))
    return fail("Choose a report category.");
  const description = text(body.description, "Description", 10, 1000);
  if (!description.ok) return description;
  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : undefined;
  return {
    ok: true,
    value: {
      category: body.category as ReportCategory,
      description: description.value,
      ...(name ? { name } : {}),
    },
  };
}

export function validateReschedule(
  body: unknown,
): Result<{ newStart: ISODate; newEnd: ISODate | null; reason: string }> {
  if (!isObject(body)) return fail("New dates and a reason are required.");
  const dates = dateRange(body.newStart, body.newEnd, true);
  if (!dates.ok) return dates;
  const reason = text(body.reason, "Reason", 10, 500);
  if (!reason.ok) return reason;
  return {
    ok: true,
    value: { newStart: dates.value[0]!, newEnd: dates.value[1], reason: reason.value },
  };
}

export function validateReview(body: unknown): Result<{ status: ReviewStatus; note: string }> {
  if (!isObject(body)) return fail("A review status is required.");
  if (!REVIEW_STATUSES.includes(body.status as ReviewStatus))
    return fail("Choose OPEN, ACKNOWLEDGED or DISMISSED.");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (body.status === "DISMISSED" && note.length < 10)
    return fail("Explain in at least 10 characters why the flag is dismissed.");
  return { ok: true, value: { status: body.status as ReviewStatus, note } };
}
