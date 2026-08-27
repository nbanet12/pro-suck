import type { PlaceHit } from "./types";
import { isStationName } from "./stations";

function normalize(value: string) {
  return value.trim().replace(/\s+/g, "").replace(/역$/, "");
}

export function pickBestPlace(query: string, places: PlaceHit[]): PlaceHit | null {
  const stations = places.filter((place) => isStationName(place.name));
  if (stations.length === 0) return null;
  const needle = normalize(query);
  if (!needle) return null;

  const exact = stations.find((place) => normalize(place.name) === needle);
  if (exact) return exact;

  const prefix = stations.find((place) => {
    const name = normalize(place.name);
    return name.startsWith(needle) || needle.startsWith(name);
  });
  if (prefix && needle.length >= 2) return prefix;

  return null;
}

export async function lookupPlace(query: string): Promise<PlaceHit | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const response = await fetch(`/api/places?q=${encodeURIComponent(trimmed)}`);
  if (!response.ok) return null;
  const json = (await response.json()) as { places: PlaceHit[] };
  return pickBestPlace(trimmed, json.places ?? []);
}
