/**
 * Nearest Neighbor TSP heuristic.
 * Starts from `origin` and greedily picks the closest unvisited point.
 * Returns the ordered array of points (including origin at position 0).
 */
export type GeoPoint = {
  lat: number;
  lng: number;
  index: number; // original index in the input array
};

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function nearestNeighborTSP(origin: GeoPoint, stops: GeoPoint[]): GeoPoint[] {
  if (stops.length === 0) return [origin];

  const unvisited = [...stops];
  const route: GeoPoint[] = [origin];
  let current = origin;

  while (unvisited.length > 0) {
    let minDist = Infinity;
    let nearest = 0;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineKm(current, unvisited[i]);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    current = unvisited[nearest];
    route.push(current);
    unvisited.splice(nearest, 1);
  }

  return route;
}
