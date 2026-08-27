"use client";

import { useEffect, useMemo, useState } from "react";
import { stationLabel, suggestStations } from "@/lib/stations";
import type { PlaceHit } from "@/lib/types";

type PlaceSearchProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceHit) => void;
  selectedId?: string;
};

function stationHit(name: string, lat: number, lng: number): PlaceHit {
  const label = stationLabel(name);
  return {
    id: `st-${name}`,
    name: label,
    address: label,
    lat,
    lng,
    source: "station",
  };
}

export function PlaceSearch({ value, onChange, onSelect, selectedId }: PlaceSearchProps) {
  const [remote, setRemote] = useState<PlaceHit[]>([]);

  useEffect(() => {
    const query = value.trim();
    if (!query) {
      setRemote([]);
      return;
    }

    const timer = window.setTimeout(() => {
      fetch(`/api/places?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((json: { places?: PlaceHit[] }) => setRemote(json.places ?? []))
        .catch(() => setRemote([]));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [value]);

  const options = useMemo(() => {
    const local = suggestStations(value).map((station) =>
      stationHit(station.name, station.lat, station.lng),
    );
    const merged: PlaceHit[] = [];
    const seen = new Set<string>();
    for (const place of [...local, ...remote]) {
      const key = `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(place);
    }
    return merged.slice(0, 12);
  }, [value, remote]);

  return (
    <div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="역 이름 검색"
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--ink)]"
      />
      <p className="mt-2 text-[11px] tracking-wide text-[var(--muted)]">보기</p>
      {options.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {options.map((place) => {
            const selected = selectedId === place.id;
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => onSelect(place)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  selected
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                    : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--ink)]"
                }`}
              >
                {place.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--muted)]">해당하는 역이 없어요. 다른 이름을 입력해 보세요.</p>
      )}
    </div>
  );
}
