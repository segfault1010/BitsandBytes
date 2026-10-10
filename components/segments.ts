// Builds map segments for project stretches. Shared by the registry, project and propose pages.

import { MAP_COLOR, STATUS_COLOR, STATUS_LABEL } from "@/lib/labels";
import type { Conflict, Project } from "@/lib/types";
import type { MapSegment } from "./RoadMap";

/** One coloured line per project, with a red halo under projects that have open flags. */
export function projectSegments(
  projects: Project[],
  opts: { flaggedIds?: Set<string>; highlightId?: string; link?: boolean } = {},
): MapSegment[] {
  const live = projects.filter((p) => p.status !== "CANCELLED");
  const halos: MapSegment[] = live
    .filter((p) => opts.flaggedIds?.has(p.id))
    .map((p) => ({
      key: `halo-${p.id}`,
      roadId: p.location.roadId,
      fromM: p.location.fromM,
      toM: p.location.toM,
      color: MAP_COLOR.flagHalo,
      weight: 14,
      opacity: 0.3,
    }));
  const lines: MapSegment[] = live.map((p) => ({
    key: `project-${p.id}`,
    roadId: p.location.roadId,
    fromM: p.location.fromM,
    toM: p.location.toM,
    color: STATUS_COLOR[p.status],
    weight: p.id === opts.highlightId ? 9 : 6,
    opacity: opts.highlightId && p.id !== opts.highlightId ? 0.45 : 0.9,
    tooltip: `${p.id} · ${p.title} (${STATUS_LABEL[p.status]})`,
    href: opts.link === false ? undefined : `/projects/${p.id}`,
  }));
  return [...halos, ...lines];
}

/** Highlights the shared stretch of each flag: red for conflicts, blue for coordinated works. */
export function overlapSegments(conflicts: Conflict[]): MapSegment[] {
  return conflicts.map((c) => ({
    key: `overlap-${c.id}`,
    roadId: c.roadId,
    fromM: c.overlapM.fromM,
    toM: c.overlapM.toM,
    color: c.kind === "COORDINATED" ? MAP_COLOR.coordinated : MAP_COLOR.overlap,
    weight: 12,
    opacity: 0.85,
    tooltip: `${c.kind === "COORDINATED" ? "Coordinated" : "Flagged"}: ${c.overlapM.lengthM} m shared`,
  }));
}
