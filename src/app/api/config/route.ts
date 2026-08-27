import { kakaoStatus } from "@/lib/kakao";

export async function GET() {
  const kakao = await kakaoStatus();
  return Response.json({
    kakao: kakao.ok,
    ready: true,
    kakaoPresent: kakao.present,
    kakaoReason: kakao.reason,
  });
}
