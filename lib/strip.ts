// Pure geometry for the road timeline (components/RoadStrip.tsx): which works and flags to draw,
// the time window, the scales and the axis ticks. Days are UTC whole days (toDay in lib/dates.ts).
// A work drawn from day S to its last day E covers [S, E + 1): one day always has some width.

import { fromDay, isISODate, toDay } from "./dates";
import { DEFAULT_CONFIG, DRAFT_ID, intervalOf } from "./engine";
import type { Conflict, EngineConfig, ISODate, Project } from "./types";

export interface StripBar {
  id: string;
  project: Project;
  /** The proposed work being checked (drawn dashed, labelled "Proposed"). */
  isDraft: boolean;
  start: ISODate;
  /** Last day of the work (inclusive). */
  end: ISODate;
  /** No usable end date: drawn to start + assumedDurationDays with a fading right edge. */
  assumedEnd: boolean;
  /** First day (inclusive) and the day after the last day (exclusive). */
  startDay: number;
  endDay: number;
  fromM: number;
  toM: number;
}

export interface StripFlag {
  id: string;
  conflict: Conflict;
  /** "overlap": same metres at the same time. "gap": the days between two sequential works. */
  shape: "overlap" | "gap";
  coordinated: boolean;
  /** Inclusive start, exclusive end, like StripBar. A gap may be zero days wide. */
  startDay: number;
  endDay: number;
  fromM: number;
  toM: number;
  /** Overlapping days, or the gap in days as the engine reports it. */
  days: number;
}

export interface StripWindow {
  /** First day shown (inclusive) and the day after the last day shown (exclusive). */
  startDay: number;
  endDay: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The works to draw on one road: other roads, cancelled works and works with no start date are
 * skipped. The draft (if on this road) replaces any project with the draft id and comes last.
 */
export function stripBars(
  projects: Project[],
  roadId: string,
  draft?: Project | null,
  cfg: EngineConfig = DEFAULT_CONFIG,
): StripBar[] {
  const bars: StripBar[] = [];
  const seen = new Set<string>();
  for (const p of projects) {
    if (p.status === "CANCELLED" || p.id === DRAFT_ID || seen.has(p.id)) continue;
    const bar = toBar(p, roadId, false, cfg);
    if (bar) {
      bars.push(bar);
      seen.add(p.id);
    }
  }
  bars.sort((a, b) => a.startDay - b.startDay || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const draftBar = draft ? toBar(draft, roadId, true, cfg) : null;
  return draftBar ? [...bars, draftBar] : bars;
}

/** Treats any malformed date (e.g. a half-typed 6-digit year) as missing, so it cannot blow up the window. */
const isoOrNull = (d: ISODate | null): ISODate | null => (d && isISODate(d) ? d : null);

function toBar(raw: Project, roadId: string, isDraft: boolean, cfg: EngineConfig): StripBar | null {
  if (raw.location.roadId !== roadId) return null;
  const p: Project = {
    ...raw,
    plannedStart: isoOrNull(raw.plannedStart),
    plannedEnd: isoOrNull(raw.plannedEnd),
    actualStart: isoOrNull(raw.actualStart),
    actualEnd: isoOrNull(raw.actualEnd),
  };
  const start = p.actualStart ?? p.plannedStart;
  if (!start) return null;
  const iv = intervalOf(p, cfg);
  if (!iv) return null;
  const a = Number(p.location.fromM);
  const b = Number(p.location.toM);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return {
    id: p.id,
    project: p,
    isDraft,
    start: iv.start,
    end: iv.end,
    assumedEnd: iv.assumedEnd,
    startDay: toDay(iv.start),
    endDay: toDay(iv.end) + 1,
    fromM: Math.max(0, Math.min(a, b)),
    toM: Math.max(0, a, b),
  };
}

/**
 * Flags to draw over the bars. Concurrent works use the conflict's own overlap dates. Sequential
 * rules span from the day after the earlier work ends to the day the later one starts, so they
 * need both works among `bars`; flags that cannot be placed are left out.
 */
export function stripFlags(conflicts: Conflict[], bars: StripBar[], roadId: string): StripFlag[] {
  const byId = new Map(bars.map((b) => [b.id, b]));
  const flags: StripFlag[] = [];
  for (const c of conflicts) {
    if (c.roadId !== roadId) continue;
    const fromM = Math.max(0, Math.min(c.overlapM.fromM, c.overlapM.toM));
    const toM = Math.max(c.overlapM.fromM, c.overlapM.toM);
    if (!Number.isFinite(fromM) || !Number.isFinite(toM)) continue;
    const base = { id: c.id, conflict: c, coordinated: c.kind === "COORDINATED", fromM, toM };

    if (c.overlapDates) {
      const { start, end, days } = c.overlapDates;
      if (!isISODate(start) || !isISODate(end)) continue;
      const startDay = toDay(start);
      const endDay = Math.max(startDay, toDay(end)) + 1;
      flags.push({ ...base, shape: "overlap", startDay, endDay, days });
      continue;
    }
    if (c.rule === "CONCURRENT_WORKS") continue; // no overlap dates: nothing to place

    const a = byId.get(c.projectIds[0]);
    const b = byId.get(c.projectIds[1]);
    if (!a || !b) continue;
    const [first, second] =
      a.startDay < b.startDay || (a.startDay === b.startDay && a.endDay <= b.endDay)
        ? [a, b]
        : [b, a];
    const startDay = first.endDay;
    const endDay = Math.max(startDay, second.startDay);
    // gapDays = later start minus earlier (inclusive) end, as in the engine.
    const days = c.gapDays ?? second.startDay - (first.endDay - 1);
    flags.push({ ...base, shape: "gap", startDay, endDay, days });
  }
  // Gaps first, so overlap rectangles end up on top when the caller draws in order.
  return [...flags.filter((f) => f.shape === "gap"), ...flags.filter((f) => f.shape === "overlap")];
}

/**
 * Earliest start to latest end among the bars and flags, always including `asOf`, padded by
 * `padDays` on each side. Null when there is nothing dated to draw.
 */
export function stripWindow(
  bars: StripBar[],
  flags: StripFlag[],
  asOf: ISODate,
  padDays = 10,
): StripWindow | null {
  if (bars.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const s of [...bars, ...flags]) {
    min = Math.min(min, s.startDay);
    max = Math.max(max, s.endDay);
  }
  if (isISODate(asOf)) {
    const day = toDay(asOf);
    min = Math.min(min, day);
    max = Math.max(max, day + 1);
  }
  // Belt and braces: never draw more than MAX_WINDOW_DAYS, however odd the data.
  if (max - min > MAX_WINDOW_DAYS) max = min + MAX_WINDOW_DAYS;
  return { startDay: min - padDays, endDay: max + padDays };
}

/** The widest time window the strip will draw (10 years). */
export const MAX_WINDOW_DAYS = 3653;
/** The most month ticks monthTicks will ever return. */
const MAX_MONTH_TICKS = 240;

/** Maps `domain` linearly onto `range`. A zero-width domain maps everything to the middle. */
export function scaleLinear(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (value) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0));
}

/** A pixel span from a to b, widened symmetrically to at least `min` so thin marks stay visible. */
export function span(a: number, b: number, min: number): [number, number] {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi - lo >= min) return [lo, hi];
  const mid = (lo + hi) / 2;
  return [mid - min / 2, mid + min / 2];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_STEPS = [1, 2, 3, 6, 12];

export interface MonthTick {
  /** Day number of the 1st of the month. */
  day: number;
  /** "Aug", or "Jan 2027" / "Aug 2026" on January and on the first tick. */
  label: string;
}

/** Months between ticks so that ticks are at least `minPx` apart. */
export function monthStep(pxPerDay: number, minPx = 40): number {
  const monthPx = 30.44 * pxPerDay;
  return MONTH_STEPS.find((step) => step * monthPx >= minPx) ?? 12;
}

/**
 * One tick on the 1st of every `step`-th month inside [startDay, endDay). Multi-month steps are
 * aligned to January (e.g. Jan, Apr, Jul, Oct), so a January tick is never skipped.
 */
export function monthTicks(startDay: number, endDay: number, step = 1): MonthTick[] {
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay) || !(step >= 1)) return [];
  const [y0, m0] = fromDay(startDay).split("-").map(Number);
  const ticks: MonthTick[] = [];
  // Months since year 0, so stepping and alignment are plain integer maths.
  for (let n = y0 * 12 + (m0 - 1); ; n++) {
    const year = Math.floor(n / 12);
    const month = n % 12;
    const day = toDay(`${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-01`);
    if (day >= endDay || ticks.length >= MAX_MONTH_TICKS) break;
    if (day < startDay || n % step !== 0) continue;
    const withYear = month === 0 || ticks.length === 0;
    ticks.push({ day, label: withYear ? `${MONTHS[month]} ${year}` : MONTHS[month] });
  }
  return ticks;
}

/** A round metre step (1, 2, 2.5 or 5 × 10^n) giving at most `maxTicks` intervals over `maxM`. */
export function metreStep(maxM: number, maxTicks = 5): number {
  if (!Number.isFinite(maxM) || maxM <= 0) return 1;
  const ticks = Math.max(1, Math.floor(maxTicks));
  for (let exp = 0; ; exp++) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = m * 10 ** exp;
      if (maxM / step <= ticks) return step;
    }
  }
}

/** Metre ticks 0, step, 2·step… up to and including `maxM`. */
export function metreTicks(maxM: number, maxTicks = 5): number[] {
  const step = metreStep(maxM, maxTicks);
  const ticks: number[] = [];
  for (let m = 0; m <= maxM + 1e-9; m += step) ticks.push(Math.round(m * 100) / 100);
  return ticks;
}

/** Rough rendered width of a label (the app's sans font, digits and capitals). */
export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62;
}

/** The first label that fits inside `box` with `pad` on each side, or null. */
export function fitLabel(
  candidates: string[],
  box: Pick<Box, "w" | "h">,
  fontSize: number,
  pad = 4,
): string | null {
  if (box.h < fontSize + 2) return null;
  return candidates.find((t) => textWidth(t, fontSize) + 2 * pad <= box.w) ?? null;
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
