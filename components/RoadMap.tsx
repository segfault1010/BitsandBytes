"use client";

// The safe way to show a map: client-only (Leaflet needs `window`) and wrapped in an error
// boundary, so if the map breaks the rest of the page keeps working.

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { MapViewProps } from "./MapView";

export type { MapSegment } from "./MapView";

const LazyMapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <MapPlaceholder text="Loading map…" />,
});

function MapPlaceholder({ text, height = 360 }: { text: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500"
      style={{ height }}
    >
      {text}
    </div>
  );
}

class MapErrorBoundary extends Component<
  { children: ReactNode; height?: number },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[map] failed to render:", error);
  }
  render() {
    if (this.state.failed)
      return (
        <MapPlaceholder text="Map unavailable. The list is complete." height={this.props.height} />
      );
    return this.props.children;
  }
}

/** Named RoadMap (not Map) so importing it never shadows the global Map constructor. */
export function RoadMap(props: MapViewProps) {
  return (
    <MapErrorBoundary height={props.height}>
      <LazyMapView {...props} />
    </MapErrorBoundary>
  );
}
