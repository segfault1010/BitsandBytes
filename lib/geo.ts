// Display-only geometry: the conflict engine never imports this file.

type LatLng = [number, number];

const EARTH_RADIUS_M = 6_371_008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two [lat, lng] points, in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function roadLengthM(coords: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1], coords[i]);
  return total;
}

function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * The part of a polyline between two chainages (metres from the first point), for drawing a
 * project's stretch on the map. Returns [] for an empty or inverted range.
 */
export function sliceRoad(coords: LatLng[], fromM: number, toM: number): LatLng[] {
  if (coords.length < 2 || toM <= fromM) return [];
  const out: LatLng[] = [];
  let walked = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const seg = haversineM(a, b);
    const segStart = walked;
    const segEnd = walked + seg;
    walked = segEnd;
    if (seg === 0 || segEnd < fromM) continue;
    if (segStart > toM) break;
    if (out.length === 0) out.push(interpolate(a, b, Math.max(0, (fromM - segStart) / seg)));
    if (segEnd <= toM) out.push(b);
    else {
      out.push(interpolate(a, b, (toM - segStart) / seg));
      break;
    }
  }
  return out.length >= 2 ? out : [];
}
