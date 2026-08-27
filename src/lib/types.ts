export type LatLng = {
  lat: number;
  lng: number;
};

export type ParticipantInput = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  married: boolean;
};

export type PlaceHit = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  source: "kakao" | "station";
};

export type TransitStep = {
  type: "walk" | "subway" | "bus";
  label: string;
  minutes: number;
};

export type PersonRoute = {
  participantId: string;
  durationMinutes: number;
  weightedMinutes: number;
  summary: string;
  steps: TransitStep[];
  path: LatLng[];
  source: "subway" | "estimate";
};

export type MeetingSpot = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: "station" | "place" | "center";
};

export type MeetResult = {
  meeting: MeetingSpot;
  routes: PersonRoute[];
  stats: {
    meanWeightedMinutes: number;
    spreadMinutes: number;
    inTargetBand: boolean;
    searchRadiusKm: number;
  };
  providers: {
    kakao: boolean;
    subway: boolean;
  };
  note?: string;
};

export type CandidateSpot = MeetingSpot & {
  id: string;
};
