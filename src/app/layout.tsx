import type { Metadata } from "next";
import { Gowun_Dodum, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const display = Gowun_Dodum({
  variable: "--font-gowun",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "사이 — 약속 장소 찾기",
  description:
    "출발 역과 기혼 여부를 반영해 가장 공정한 약속 장소를 찾고, 대중교통 길을 이어 줍니다.",
  openGraph: {
    title: "사이 — 약속 장소 찾기",
    description: "출발 역을 넣으면 가장 공정한 약속 장소를 찾아 줍니다.",
    images: [{ url: "/qt.png", width: 1535, height: 1024 }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
