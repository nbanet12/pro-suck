"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { personColor } from "@/lib/colors";
import type { MeetResult, ParticipantInput } from "@/lib/types";

type ResultMapProps = {
  people: ParticipantInput[];
  result: MeetResult | null;
  busy: boolean;
};

function personIcon(index: number, label: string) {
  const color = personColor(index);
  return L.divIcon({
    className: "sai-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div class="sai-pin" style="background:${color}">${label}</div>`,
  });
}

function meetIcon() {
  return L.divIcon({
    className: "sai-marker",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    html: `<div class="sai-meet"><span>여기</span></div>`,
  });
}

export function ResultMap({ people, result, busy }: ResultMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([37.5665, 126.978], 12);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layerRef.current;
    if (!map || !layers) return;

    layers.clearLayers();
    const timers: number[] = [];
    let raf = 0;

    const placed = people.filter((person) => Number.isFinite(person.lat));
    placed.forEach((person, index) => {
      L.marker([person.lat, person.lng], {
        icon: personIcon(index, String(index + 1)),
        title: person.name,
      })
        .bindTooltip(person.name, { direction: "top", offset: [0, -12] })
        .addTo(layers);
    });

    if (result) {
      L.marker([result.meeting.lat, result.meeting.lng], {
        icon: meetIcon(),
        zIndexOffset: 600,
      })
        .bindTooltip(result.meeting.name, { direction: "top", offset: [0, -16] })
        .addTo(layers);
    }

    const bounds = L.latLngBounds([]);
    placed.forEach((person) => bounds.extend([person.lat, person.lng]));
    if (result) bounds.extend([result.meeting.lat, result.meeting.lng]);
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.28), { animate: true, maxZoom: 14 });
    }

    if (result) {
      result.routes.forEach((route, index) => {
        const color = personColor(people.findIndex((person) => person.id === route.participantId));
        const latlngs = route.path.map((point) => L.latLng(point.lat, point.lng));
        if (latlngs.length < 2) return;
        latlngs.forEach((point) => bounds.extend(point));

        const line = L.polyline([], {
          color,
          weight: 5,
          opacity: 0.92,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layers);

        const traveler = L.circleMarker(latlngs[0], {
          radius: 6,
          color: "#fff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        }).addTo(layers);

        const duration = Math.min(4200, 1400 + latlngs.length * 18);
        const delay = index * 380;
        const startClock = performance.now() + delay;

        const tick = (now: number) => {
          const t = Math.min(1, Math.max(0, (now - startClock) / duration));
          const eased = 1 - (1 - t) ** 3;
          const count = Math.max(2, Math.floor(eased * latlngs.length));
          line.setLatLngs(latlngs.slice(0, count));
          traveler.setLatLng(latlngs[count - 1]);
          if (t < 1) raf = requestAnimationFrame(tick);
        };

        timers.push(
          window.setTimeout(() => {
            raf = requestAnimationFrame(tick);
          }, delay),
        );
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.18), { animate: true, maxZoom: 14 });
      }
    }

    const sizeTimer = window.setTimeout(() => map.invalidateSize(), 80);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(sizeTimer);
      cancelAnimationFrame(raf);
    };
  }, [people, result]);

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {busy ? (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-[rgba(243,237,227,0.55)] backdrop-blur-[2px]">
          <div className="rounded-2xl bg-[var(--paper)] px-5 py-4 text-center shadow-[0_16px_50px_rgba(40,24,12,0.14)]">
            <p className="font-display text-lg">길을 잇는 중</p>
            <p className="mt-1 text-sm text-[var(--muted)]">중간 지점과 대중교통 경로를 찾고 있어요</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
