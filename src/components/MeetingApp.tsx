"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { personColor } from "@/lib/colors";
import type { MeetResult, ParticipantInput, PlaceHit } from "@/lib/types";
import { PlaceSearch } from "./PlaceSearch";

const ResultMap = dynamic(
  () => import("./ResultMap").then((mod) => mod.ResultMap),
  { ssr: false },
);

type Draft = {
  id: string;
  name: string;
  query: string;
  place: PlaceHit | null;
  married: boolean;
};

const DEMO: Draft[] = [
  {
    id: "p1",
    name: "민수",
    query: "강남역",
    place: {
      id: "demo-gangnam",
      name: "강남역",
      address: "서울 강남구 강남대로",
      lat: 37.4979,
      lng: 127.0276,
      source: "station",
    },
    married: true,
  },
  {
    id: "p2",
    name: "하늘",
    query: "홍대입구역",
    place: {
      id: "demo-hongdae",
      name: "홍대입구역",
      address: "서울 마포구 양화로",
      lat: 37.5572,
      lng: 126.9238,
      source: "station",
    },
    married: false,
  },
  {
    id: "p3",
    name: "지윤",
    query: "잠실역",
    place: {
      id: "demo-jamsil",
      name: "잠실역",
      address: "서울 송파구 올림픽로",
      lat: 37.5133,
      lng: 127.1001,
      source: "station",
    },
    married: true,
  },
];

function emptyDraft(id?: string): Draft {
  return {
    id: id ?? crypto.randomUUID(),
    name: "",
    query: "",
    place: null,
    married: false,
  };
}

export function MeetingApp() {
  const [people, setPeople] = useState<Draft[]>([emptyDraft("p1"), emptyDraft("p2")]);
  const [result, setResult] = useState<MeetResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kakao, setKakao] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((json: { kakao?: boolean }) => setKakao(Boolean(json.kakao)))
      .catch(() => setKakao(false));
  }, []);

  const mapPeople: ParticipantInput[] = people
    .filter((person) => person.place)
    .map((person, index) => ({
      id: person.id,
      name: person.name.trim() || `${index + 1}번`,
      address: person.place?.address ?? "",
      lat: person.place?.lat ?? 0,
      lng: person.place?.lng ?? 0,
      married: person.married,
    }));

  function update(id: string, patch: Partial<Draft>) {
    setPeople((current) => current.map((person) => (person.id === id ? { ...person, ...patch } : person)));
  }

  async function findSpot() {
    setError("");
    setResult(null);
    const filled = people.filter((person) => person.place);
    if (filled.length < 2) {
      setError("입력칸 아래 보기에서 출발 역을 두 명 이상 골라 주세요.");
      return;
    }

    setBusy(true);
    try {
      const participants: ParticipantInput[] = filled.map((person, index) => ({
        id: person.id,
        name: person.name.trim() || `${index + 1}번`,
        address: person.place?.address ?? "",
        lat: person.place?.lat ?? 0,
        lng: person.place?.lng ?? 0,
        married: person.married,
      }));

      const response = await fetch("/api/meet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants }),
      });
      const json = (await response.json()) as MeetResult & { error?: string };
      if (!response.ok) {
        setError(json.error || "장소를 찾지 못했어요.");
        return;
      }
      setResult(json);
    } catch {
      setError("네트워크 오류가 났어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="z-10 flex w-full flex-col border-b border-[var(--line)] bg-[var(--paper)] lg:h-dvh lg:w-[420px] lg:border-b-0 lg:border-r">
        <header className="px-6 pb-4 pt-7">
          <p className="text-xs tracking-[0.18em] text-[var(--accent)]">MEET IN BETWEEN</p>
          <h1 className="mt-1 font-display text-4xl leading-none">사이</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            출발 역과 기혼 여부를 넣으면, 집에 사람이 기다리는 쪽을 조금 더 배려한 약속 장소를 고르고 대중교통 길을 이어 줍니다.
          </p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-6 pb-24">
          {people.map((person, index) => (
            <article
              key={person.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--wash)] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white"
                    style={{ background: personColor(index) }}
                  >
                    {index + 1}
                  </span>
                  <input
                    value={person.name}
                    onChange={(event) => update(person.id, { name: event.target.value })}
                    placeholder="이름"
                    className="w-32 bg-transparent text-sm font-medium outline-none"
                  />
                </div>
                {people.length > 2 ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                    onClick={() => setPeople((current) => current.filter((item) => item.id !== person.id))}
                  >
                    빼기
                  </button>
                ) : null}
              </div>

              <PlaceSearch
                value={person.query}
                selectedId={person.place?.id}
                onChange={(query) => update(person.id, { query, place: null })}
                onSelect={(place) => update(person.id, { place, query: place.name })}
              />

              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--paper)] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={person.married}
                  onChange={(event) => update(person.id, { married: event.target.checked })}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-sm font-medium">기혼 · 집에 기다리는 사람이 있어요</span>
                  <span className="block text-xs leading-5 text-[var(--muted)]">
                    약속 장소를 이 사람 집 쪽으로 당깁니다. 이동 시간도 더 짧게 맞춰요.
                  </span>
                </span>
              </label>
            </article>
          ))}

          {people.length < 8 ? (
            <button
              type="button"
              onClick={() => setPeople((current) => [...current, emptyDraft()])}
              className="w-full rounded-2xl border border-dashed border-[var(--line)] py-3 text-sm text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              사람 추가
            </button>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-[var(--line)] px-6 py-4">
          {error ? <p className="text-sm text-[var(--accent)]">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={findSpot}
              disabled={busy}
              className="flex-1 rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-medium text-[var(--paper)] disabled:opacity-50"
            >
              {busy ? "찾는 중…" : "만날 곳 찾기"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPeople(DEMO.map((item) => ({ ...item, id: crypto.randomUUID() })));
                setResult(null);
                setError("");
              }}
              className="rounded-full border border-[var(--line)] px-4 py-3 text-sm"
            >
              예시
            </button>
          </div>
          <p className="text-[11px] leading-5 text-[var(--muted)]">
            {kakao
              ? "수도권 지하철 노선도로 경로를 잇습니다. 카카오로 역 검색을 보강합니다."
              : "수도권 지하철 노선도로 경로를 잇습니다. 역은 로컬 목록에서 고르면 됩니다."}
          </p>
        </div>
      </aside>

      <section className="relative min-h-[52vh] flex-1 lg:h-dvh">
        <Suspense fallback={<div className="h-full min-h-[320px] bg-[var(--wash)]" />}>
          <ResultMap people={mapPeople} result={result} busy={busy} />
        </Suspense>

        {result ? (
          <div className="absolute bottom-4 left-4 right-4 z-[400] mx-auto max-w-xl rounded-2xl border border-[var(--line)] bg-[rgba(255,252,247,0.94)] p-4 shadow-[0_18px_50px_rgba(40,24,12,0.16)] backdrop-blur">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-[var(--accent)]">약속 장소</p>
                <h2 className="font-display text-2xl">{result.meeting.name}</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">{result.meeting.address}</p>
              </div>
              <p className="text-right text-xs leading-5 text-[var(--muted)]">
                가중 평균 {result.stats.meanWeightedMinutes}분
                <br />
                편차 {result.stats.spreadMinutes}분 · 반경 {result.stats.searchRadiusKm}km
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {result.routes.map((route) => {
                const person = mapPeople.find((item) => item.id === route.participantId);
                const index = mapPeople.findIndex((item) => item.id === route.participantId);
                return (
                  <li key={route.participantId} className="flex items-start justify-between gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2.5 w-2.5 rounded-full"
                        style={{ background: personColor(index) }}
                      />
                      <div>
                        <p className="font-medium">
                          {person?.name}{" "}
                          {person?.married ? (
                            <span className="text-[11px] font-normal text-[var(--muted)]">기혼 가중치</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{route.summary}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-right">
                      {route.durationMinutes}분
                      <span className="block text-[11px] text-[var(--muted)]">
                        가중 {route.weightedMinutes}분
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>
            {result.note ? (
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{result.note}</p>
            ) : (
              <p className="mt-3 text-xs text-[var(--sage)]">가중 이동 시간이 10~20분 안에 모여 있습니다.</p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
