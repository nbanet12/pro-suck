import type { LatLng, ParticipantInput } from "./types";

export const SEARCH_RADIUS_KM = 10;
export const TARGET_MIN_MINUTES = 10;
export const TARGET_MAX_MINUTES = 20;
export const MARRIED_WEIGHT = 1.45;
export const SINGLE_WEIGHT = 1;

const EARTH_KM = 6371;

export function participantWeight(married: boolean) {
  return married ? MARRIED_WEIGHT : SINGLE_WEIGHT;
}

export function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function weightedCentroid(people: ParticipantInput[]): LatLng {
  const total = people.reduce((sum, person) => sum + participantWeight(person.married), 0);
  return {
    lat:
      people.reduce(
        (sum, person) => sum + person.lat * participantWeight(person.married),
        0,
      ) / total,
    lng:
      people.reduce(
        (sum, person) => sum + person.lng * participantWeight(person.married),
        0,
      ) / total,
  };
}

export function destinationPoint(
  from: LatLng,
  distanceKm: number,
  bearingDeg: number,
): LatLng {
  const angular = distanceKm / EARTH_KM;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(from.lat);
  const lng1 = toRad(from.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

export function densifyPath(path: LatLng[], minPoints = 96): LatLng[] {
  const cleaned = path
    .map((point) => ({ lat: point.lat, lng: point.lng }))
    .filter((point, index, arr) => {
      if (index === 0) return true;
      return haversineKm(point, arr[index - 1]) > 0.04;
    });

  if (cleaned.length < 2) return cleaned;

  const result: LatLng[] = [];
  const segments = cleaned.length - 1;
  const perSegment = Math.max(2, Math.ceil(minPoints / segments));
  for (let i = 0; i < segments; i += 1) {
    const from = cleaned[i];
    const to = cleaned[i + 1];
    for (let j = 0; j < perSegment; j += 1) {
      const t = j / perSegment;
      result.push({
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
      });
    }
  }
  result.push(cleaned[cleaned.length - 1]);
  return result;
}

export function bandDistance(minutes: number) {
  if (minutes < TARGET_MIN_MINUTES) return TARGET_MIN_MINUTES - minutes;
  if (minutes > TARGET_MAX_MINUTES) return minutes - TARGET_MAX_MINUTES;
  return 0;
}

export function scoreWeightedTimes(weightedMinutes: number[]) {
  const mean =
    weightedMinutes.reduce((sum, value) => sum + value, 0) / weightedMinutes.length;
  const spread = Math.max(...weightedMinutes) - Math.min(...weightedMinutes);
  const outOfBand = weightedMinutes.reduce((sum, value) => sum + bandDistance(value), 0);
  const longest = Math.max(...weightedMinutes);
  return {
    mean,
    spread,
    score: spread * 2.3 + outOfBand * 1.7 + longest * 0.12,
  };
}

export function estimateTransitMinutes(from: LatLng, to: LatLng) {
  const km = haversineKm(from, to);
  if (km < 0.4) return Math.max(4, Math.round(km / 0.075));
  const access = 6;
  const ride = (km / 28) * 60;
  return Math.round(access + ride);
}

export function estimatePath(from: LatLng, to: LatLng): LatLng[] {
  const mid = {
    lat: (from.lat + to.lat) / 2,
    lng: (from.lng + to.lng) / 2,
  };
  const km = Math.max(haversineKm(from, to), 0.2);
  const offset = destinationPoint(mid, km * 0.18, 90);
  return densifyPath([from, offset, to]);
}
