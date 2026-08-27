import { findMeeting, TransitApiError } from "@/lib/meet";
import type { ParticipantInput } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json()) as { participants?: ParticipantInput[] };
  const people = (body.participants ?? [])
    .filter((person) => Number.isFinite(person.lat) && Number.isFinite(person.lng))
    .map((person, index) => ({
      ...person,
      name: person.name?.trim() || `${index + 1}번`,
    }));

  if (people.length < 2) {
    return Response.json(
      { error: "만날 사람은 두 명 이상 입력해 주세요." },
      { status: 400 },
    );
  }

  if (people.length > 8) {
    return Response.json({ error: "한 번에 8명까지 찾을 수 있어요." }, { status: 400 });
  }

  try {
    const result = await findMeeting(people);
    return Response.json(result);
  } catch (error) {
    console.error(error);
    if (error instanceof TransitApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: "약속 장소를 계산하는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
