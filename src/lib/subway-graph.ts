import { densifyPath, haversineKm } from "./geo";
import type { LatLng, TransitStep } from "./types";
import network from "./subway-network.json";

const TRANSFER_MINUTES = 4;

type Network = {
  stations: Record<string, { lat: number; lng: number }>;
  edges: { from: string; to: string; minutes: number; line: string }[];
};

const data = network as Network;

type GraphEdge = {
  to: string;
  minutes: number;
  line: string;
  kind: "ride" | "transfer";
};

const adjacency = new Map<string, GraphEdge[]>();
const stationLines = new Map<string, string[]>();
let built = false;

function nodeId(station: string, line: string) {
  return `${station}@@${line}`;
}

function parseNode(id: string) {
  const at = id.indexOf("@@");
  return { station: id.slice(0, at), line: id.slice(at + 2) };
}

function addEdge(from: string, to: string, minutes: number, line: string, kind: GraphEdge["kind"]) {
  const list = adjacency.get(from) ?? [];
  list.push({ to, minutes, line, kind });
  adjacency.set(from, list);
}

function buildGraph() {
  if (built) return;
  built = true;

  for (const edge of data.edges) {
    const a = nodeId(edge.from, edge.line);
    const b = nodeId(edge.to, edge.line);
    addEdge(a, b, edge.minutes, edge.line, "ride");
    addEdge(b, a, edge.minutes, edge.line, "ride");
    const fromLines = stationLines.get(edge.from) ?? [];
    const toLines = stationLines.get(edge.to) ?? [];
    if (!fromLines.includes(edge.line)) fromLines.push(edge.line);
    if (!toLines.includes(edge.line)) toLines.push(edge.line);
    stationLines.set(edge.from, fromLines);
    stationLines.set(edge.to, toLines);
  }

  for (const [station, lines] of stationLines) {
    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length; j += 1) {
        const a = nodeId(station, lines[i]);
        const b = nodeId(station, lines[j]);
        addEdge(a, b, TRANSFER_MINUTES, "환승", "transfer");
        addEdge(b, a, TRANSFER_MINUTES, "환승", "transfer");
      }
    }
  }
}

export function canonStationName(name: string) {
  let value = name.replace(/\s+/g, "");
  value = value.replace(
    /(1호선|2호선|3호선|4호선|5호선|6호선|7호선|8호선|9호선|공항철도|신분당|수인분당|경의중앙|경춘선|경강선|서해선|우이신설|김포골드|인천1호선|인천2호선).*$/,
    "",
  );
  if (value.endsWith("역") && value !== "서울역") value = value.slice(0, -1);
  if (value === "서울") return "서울역";
  return value;
}

export function hasSubwayStation(name: string) {
  buildGraph();
  return stationLines.has(canonStationName(name));
}

export function subwayStationCoord(name: string): LatLng | null {
  const key = canonStationName(name);
  const point = data.stations[key];
  return point ? { lat: point.lat, lng: point.lng } : null;
}

export function nearestSubwayStation(point: LatLng) {
  buildGraph();
  let bestName = "";
  let best = Infinity;
  for (const [name, coord] of Object.entries(data.stations)) {
    const km = haversineKm(point, coord);
    if (km < best) {
      best = km;
      bestName = name;
    }
  }
  return { name: bestName, ...data.stations[bestName], km: best };
}

type Visit = {
  minutes: number;
  prev: string | null;
  via: GraphEdge | null;
};

function dijkstraFromStation(startName: string) {
  buildGraph();
  const start = canonStationName(startName);
  const lines = stationLines.get(start) ?? [];
  const dist = new Map<string, Visit>();
  const queue: { id: string; minutes: number }[] = [];

  for (const line of lines) {
    const id = nodeId(start, line);
    dist.set(id, { minutes: 0, prev: null, via: null });
    queue.push({ id, minutes: 0 });
  }

  while (queue.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i += 1) {
      if (queue[i].minutes < queue[bestIndex].minutes) bestIndex = i;
    }
    const current = queue.splice(bestIndex, 1)[0];
    const known = dist.get(current.id);
    if (!known || current.minutes > known.minutes) continue;

    for (const edge of adjacency.get(current.id) ?? []) {
      const nextMinutes = current.minutes + edge.minutes;
      const existing = dist.get(edge.to);
      if (existing && existing.minutes <= nextMinutes) continue;
      dist.set(edge.to, { minutes: nextMinutes, prev: current.id, via: edge });
      queue.push({ id: edge.to, minutes: nextMinutes });
    }
  }

  return dist;
}

function bestNodeAt(dist: Map<string, Visit>, stationName: string) {
  const name = canonStationName(stationName);
  const lines = stationLines.get(name) ?? [];
  let best: { id: string; minutes: number } | null = null;
  for (const line of lines) {
    const id = nodeId(name, line);
    const visit = dist.get(id);
    if (!visit) continue;
    if (!best || visit.minutes < best.minutes) best = { id, minutes: visit.minutes };
  }
  return best;
}

export function subwayMinutes(fromName: string, toName: string) {
  const from = canonStationName(fromName);
  const to = canonStationName(toName);
  if (from === to) return 3;
  const dist = dijkstraFromStation(from);
  return bestNodeAt(dist, to)?.minutes ?? null;
}

export type SubwayRoute = {
  durationMinutes: number;
  summary: string;
  steps: TransitStep[];
  path: LatLng[];
  stations: string[];
};

export function searchSubwayRoute(fromName: string, toName: string): SubwayRoute | null {
  const from = canonStationName(fromName);
  const to = canonStationName(toName);
  const fromCoord = data.stations[from];
  const toCoord = data.stations[to];
  if (!fromCoord || !toCoord) return null;

  if (from === to) {
    return {
      durationMinutes: 3,
      summary: "도보",
      steps: [{ type: "walk", label: "약속 장소까지 도보", minutes: 3 }],
      path: densifyPath([fromCoord, toCoord]),
      stations: [from],
    };
  }

  const dist = dijkstraFromStation(from);
  const goal = bestNodeAt(dist, to);
  if (!goal) return null;

  const nodes: string[] = [];
  let cursor: string | null = goal.id;
  while (cursor) {
    nodes.push(cursor);
    cursor = dist.get(cursor)?.prev ?? null;
  }
  nodes.reverse();

  const stations: string[] = [];
  for (const id of nodes) {
    const { station } = parseNode(id);
    if (stations[stations.length - 1] !== station) stations.push(station);
  }

  const rideSteps: TransitStep[] = [];
  let rideStart = from;
  let currentLine = parseNode(nodes[0]).line;

  for (let i = 1; i < nodes.length; i += 1) {
    const via = dist.get(nodes[i])?.via;
    if (!via || via.kind === "transfer") {
      if (rideStart !== parseNode(nodes[i - 1]).station) {
        rideSteps.push({
          type: "subway",
          label: `${currentLine} ${rideStart} → ${parseNode(nodes[i - 1]).station}`,
          minutes: 1,
        });
      }
      rideStart = parseNode(nodes[i]).station;
      currentLine = parseNode(nodes[i]).line;
    }
  }
  rideSteps.push({
    type: "subway",
    label: `${currentLine} ${rideStart} → ${to}`,
    minutes: Math.max(1, goal.minutes),
  });

  const summary = rideSteps
    .map((step) => step.label.split(" ")[0])
    .filter((line, index, list) => line && list.indexOf(line) === index)
    .join(" → ");

  const path = densifyPath(
    stations.map((station) => data.stations[station]).filter(Boolean),
    Math.max(64, stations.length * 12),
  );

  return {
    durationMinutes: Math.max(1, goal.minutes),
    summary: summary || "지하철",
    steps: rideSteps,
    path,
    stations,
  };
}
