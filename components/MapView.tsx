"use client";

// Leaflet map of roads and project stretches. Display only: load it through components/Map.tsx,
// which disables server rendering and catches errors so a map failure never breaks the page.

import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { sliceRoad } from "@/lib/geo";
import { MAP_COLOR } from "@/lib/labels";
import type { Road } from "@/lib/types";

export interface MapSegment {
  key: string;
  roadId: string;
  fromM: number;
  toM: number;
  color: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
  tooltip?: string;
  /** Clicking the segment navigates here. */
  href?: string;
}

export interface MapViewProps {
  roads: Road[];
  /** Drawn in order, so put halos first and highlights last. */
  segments: MapSegment[];
  /** Fit the view to these roads (default: all roads). */
  focusRoadIds?: string[];
  height?: number;
}

type LatLng = [number, number];

/**
 * Fits the view to the given points. The container can still be laying out when the map mounts
 * (Leaflet then measures 0×0 and jumps to max zoom), so re-measure and re-fit whenever it resizes.
 */
function FitBounds({ boundsKey }: { boundsKey: string }) {
  const map = useMap();
  useEffect(() => {
    const points = JSON.parse(boundsKey) as LatLng[];
    const fit = () => {
      map.invalidateSize();
      if (points.length > 0) map.fitBounds(points, { padding: [24, 24], maxZoom: 17 });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, boundsKey]);
  return null;
}

export default function MapView({ roads, segments, focusRoadIds, height = 360 }: MapViewProps) {
  const router = useRouter();
  const [tilesFailed, setTilesFailed] = useState(false);
  const roadById = useMemo(() => new Map(roads.map((r) => [r.id, r])), [roads]);

  const focus = focusRoadIds?.length ? roads.filter((r) => focusRoadIds.includes(r.id)) : roads;
  const boundsKey = JSON.stringify(focus.flatMap((r) => r.coords));
  const initialCenter: LatLng = focus[0]?.coords[0] ?? [0, 0];

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
      style={{ height }}
    >
      <MapContainer
        center={initialCenter}
        zoom={15}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
        <FitBounds boundsKey={boundsKey} />
        {roads.map((r) => (
          <Polyline
            key={`road-${r.id}`}
            positions={r.coords}
            pathOptions={{ color: MAP_COLOR.road, weight: 4, opacity: 0.45 }}
          >
            <Tooltip sticky>{r.name}</Tooltip>
          </Polyline>
        ))}
        {segments.map((s) => {
          const road = roadById.get(s.roadId);
          const positions = road ? sliceRoad(road.coords, s.fromM, s.toM) : [];
          if (positions.length < 2) return null;
          return (
            <Polyline
              key={s.key}
              positions={positions}
              pathOptions={{
                color: s.color,
                weight: s.weight ?? 6,
                opacity: s.opacity ?? 0.9,
                dashArray: s.dashArray,
              }}
              eventHandlers={s.href ? { click: () => router.push(s.href!) } : undefined}
            >
              {s.tooltip && <Tooltip sticky>{s.tooltip}</Tooltip>}
            </Polyline>
          );
        })}
      </MapContainer>
      {tilesFailed && (
        <p className="absolute left-2 top-2 z-[1000] rounded bg-white/95 px-2 py-1 text-xs text-slate-700 shadow">
          Map tiles unavailable. Roads are still drawn, and the list is complete.
        </p>
      )}
    </div>
  );
}
