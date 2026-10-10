// The conflict engine: deterministic, explainable coordination checks between public works.
// Pure functions only: no I/O, no clock, no randomness. Same input, same output, every time.

import { addDays, daysBetween, formatDate, formatRange, toDay } from "./dates";
import type {
  Conflict,
  ConflictRule,
  Confidence,
  Department,
  DetectResult,
  EngineConfig,
  ISODate,
  OverdueInfo,
  Project,
  ProjectDraft,
  Road,
  Severity,
  UncheckedProject,
} from "./types";

/** Illustrative defaults informed by Chennai's one-year rule on cutting relaid roads. Not policy. */
export const DEFAULT_CONFIG: EngineConfig = {
  protectionDays: 365,
  repeatGapDays: 90,
  assumedDurationDays: 60,
  approxToleranceM: 100,
};

/** Id given to a proposed work while it is being checked (it is not saved). */
export const DRAFT_ID = "DRAFT";

export interface EngineContext {
  config?: Partial<EngineConfig>;
  /** Used only to make explanations readable; ids are shown when missing. */
  departments?: Department[];
  roads?: Road[];
}

interface Interval {
  start: ISODate;
  end: ISODate;
  assumedEnd: boolean;
}

interface Stretch {
  fromM: number;
  toM: number;
}

const SEVERITY_RANK: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
const CONFIDENCE_RANK: Record<Confidence, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const REVIEW_NOTE = "Possible coordination conflict, flagged for review; not a finding of fault.";

export function intervalOf(p: Project, cfg: EngineConfig): Interval | null {
  const start = p.actualStart ?? p.plannedStart;
  if (!start) return null;
  const end = p.actualEnd ?? p.plannedEnd;
  if (end && toDay(end) >= toDay(start)) return { start, end, assumedEnd: false };
  return { start, end: addDays(start, cfg.assumedDurationDays), assumedEnd: true };
}

function stretchOf(p: Project, cfg: EngineConfig): Stretch {
  const pad = p.locationApproximate ? cfg.approxToleranceM : 0;
  return { fromM: Math.max(0, p.location.fromM - pad), toM: p.location.toM + pad };
}

const excavates = (p: Project) => p.workType === "EXCAVATION";
const resurfaces = (p: Project) => p.workType === "RESURFACING";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function linked(a: Project, b: Project): boolean {
  return a.coordinatedWith.includes(b.id) || b.coordinatedWith.includes(a.id);
}

/** Finds every flagged pair in the register. Cancelled works and pairs of finished works are skipped. */
export function detect(projects: Project[], ctx: EngineContext = {}): DetectResult {
  const cfg: EngineConfig = { ...DEFAULT_CONFIG, ...ctx.config };
  const names = namer(ctx);
  const live = [...projects]
    .filter((p) => p.status !== "CANCELLED")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const unchecked: UncheckedProject[] = [];
  const intervals = new Map<string, Interval | null>();
  for (const p of live) {
    const iv = intervalOf(p, cfg);
    intervals.set(p.id, iv);
    if (!iv)
      unchecked.push({
        projectId: p.id,
        reason: "No start date recorded, so timing could not be checked.",
      });
  }

  const conflicts: Conflict[] = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const c = checkPair(live[i], live[j], intervals, cfg, names);
      if (c) conflicts.push(c);
    }
  }
  conflicts.sort(compareConflicts);
  return { conflicts, unchecked };
}

function checkPair(
  a: Project,
  b: Project,
  intervals: Map<string, Interval | null>,
  cfg: EngineConfig,
  names: Namer,
): Conflict | null {
  if (a.location.roadId !== b.location.roadId) return null;
  if (a.status === "COMPLETED" && b.status === "COMPLETED") return null;
  const ia = intervals.get(a.id);
  const ib = intervals.get(b.id);
  if (!ia || !ib) return null;

  const sa = stretchOf(a, cfg);
  const sb = stretchOf(b, cfg);
  const fromM = Math.max(sa.fromM, sb.fromM);
  const toM = Math.min(sa.toM, sb.toM);
  if (toM - fromM <= 0) return null; // touching stretches (0–500 and 500–900) share no road
  const overlapM = {
    fromM: Math.round(fromM),
    toM: Math.round(toM),
    lengthM: Math.round(toM - fromM),
  };
  const road = names.road(a.location.roadId);
  const where = `${road} ${overlapM.fromM}–${overlapM.toM} m (${overlapM.lengthM} m)`;

  let rule: ConflictRule;
  let severity: Severity;
  let explanation: string;
  let suggestedAction: string;
  let overlapDates: Conflict["overlapDates"];
  let gapDays: number | undefined;

  const startDay = Math.max(toDay(ia.start), toDay(ib.start));
  const endDay = Math.min(toDay(ia.end), toDay(ib.end));
  const days = endDay - startDay + 1; // both end days count

  if (days > 0) {
    rule = "CONCURRENT_WORKS";
    const start = toDay(ia.start) >= toDay(ib.start) ? ia.start : ib.start;
    const end = toDay(ia.end) <= toDay(ib.end) ? ia.end : ib.end;
    overlapDates = { start, end, days };
    const digAndSurface = (excavates(a) && resurfaces(b)) || (resurfaces(a) && excavates(b));
    severity = (excavates(a) && excavates(b)) || digAndSurface ? "HIGH" : "MEDIUM";
    explanation =
      `${names.label(a, ia)} and ${names.label(b, ib)} both cover ${where}. ` +
      `Their dates overlap for ${plural(days, "day")} (${formatRange(start, end)}). ${REVIEW_NOTE}`;
    suggestedAction = digAndSurface
      ? "Sequence the works: finish the excavation before resurfacing starts, so the new surface is not cut."
      : excavates(a) && excavates(b)
        ? "Coordinate the two departments: align to one window so both use one trench and one road closure."
        : "Coordinate schedules so this stretch is not under two separate closures at once.";
  } else {
    const [first, second] = toDay(ia.start) <= toDay(ib.start) ? [a, b] : [b, a];
    const firstIv = first === a ? ia : ib;
    const secondIv = first === a ? ib : ia;
    const gap = daysBetween(firstIv.end, secondIv.start);
    if (resurfaces(first) && excavates(second) && gap <= cfg.protectionDays) {
      rule = "RESURFACE_PROTECTION";
      severity = "HIGH";
      explanation =
        `${names.label(first, firstIv)} ends on ${formatDate(firstIv.end)}. ` +
        `${names.label(second, secondIv)} would dig ${where} of that new surface ${plural(gap, "day")} later, ` +
        `inside the ${cfg.protectionDays}-day protection window. ${REVIEW_NOTE}`;
      suggestedAction =
        "Do the excavation before the resurfacing where possible. If it must go ahead, record a justification and confirm who restores the surface.";
    } else if (excavates(first) && excavates(second) && gap <= cfg.repeatGapDays) {
      rule = "REPEAT_EXCAVATION";
      severity = gap <= 30 ? "MEDIUM" : "LOW";
      explanation =
        `${names.label(first, firstIv)} and ${names.label(second, secondIv)} both dig ${where}, ` +
        `${plural(gap, "day")} apart, so the same stretch would be opened twice within ${cfg.repeatGapDays} days. ${REVIEW_NOTE}`;
      suggestedAction = `Combine into one dig: align ${second.id === DRAFT_ID ? "the proposed work" : second.id} with ${first.id === DRAFT_ID ? "the proposed work" : first.id}'s window, or share the trench.`;
    } else {
      return null; // e.g. dig first, then resurface: the correct order
    }
    gapDays = gap;
  }

  const caveats: string[] = [];
  for (const [p, iv] of [
    [a, ia],
    [b, ib],
  ] as const) {
    const who = p.id === DRAFT_ID ? "Proposed work" : p.id;
    if (p.locationApproximate)
      caveats.push(
        `${who}: location is approximate (±${cfg.approxToleranceM} m tolerance applied).`,
      );
    if (p.datesTentative) caveats.push(`${who}: dates are tentative.`);
    if (iv.assumedEnd)
      caveats.push(
        `${who}: no end date recorded; assumed ${cfg.assumedDurationDays} days (to ${formatDate(iv.end)}).`,
      );
  }
  const confidence: Confidence =
    caveats.length === 0 ? "HIGH" : caveats.length === 1 ? "MEDIUM" : "LOW";

  let kind: Conflict["kind"] = "CONFLICT";
  if (a.isEmergency || b.isEmergency) {
    severity = "INFO";
    caveats.push("Emergency works: shown for awareness, not flagged as a violation.");
  }
  if (linked(a, b)) {
    kind = "COORDINATED";
    severity = "INFO";
    explanation = `Coordinated as joint works ("dig once"). ${explanation.replace(REVIEW_NOTE, "").trim()}`;
    suggestedAction = "Already linked as joint works. Keep both teams on the shared window.";
  }

  const ids = [a.id, b.id].sort() as [string, string];
  return {
    id: `${rule}:${ids[0]}:${ids[1]}`,
    rule,
    kind,
    severity,
    confidence,
    projectIds: ids,
    roadId: a.location.roadId,
    overlapM,
    ...(overlapDates ? { overlapDates } : {}),
    ...(gapDays !== undefined ? { gapDays } : {}),
    explanation,
    suggestedAction,
    caveats,
  };
}

function compareConflicts(x: Conflict, y: Conflict): number {
  if (x.kind !== y.kind) return x.kind === "CONFLICT" ? -1 : 1;
  return (
    SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity] ||
    CONFIDENCE_RANK[x.confidence] - CONFIDENCE_RANK[y.confidence] ||
    (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)
  );
}

/**
 * Checks a proposed work against the register without saving anything. Returns only the flags
 * that involve the proposal, each with the other project's window for a "Join window" action.
 */
export function checkProposed(
  draft: ProjectDraft,
  projects: Project[],
  ctx: EngineContext = {},
): DetectResult {
  const cfg: EngineConfig = { ...DEFAULT_CONFIG, ...ctx.config };
  const proposed: Project = {
    ...draft,
    id: DRAFT_ID,
    status: "PROPOSED",
    actualStart: null,
    actualEnd: null,
  };
  const all = [...projects.filter((p) => p.id !== DRAFT_ID), proposed];
  const result = detect(all, ctx);
  const byId = new Map(all.map((p) => [p.id, p]));
  const conflicts = result.conflicts
    .filter((c) => c.projectIds.includes(DRAFT_ID))
    .map((c) => {
      const other = byId.get(c.projectIds[0] === DRAFT_ID ? c.projectIds[1] : c.projectIds[0])!;
      const canJoin =
        c.kind === "CONFLICT" &&
        (c.rule === "CONCURRENT_WORKS" || c.rule === "REPEAT_EXCAVATION") &&
        excavates(proposed) &&
        excavates(other);
      const iv = intervalOf(other, cfg);
      return canJoin && iv
        ? { ...c, joinWindow: { projectId: other.id, start: iv.start, end: iv.end } }
        : c;
    });
  return { conflicts, unchecked: result.unchecked.filter((u) => u.projectId === DRAFT_ID) };
}

/** Overdue = planned end date has passed (as of the demo date) and the work is not finished. */
export function isOverdue(p: Project, asOf: ISODate): OverdueInfo {
  const active = p.status === "PLANNED" || p.status === "IN_PROGRESS";
  if (!active || !p.plannedEnd || toDay(p.plannedEnd) >= toDay(asOf))
    return { overdue: false, daysLate: 0 };
  return { overdue: true, daysLate: daysBetween(p.plannedEnd, asOf) };
}

export function conflictsFor(conflicts: Conflict[], projectId: string): Conflict[] {
  return conflicts.filter((c) => c.projectIds.includes(projectId));
}

interface Namer {
  road(id: string): string;
  label(p: Project, iv: Interval): string;
}

function namer(ctx: EngineContext): Namer {
  const roads = new Map((ctx.roads ?? []).map((r) => [r.id, r.name]));
  const depts = new Map((ctx.departments ?? []).map((d) => [d.id, d.shortName]));
  return {
    road: (id) => roads.get(id) ?? id,
    label: (p, iv) => {
      const who = p.id === DRAFT_ID ? "proposed" : p.id;
      return `${p.title} (${who}, ${depts.get(p.departmentId) ?? p.departmentId}, ${formatRange(iv.start, iv.end)})`;
    },
  };
}
