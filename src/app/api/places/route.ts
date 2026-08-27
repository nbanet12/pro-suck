import { kakaoKeyUsable, searchKakaoPlaces } from "@/lib/kakao";
import { searchLocalStations, stationLabel } from "@/lib/stations";
import type { PlaceHit } from "@/lib/types";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 1) {
    return Response.json({ places: [] as PlaceHit[] });
  }

  const local = searchLocalStations(query).map((station) => ({
    id: `st-${station.name}`,
    name: stationLabel(station.name),
    address: stationLabel(station.name),
    lat: station.lat,
    lng: station.lng,
    source: "station" as const,
  }));

  const kakao = (await kakaoKeyUsable()) ? await searchKakaoPlaces(query) : [];

  const merged: PlaceHit[] = [];
  const seen = new Set<string>();
  for (const place of [...local, ...kakao]) {
    const key = `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(place);
  }

  return Response.json({ places: merged.slice(0, 12) });
}
