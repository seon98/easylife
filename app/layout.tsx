import type { Metadata } from "next";
import "./globals.css";
// 모든 페이지가 공유하는 검색 서비스 메타데이터다.
export const metadata: Metadata = {
  title: "혜택찾기 — 나에게 맞는 정부지원사업",
  description: "복잡한 정부지원사업을 한 번의 검색으로 쉽게 찾아보세요.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
