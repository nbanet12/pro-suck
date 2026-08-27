import {
  SEARCH_RADIUS_KM,
  TARGET_MAX_MINUTES,
  TARGET_MIN_MINUTES,
  destinationPoint,
  haversineKm,
  participantWeight,
  scoreWeightedTimes,
  weightedCentroid,
} from "./geo";
import { kakaoKeyUsable, searchKakaoNearbyStations } from "./kakao";
import { stationLabel, stationsWithin } from "./stations";
import {
  canonStationName,
  hasSubwayStation,
  nearestSubwayStation,
  searchSubwayRoute,
  subwayMinutes,
  subwayStationCoord,
} from "./subway-graph";
import type { CandidateSpot, MeetResult, ParticipantInput, PersonRoute } from "./types";

export class TransitApiError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "TransitApiError";
    this.status = status;
  }
}

const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const OFFSET_KM = [2.2, 4.5, 7];

function asGraphSpot(name: string, lat: number, lng: number, id: string, kind: CandidateSpot["kind"]): CandidateSpot | null {
  const key = canonStationName(name);
  if (!hasSubwayStation(key)) return null;
  const coord = subwayStationCoord(key);
  if (!coord) return null;
  return {
    id,
    name: stationLabel(key),
    address: `${stationLabel(key)} 일대`,
    lat: coord.lat,
    lng: coord.lng,
    kind,
  };
}

function dedupeCandidates(spots: CandidateSpot[]) {
  const kept: CandidateSpot[] = [];
  for (const spot of spots) {
    const duplicate = kept.some((item) => haversineKm(item, spot) < 0.22);
    if (!duplicate) kept.push(spot);
  }
  return kept;
}

async function collectCandidates(center: { lat: number; lng: number }, useKakao: boolean) {
  const local = stationsWithin(center, SEARCH_RADIUS_KM)
    .map((station) => asGraphSpot(station.name, station.lat, station.lng, `st-${station.name}`, "station"))
    .filter((spot): spot is CandidateSpot => Boolean(spot));

  const kakaoStations = useKakao
    ? (await searchKakaoNearbyStations(center.lat, center.lng, SEARCH_RADIUS_KM * 1000))
        .map((place) => asGraphSpot(place.name, place.lat, place.lng, place.id, "station"))
        .filter((spot): spot is CandidateSpot => Boolean(spot))
    : [];

  const offsets = OFFSET_KM.flatMap((km) =>
    BEARINGS.map((bearing) => {
      const point = destinationPoint(center, km, bearing);
      const snapped = nearestSubwayStation(point);
      return asGraphSpot(snapped.name, snapped.lat, snapped.lng, `off-${km}-${bearing}`, "station");
    }),
  )
    .filter((spot): spot is CandidateSpot => Boolean(spot))
    .filter((spot) => haversineKm(center, spot) <= SEARCH_RADIUS_KM);

  const snapped = nearestSubwayStation(center);
  const centerSpot = asGraphSpot(snapped.name, snapped.lat, snapped.lng, "center", "station");

  return dedupeCandidates([centerSpot, ...kakaoStations, ...local, ...offsets].filter((spot): spot is CandidateSpot => Boolean(spot))).filter(
    (spot) => haversineKm(center, spot) <= SEARCH_RADIUS_KM + 0.4,
  );
}

function personStation(person: ParticipantInput) {
  const named = canonStationName(person.address || person.name);
  if (hasSubwayStation(named)) return named;
  return nearestSubwayStation(person).name;
}

function buildRoute(person: ParticipantInput, meeting: CandidateSpot): PersonRoute {
  const from = personStation(person);
  const to = canonStationName(meeting.name);
  const route = searchSubwayRoute(from, to);
  if (!route) {
    throw new TransitApiError("지하철 경로를 찾지 못했어요. 출발 역을 수도권 전철역으로 골라 주세요.");
  }
  return {
    participantId: person.id,
    durationMinutes: route.durationMinutes,
    weightedMinutes: Math.round(route.durationMinutes * participantWeight(person.married) * 10) / 10,
    summary: route.summary,
    steps: route.steps,
    path: route.path,
    source: "subway",
  };
}

export async function findMeeting(people: ParticipantInput[]): Promise<MeetResult> {
  const kakao = await kakaoKeyUsable();
  const center = weightedCentroid(people);
  const candidates = await collectCandidates(center, kakao);

  if (candidates.length === 0) {
    throw new TransitApiError("근처에 전철역 후보가 없어요. 출발 역을 다시 골라 주세요.");
  }

  const starts = people.map(personStation);
  const ranked = candidates
    .map((spot) => {
      const dest = canonStationName(spot.name);
      const weightedMinutes = starts.map((start, index) => {
        const minutes = subwayMinutes(start, dest);
        if (minutes == null) return Number.POSITIVE_INFINITY;
        return minutes * participantWeight(people[index].married);
      });
      if (weightedMinutes.some((value) => !Number.isFinite(value))) {
        return { spot, score: Number.POSITIVE_INFINITY, mean: 999, spread: 999 };
      }
      const { score, mean, spread } = scoreWeightedTimes(weightedMinutes);
      return { spot, score, mean, spread };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score);

  const winner = ranked[0];
  if (!winner) {
    throw new TransitApiError("지하철 경로를 찾지 못했어요. 출발 역을 수도권 전철역으로 골라 주세요.");
  }

  const routes = people.map((person) => buildRoute(person, winner.spot));
  const weightedMinutes = routes.map((route) => route.weightedMinutes);
  const { mean, spread } = scoreWeightedTimes(weightedMinutes);

  const inTargetBand =
    mean >= TARGET_MIN_MINUTES && mean <= TARGET_MAX_MINUTES && spread <= 10;

  const note = inTargetBand
    ? undefined
    : mean > TARGET_MAX_MINUTES
      ? "거리가 있어 10~20분 조건을 모두 맞추긴 어려웠습니다. 가중치를 반영한 가장 공정한 지점을 골랐어요."
      : "이동 시간 편차를 최소화한 지점입니다.";

  return {
    meeting: {
      name: winner.spot.name,
      address: winner.spot.address,
      lat: winner.spot.lat,
      lng: winner.spot.lng,
      kind: winner.spot.kind,
    },
    routes,
    stats: {
      meanWeightedMinutes: Math.round(mean * 10) / 10,
      spreadMinutes: Math.round(spread * 10) / 10,
      inTargetBand,
      searchRadiusKm: SEARCH_RADIUS_KM,
    },
    providers: {
      kakao,
      subway: true,
    },
    note,
  };
}
