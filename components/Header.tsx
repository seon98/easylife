"use client";
import Link from "next/link";
import { Bookmark, Menu, Sparkles } from "lucide-react";
// 모든 사용자 페이지에서 재사용하는 서비스 전역 내비게이션이다.
export default function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark">
          <Sparkles size={19} />
        </span>
        혜택찾기
      </Link>
      <nav className="desktop-nav">
        <Link href="/search">지원사업 찾기</Link>
        <Link href="/data">수집 데이터</Link>
        <Link href="/saved">
          <Bookmark size={17} /> 저장한 사업
        </Link>
      </nav>
      <button className="icon-button mobile-menu" aria-label="메뉴 열기">
        <Menu size={23} />
      </button>
    </header>
  );
}
