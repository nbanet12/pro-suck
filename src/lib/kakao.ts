import type { ApiStatus } from "./env";
import { envValue } from "./env";
import type { CandidateSpot, PlaceHit } from "./types";

const KAKAO_LOCAL = "https://dapi.kakao.com/v2/local";

export function kakaoRestKey() {
  return envValue("KAKAO_REST_API_KEY");
}

export function hasKakaoKey() {
  return Boolean(kakaoRestKey());
}

function kakaoHeaders() {
  const key = kakaoRestKey();
  if (!key) return null;
  return { Authorization: `KakaoAK ${key}` };
}

let kakaoOkCache: boolean | null = null;
let kakaoReasonCache = "";

function kakaoReasonFromBody(status: number, body: string) {
  if (body.includes("OPEN_MAP_AND_LOCAL")) {
    return "카카오 개발자 콘솔에서 앱의 카카오맵(로컬) API를 활성화해 주세요.";
  }
  if (status === 401 || status === 403) {
    return "카카오 REST API 키가 거부되었습니다. REST 키인지, 카카오맵 사용 설정이 켜졌는지 확인해 주세요.";
  }
  return `카카오 장소 검색이 실패했습니다. (${status})`;
}

export async function kakaoStatus(): Promise<ApiStatus> {
  if (!hasKakaoKey()) {
    return { present: false, ok: false, reason: ".env에 KAKAO_REST_API_KEY가 없습니다." };
  }
  if (kakaoOkCache === true) {
    return { present: true, ok: true, reason: "" };
  }

  const headers = kakaoHeaders();
  if (!headers) {
    return { present: false, ok: false, reason: ".env에 KAKAO_REST_API_KEY가 없습니다." };
  }

  try {
    const response = await fetch(
      `${KAKAO_LOCAL}/search/keyword.json?query=${encodeURIComponent("강남역")}&size=1`,
      { headers, cache: "no-store" },
    );
    if (response.ok) {
      kakaoOkCache = true;
      kakaoReasonCache = "";
      return { present: true, ok: true, reason: "" };
    }
    const body = await response.text();
    kakaoOkCache = false;
    kakaoReasonCache = kakaoReasonFromBody(response.status, body);
  } catch {
    kakaoOkCache = false;
    kakaoReasonCache = "카카오 서버에 연결하지 못했습니다.";
  }

  return { present: true, ok: false, reason: kakaoReasonCache };
}

export async function kakaoKeyUsable() {
  return (await kakaoStatus()).ok;
}

type KakaoDocument = {
  id?: string;
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  category_group_code?: string;
  x: string;
  y: string;
  address?: { address_name: string };
  road_address?: { address_name: string };
};

function toPlace(doc: KakaoDocument, fallbackName: string, idPrefix: string): PlaceHit {
  const name = doc.place_name || fallbackName;
  const address =
    doc.road_address_name ||
    doc.address_name ||
    doc.road_address?.address_name ||
    doc.address?.address_name ||
    name;
  return {
    id: `${idPrefix}-${doc.id || `${doc.y}-${doc.x}`}`,
    name,
    address,
    lat: Number(doc.y),
    lng: Number(doc.x),
    source: "kakao",
  };
}

async function kakaoGet(path: string) {
  const headers = kakaoHeaders();
  if (!headers) return [];
  const response = await fetch(`${KAKAO_LOCAL}${path}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) return [];
  const json = (await response.json()) as { documents?: KakaoDocument[] };
  return json.documents ?? [];
}

export async function searchKakaoPlaces(query: string): Promise<PlaceHit[]> {
  const encoded = encodeURIComponent(query);
  const stationQuery = query.trim().endsWith("역") ? query.trim() : `${query.trim()}역`;
  const encodedStation = encodeURIComponent(stationQuery);
  const [keyword, station, address] = await Promise.all([
    kakaoGet(`/search/keyword.json?query=${encoded}&size=8`),
    stationQuery === query.trim()
      ? Promise.resolve([] as KakaoDocument[])
      : kakaoGet(`/search/keyword.json?query=${encodedStation}&size=6`),
    kakaoGet(`/search/address.json?query=${encoded}&size=5`),
  ]);

  const places = [
    ...station.map((doc) => toPlace(doc, stationQuery, "st")),
    ...keyword.map((doc) => toPlace(doc, query, "kw")),
    ...address.map((doc) => toPlace(doc, query, "ad")),
  ];

  const seen = new Set<string>();
  return places.filter((place) => {
    const key = `${place.name}-${place.lat.toFixed(4)}-${place.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchKakaoCategory(
  lat: number,
  lng: number,
  category: string,
  radiusM = 10000,
) {
  const docs = await kakaoGet(
    `/search/category.json?category_group_code=${category}&y=${lat}&x=${lng}&radius=${radiusM}&sort=distance&size=15`,
  );
  return docs.map((doc) => toPlace(doc, doc.place_name || "장소", "cat"));
}

export async function searchKakaoNearbyStations(
  lat: number,
  lng: number,
  radiusM = 10000,
): Promise<CandidateSpot[]> {
  const places = await searchKakaoCategory(lat, lng, "SW8", radiusM);
  return places.map((place) => ({
    id: place.id,
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    kind: "station" as const,
  }));
}
