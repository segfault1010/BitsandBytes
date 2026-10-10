"use client";

// Road timeline: one road's works as rectangles of dates (across) by metres along the road (down),
// with flagged overlaps and gaps drawn on top. The time view that complements the map.
// Geometry lives in lib/strip.ts. The viewBox width follows the container width, so 11-unit
// text renders at 11 px on a phone as on a laptop; labels that do not fit are skipped.

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { formatDate, formatRange, fromDay, isISODate, toDay } from "@/lib/dates";
import { DEFAULT_CONFIG, DRAFT_ID } from "@/lib/engine";
import { MAP_COLOR, RULE_LABEL, STATUS_COLOR, STATUS_LABEL, WORK_TYPE_LABEL } from "@/lib/labels";
import {
  boxesIntersect,
  fitLabel,
  metreTicks,
  monthStep,
  monthTicks,
  scaleLinear,
  span,
  stripBars,
  stripFlags,
  stripWindow,
  textWidth,
  type Box,
  type StripBar,
  type StripFlag,
  type StripWindow,
} from "@/lib/strip";
import type { Conflict, ISODate, Project, Road, Status } from "@/lib/types";

export interface RoadStripProps {
  road: Road;
  /** Works to draw. Other roads and cancelled works are ignored. */
  projects: Project[];
  /** Flags to highlight (those on this road; others are ignored). */
  conflicts: Conflict[];
  /** Demo "today", drawn as a vertical "Demo date" line. */
  asOf: ISODate;
  /** Optional proposed work (id "DRAFT"), drawn with a dashed outline. */
  draft?: Project | null;
  /** Optional project to emphasise; the other works are dimmed. */
  highlightId?: string;
  /** Chart height in px. */
  height?: number;
}

const FONT = 11;
const DEFAULT_WIDTH = 800;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 140;
const MARGIN = { top: 22, right: 12, bottom: 24 };

const INK = "#0f172a"; // slate-900
const MUTED = "#64748b"; // slate-500
const GRID = "#e2e8f0"; // slate-200
const FRAME = "#cbd5e1"; // slate-300
const HALO = "#ffffff";
const RED = MAP_COLOR.overlap;
const BLUE = MAP_COLOR.coordinated;
const RED_INK = "#7f1d1d"; // red-900
const BLUE_INK = "#1e3a8a"; // blue-900
const BAR_FILL_OPACITY = 0.38;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** '1–20 Aug 2026', or '17 Dec 2026 – 5 Jan 2027' across a year end. */
function rangeText(start: ISODate, end: ISODate): string {
  return start.slice(0, 4) === end.slice(0, 4)
    ? `${formatRange(start, end)} ${start.slice(0, 4)}`
    : `${formatDate(start, true)} – ${formatDate(end, true)}`;
}

const workName = (id: string) => (id === DRAFT_ID ? "the proposed work" : id);

function barTitle(b: StripBar): string {
  const p = b.project;
  const lines = [
    `${b.isDraft ? "Proposed work" : b.id}: ${p.title}`,
    `${rangeText(b.start, b.end)} · ${b.fromM}–${b.toM} m`,
    `${b.isDraft ? "Proposed" : STATUS_LABEL[p.status]} · ${WORK_TYPE_LABEL[p.workType]}`,
  ];
  if (b.assumedEnd)
    lines.push(`No end date recorded: ${DEFAULT_CONFIG.assumedDurationDays} days assumed`);
  return lines.join("\n");
}

function flagTitle(f: StripFlag): string {
  const c = f.conflict;
  const names = c.projectIds.map(workName).join(" and ");
  const who = names.charAt(0).toUpperCase() + names.slice(1);
  const when =
    f.shape === "overlap" && c.overlapDates
      ? `${rangeText(c.overlapDates.start, c.overlapDates.end)} (${plural(f.days, "day")} at once)`
      : `${plural(f.days, "day")} apart`;
  return [
    `${f.coordinated ? "Coordinated: " : ""}${RULE_LABEL[c.rule]}`,
    `${who} · ${when}`,
    `Shared stretch ${f.fromM}–${f.toM} m`,
  ].join("\n");
}

function summary(
  road: Road,
  bars: StripBar[],
  flags: StripFlag[],
  win: StripWindow,
  maxM: number,
  asOf: ISODate,
): string {
  const works = bars.filter((b) => !b.isDraft);
  const draft = bars.find((b) => b.isDraft);
  const describe = (b: StripBar) =>
    `${b.id} ${b.project.title}, ${b.fromM}–${b.toM} m, ${rangeText(b.start, b.end)}${b.assumedEnd ? " (end assumed)" : ""}`;
  const parts = [
    `Road timeline for ${road.name}: dates run left to right from ${formatDate(fromDay(win.startDay), true)} to ${formatDate(fromDay(win.endDay - 1), true)}; metres along the road run top to bottom, 0 to ${Math.round(maxM)} m.`,
    works.length > 0 ? `${plural(works.length, "work")}: ${works.map(describe).join("; ")}.` : "",
    draft
      ? `Proposed work: ${draft.fromM}–${draft.toM} m, ${rangeText(draft.start, draft.end)}.`
      : "",
    flags.length > 0
      ? `${plural(flags.length, "flag")}: ${flags
          .map((f) => flagTitle(f).replace(/\n/g, ", "))
          .join("; ")}.`
      : "No flags.",
    `Demo date ${formatDate(asOf, true)}.`,
  ];
  return parts.filter(Boolean).join(" ");
}

export function RoadStrip({
  road,
  projects,
  conflicts,
  asOf,
  draft = null,
  highlightId,
  height = 260,
}: RoadStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const uid = `strip-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setMeasured((prev) => (prev === w ? prev : w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const bars = stripBars(projects, road.id, draft);
  const flags = stripFlags(conflicts, bars, road.id);
  const win = stripWindow(bars, flags, asOf);

  return (
    <div ref={ref} className="w-full">
      {win ? (
        <StripChart
          uid={uid}
          road={road}
          bars={bars}
          flags={flags}
          win={win}
          asOf={asOf}
          highlightId={highlightId}
          width={Math.max(MIN_WIDTH, measured ?? DEFAULT_WIDTH)}
          height={Math.max(MIN_HEIGHT, height)}
        />
      ) : (
        <p className="rounded border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
          No dated works on this road.
        </p>
      )}
    </div>
  );
}

interface ChartProps {
  uid: string;
  road: Road;
  bars: StripBar[];
  flags: StripFlag[];
  win: StripWindow;
  asOf: ISODate;
  highlightId?: string;
  width: number;
  height: number;
}

/** Where a label may go: its anchor point and text-anchor. */
interface Spot {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

interface PlacedLabel extends Spot {
  key: string;
  text: string;
  color: string;
}

/** Label spots inside a work's box: left middle first, then top/bottom left, then the right. */
function barSpots(b: Box): Spot[] {
  const inset = FONT / 2 + 3;
  const mid = b.y + b.h / 2;
  const tall = b.h >= 2 * (FONT + 4);
  const left = b.x + 4;
  const right = b.x + b.w - 4;
  return [
    { x: left, y: mid, anchor: "start" },
    ...(tall
      ? ([
          { x: left, y: b.y + inset, anchor: "start" },
          { x: left, y: b.y + b.h - inset, anchor: "start" },
        ] as const)
      : []),
    { x: right, y: mid, anchor: "end" },
    ...(tall
      ? ([
          { x: right, y: b.y + inset, anchor: "end" },
          { x: right, y: b.y + b.h - inset, anchor: "end" },
        ] as const)
      : []),
  ];
}

function StripChart({
  uid,
  road,
  bars,
  flags,
  win,
  asOf,
  highlightId,
  width: W,
  height: H,
}: ChartProps) {
  const maxM = Math.max(
    road.lengthM || 0,
    ...bars.map((b) => b.toM),
    ...flags.map((f) => f.toM),
    1,
  );
  const x0 = Math.ceil(textWidth(`${Math.round(maxM)} m`, FONT)) + 12;
  const x1 = W - MARGIN.right;
  const y0 = MARGIN.top;
  const y1 = H - MARGIN.bottom;
  const x = scaleLinear([win.startDay, win.endDay], [x0, x1]);
  const y = scaleLinear([0, maxM], [y0, y1]);
  const pxPerDay = (x1 - x0) / Math.max(1, win.endDay - win.startDay);

  const boxOf = (startDay: number, endDay: number, fromM: number, toM: number, minW: number) => {
    const [left, right] = span(x(startDay), x(endDay), minW);
    const [top, bottom] = span(y(fromM), y(toM), 2);
    return { x: left, y: top, w: right - left, h: bottom - top };
  };

  // Axes.
  const months = monthTicks(win.startDay, win.endDay, monthStep(pxPerDay));
  const monthLabels: { day: number; x: number; label: string }[] = [];
  let lastRight = -Infinity;
  for (const t of months) {
    const tx = x(t.day) + 3;
    const right = tx + textWidth(t.label, FONT);
    if (tx < lastRight + 6 || right > W - 2) continue;
    monthLabels.push({ day: t.day, x: tx, label: t.label });
    lastRight = right;
  }
  const metres = metreTicks(maxM, Math.max(2, Math.min(6, Math.floor((y1 - y0) / 36))));
  const lastTick = metres[metres.length - 1] ?? 0;
  const showEnd = y1 - y(lastTick) >= FONT + 3;

  // Marks, in drawing order: the highlighted work on top of the others, the draft last.
  const hasHighlight = !!highlightId && bars.some((b) => b.id === highlightId);
  const ordered = [
    ...bars.filter((b) => b.id !== highlightId && !b.isDraft),
    ...bars.filter((b) => b.id === highlightId && !b.isDraft),
    ...bars.filter((b) => b.isDraft),
  ];
  const barBoxes = new Map(
    ordered.map((b) => [b.id, boxOf(b.startDay, b.endDay, b.fromM, b.toM, 2)]),
  );
  const flagBoxes = new Map(
    flags.map((f) => [f.id, boxOf(f.startDay, f.endDay, f.fromM, f.toM, 4)]),
  );
  const fadeColors = [...new Set(bars.filter((b) => b.assumedEnd).map(colorOf))];

  // Labels: flags first, then the draft, the highlighted work and the rest. Each label tries its
  // spots in order and is skipped if none is free, so labels never collide.
  const placed: Box[] = [];
  const labels: PlacedLabel[] = [];
  const place = (key: string, box: Box, candidates: string[], color: string, spots: Spot[]) => {
    const text = fitLabel(candidates, box, FONT);
    if (!text) return;
    const tw = textWidth(text, FONT);
    for (const s of spots) {
      const left = s.anchor === "start" ? s.x : s.anchor === "end" ? s.x - tw : s.x - tw / 2;
      const footprint = { x: left, y: s.y - FONT / 2 - 1, w: tw, h: FONT + 2 };
      if (placed.some((p) => boxesIntersect(p, footprint))) continue;
      placed.push(footprint);
      labels.push({ key, text, color, ...s });
      return;
    }
  };
  for (const f of [...flags].reverse()) {
    const box = flagBoxes.get(f.id)!;
    const candidates =
      f.shape === "overlap" && f.coordinated
        ? ["Coordinated", `${f.days}d`]
        : [plural(f.days, "day"), `${f.days}d`];
    place(`flag-${f.id}`, box, candidates, f.coordinated ? BLUE_INK : RED_INK, [
      { x: box.x + box.w / 2, y: box.y + box.h / 2, anchor: "middle" },
    ]);
  }
  for (const b of [...ordered].reverse()) {
    place(
      `bar-${b.id}`,
      barBoxes.get(b.id)!,
      b.isDraft ? ["Proposed"] : [b.id],
      INK,
      barSpots(barBoxes.get(b.id)!),
    );
  }

  const asOfX = isISODate(asOf) ? x(toDay(asOf) + 0.5) : null;
  const demoLabelW = textWidth("Demo date", FONT);
  const demoLabelX =
    asOfX === null ? 0 : Math.min(Math.max(asOfX, demoLabelW / 2 + 2), W - demoLabelW / 2 - 2);

  const haloText = {
    stroke: HALO,
    strokeWidth: 3,
    strokeLinejoin: "round" as const,
    paintOrder: "stroke",
    fontSize: FONT,
  };

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={summary(road, bars, flags, win, maxM, asOf)}
        className="block select-none"
        fontFamily="inherit"
      >
        <defs>
          <clipPath id={`${uid}-clip`}>
            <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} />
          </clipPath>
          {/* "/" hatch over resurfacing works, so "resurfaced" reads differently from "dug". */}
          <pattern
            id={`${uid}-hatch`}
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={6} stroke={INK} strokeOpacity={0.45} strokeWidth={1.5} />
          </pattern>
          {/* "\" hatch for flagged gaps between sequential works. */}
          {[
            ["red", RED],
            ["blue", BLUE],
          ].map(([name, color]) => (
            <pattern
              key={name}
              id={`${uid}-gap-${name}`}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-45)"
            >
              <rect width={6} height={6} fill={color} fillOpacity={0.1} />
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke={color}
                strokeOpacity={0.6}
                strokeWidth={1.5}
              />
            </pattern>
          ))}
          {/* Fading right edge for works with no recorded end date. */}
          {fadeColors.map((color) => (
            <linearGradient
              key={color}
              id={`${uid}-fade-${color.slice(1)}`}
              x1={0}
              x2={1}
              y1={0}
              y2={0}
            >
              <stop offset="0" stopColor={color} stopOpacity={1} />
              <stop offset="0.6" stopColor={color} stopOpacity={1} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Plot area, grid and axes. */}
        <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#ffffff" stroke={FRAME} />
        <g aria-hidden="true">
          {metres.map((m) => (
            <g key={`m-${m}`}>
              {/* No grid line hugging the frame: it would read as a double border. */}
              {y(m) > y0 + 6 && y(m) < y1 - 6 && (
                <line x1={x0} x2={x1} y1={y(m)} y2={y(m)} stroke={GRID} />
              )}
              <text
                x={x0 - 6}
                y={y(m)}
                textAnchor="end"
                dominantBaseline="central"
                fill={MUTED}
                fontSize={FONT}
              >
                {m} m
              </text>
            </g>
          ))}
          {showEnd && (
            <text
              x={x0 - 6}
              y={y1}
              textAnchor="end"
              dominantBaseline="central"
              fill={MUTED}
              fontSize={FONT}
            >
              {Math.round(maxM)} m
            </text>
          )}
          {months.map((t) => (
            <g key={`t-${t.day}`}>
              {x(t.day) > x0 + 6 && x(t.day) < x1 - 6 && (
                <line x1={x(t.day)} x2={x(t.day)} y1={y0} y2={y1} stroke={GRID} />
              )}
              <line x1={x(t.day)} x2={x(t.day)} y1={y1} y2={y1 + 4} stroke={FRAME} />
            </g>
          ))}
          {monthLabels.map((t) => (
            <text key={`tl-${t.day}`} x={t.x} y={y1 + 15} fill={MUTED} fontSize={FONT}>
              {t.label}
            </text>
          ))}
        </g>

        {/* Works. */}
        <g clipPath={`url(#${uid}-clip)`}>
          {ordered.map((b) => (
            <BarShape
              key={b.id}
              bar={b}
              box={barBoxes.get(b.id)!}
              uid={uid}
              emphasis={hasHighlight && b.id === highlightId}
              dim={hasHighlight && b.id !== highlightId && !b.isDraft}
            />
          ))}

          {/* Flags: gaps, then overlaps on top. */}
          {flags.map((f) => {
            const box = flagBoxes.get(f.id)!;
            const color = f.coordinated ? BLUE : RED;
            return (
              <g key={f.id} data-conflict-id={f.id}>
                <title>{flagTitle(f)}</title>
                {f.shape === "gap" ? (
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    fill={`url(#${uid}-gap-${f.coordinated ? "blue" : "red"})`}
                    stroke={color}
                    strokeOpacity={0.8}
                    strokeWidth={1.25}
                  />
                ) : (
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    rx={2}
                    fill={color}
                    fillOpacity={0.3}
                    stroke={color}
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Demo date. */}
        {asOfX !== null && (
          <g>
            <title>{`Demo date: ${formatDate(asOf, true)}`}</title>
            <line x1={asOfX} x2={asOfX} y1={y0 - 4} y2={y1} stroke={INK} strokeWidth={1.5} />
            <text
              x={demoLabelX}
              y={y0 - 8}
              textAnchor="middle"
              fill={INK}
              fontSize={FONT}
              fontWeight={600}
            >
              Demo date
            </text>
          </g>
        )}

        {/* Labels on top, with a white halo so they read over fills and hatching. */}
        <g aria-hidden="true" pointerEvents="none">
          {labels.map((l) => (
            <text
              key={l.key}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              dominantBaseline="central"
              fill={l.color}
              fontWeight={600}
              {...haloText}
            >
              {l.text}
            </text>
          ))}
        </g>
      </svg>
      <Legend road={road} bars={bars} flags={flags} asOf={asOf} />
    </figure>
  );
}

function colorOf(b: StripBar): string {
  return b.isDraft ? MAP_COLOR.draft : STATUS_COLOR[b.project.status];
}

function BarShape({
  bar: b,
  box,
  uid,
  emphasis,
  dim,
}: {
  bar: StripBar;
  box: Box;
  uid: string;
  emphasis: boolean;
  dim: boolean;
}) {
  const color = colorOf(b);
  const fade = `url(#${uid}-fade-${color.slice(1)})`;
  const stroke = emphasis ? INK : b.assumedEnd ? fade : color;
  const outline = {
    fill: "none",
    stroke,
    strokeWidth: emphasis ? 2.5 : b.isDraft ? 1.75 : 1.25,
    strokeDasharray: b.isDraft ? "6 4" : undefined,
  };
  const { x, y, w, h } = box;
  return (
    <g opacity={dim ? 0.5 : 1} data-project-id={b.id}>
      <title>{barTitle(b)}</title>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        fill={b.assumedEnd ? fade : color}
        fillOpacity={b.isDraft ? 0.07 : BAR_FILL_OPACITY}
      />
      {b.project.workType === "RESURFACING" && (
        <rect x={x} y={y} width={w} height={h} rx={2} fill={`url(#${uid}-hatch)`} />
      )}
      {b.assumedEnd ? (
        // Open on the right: the end date is an assumption.
        <path d={`M${x + w} ${y}H${x}V${y + h}H${x + w}`} {...outline} />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx={2} {...outline} />
      )}
    </g>
  );
}

function Swatch({ style }: { style: CSSProperties }) {
  return (
    <span aria-hidden="true" className="inline-block h-3 w-5 shrink-0 rounded-sm" style={style} />
  );
}

function Legend({
  road,
  bars,
  flags,
  asOf,
}: {
  road: Road;
  bars: StripBar[];
  flags: StripFlag[];
  asOf: ISODate;
}) {
  const order: Status[] = ["PROPOSED", "PLANNED", "IN_PROGRESS", "COMPLETED"];
  const statuses = order.filter((s) => bars.some((b) => !b.isDraft && b.project.status === s));
  const conflictFlags = flags.filter((f) => !f.coordinated);
  const items: { key: string; swatch: CSSProperties; text: string }[] = [
    ...statuses.map((s) => ({
      key: s,
      swatch: { backgroundColor: `${STATUS_COLOR[s]}61`, border: `1px solid ${STATUS_COLOR[s]}` },
      text: STATUS_LABEL[s],
    })),
  ];
  if (bars.some((b) => b.project.workType === "RESURFACING"))
    items.push({
      key: "hatch",
      swatch: {
        backgroundColor: "#f1f5f9",
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(15,23,42,.5) 0 1.5px, transparent 1.5px 4.5px)",
        border: `1px solid ${FRAME}`,
      },
      text: "Hatched: resurfacing",
    });
  if (conflictFlags.some((f) => f.shape === "overlap"))
    items.push({
      key: "overlap",
      swatch: { backgroundColor: `${RED}4d`, border: `2px solid ${RED}` },
      text: "Red box: flagged overlap (same metres, same days)",
    });
  if (conflictFlags.some((f) => f.shape === "gap"))
    items.push({
      key: "gap",
      swatch: {
        backgroundColor: `${RED}1a`,
        backgroundImage: `repeating-linear-gradient(45deg, ${RED}99 0 1.5px, transparent 1.5px 4.5px)`,
        border: `1px solid ${RED}`,
      },
      text: "Red hatched band: flagged gap between works",
    });
  if (flags.some((f) => f.coordinated))
    items.push({
      key: "coordinated",
      swatch: { backgroundColor: `${BLUE}4d`, border: `2px solid ${BLUE}` },
      text: "Blue: coordinated joint works",
    });
  if (bars.some((b) => b.isDraft))
    items.push({
      key: "draft",
      swatch: { backgroundColor: "#11182712", border: `1.5px dashed ${MAP_COLOR.draft}` },
      text: "Dashed: proposed work",
    });
  if (bars.some((b) => b.assumedEnd))
    items.push({
      key: "assumed",
      swatch: {
        backgroundImage: `linear-gradient(to right, ${MUTED}80 55%, transparent)`,
        borderLeft: `1px solid ${MUTED}`,
      },
      text: `Fading edge: no end date (${DEFAULT_CONFIG.assumedDurationDays} days assumed)`,
    });
  items.push({
    key: "asof",
    swatch: {
      background: `linear-gradient(to right, transparent 9px, ${INK} 9px 11px, transparent 11px)`,
    },
    text: `Line: demo date (${formatDate(asOf, true)})`,
  });

  return (
    <figcaption className="mt-2 text-xs text-slate-600">
      <p className="text-slate-500">
        Across: dates. Down: metres along {road.name} (0 m at the top). Hover a shape for details.
      </p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <Swatch style={item.swatch} />
            {item.text}
          </li>
        ))}
      </ul>
    </figcaption>
  );
}
