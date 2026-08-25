"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  Database,
  ExternalLink,
  MapPin,
  Search,
} from "lucide-react";
import Header from "@/components/Header";

type CollectedProgram = {
  source_id: string;
  title: string;
  category: string;
  period: string;
  ministry: string;
  organization: string;
  region: string;
  status: string;
  official_url: string;
  source_name: string;
  collected_at: string;
};
type Stats = {
  total: number;
  ministries: number;
  organizations: number;
  collected_at: string | null;
};

export default function DataPage() {
  const [items, setItems] = useState<CollectedProgram[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    ministries: 0,
    organizations: 0,
    collected_at: null,
  });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  // 검색어가 바뀔 때 최대 500건의 수집 원본 목록을 다시 조회한다.
  const load = (q = "") => {
    setLoading(true);
    fetch(`/api/programs?q=${encodeURIComponent(q)}&limit=500`)
      .then((response) => response.json())
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    // 최초 진입에는 목록과 전체 수집 통계를 함께 준비한다.
    load();
    fetch("/api/collected/stats")
      .then((response) => response.json())
      .then(setStats);
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    load(query);
  };
  return (
    <main className="page-bg">
      <Header />
      <section className="data-hero">
        <div className="content-width">
          <p className="page-kicker">
            <Database size={16} /> 공식 공개 데이터
          </p>
          <h1>수집된 지원사업</h1>
          <p>기업마당에 공개된 중앙부처·지자체·공공기관 지원사업입니다.</p>
          <div className="stat-row">
            <Stat value={stats.total} label="전체 사업" />
            <Stat value={stats.ministries} label="소관기관" />
            <Stat value={stats.organizations} label="수행기관" />
          </div>
          <form className="result-search" onSubmit={submit}>
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="사업명, 기관명으로 검색"
            />
            <button>검색</button>
          </form>
        </div>
      </section>
      <section className="content-width data-section">
        <div className="data-head">
          <strong>{query ? `‘${query}’ 검색 결과` : "최근 수집 목록"}</strong>
          <span>{loading ? "불러오는 중…" : `${items.length}개 표시`}</span>
        </div>
        {!loading &&
          items.map((program) => (
            <article className="data-card" key={program.source_id}>
              <div className="badges">
                <span className={`status ${program.status}`}>
                  {program.status}
                </span>
                <span>{program.category || "기타"}</span>
                <span>공식 웹</span>
              </div>
              <h2>{program.title}</h2>
              <div className="data-meta">
                <span>
                  <Building2 />
                  {program.ministry} · {program.organization}
                </span>
                <span>
                  <CalendarDays />
                  {program.period}
                </span>
                <span>
                  <MapPin />
                  {program.region}
                </span>
              </div>
              <a href={program.official_url} target="_blank" rel="noreferrer">
                기업마당 원문 확인 <ExternalLink />
              </a>
            </article>
          ))}
        {!loading && !items.length && (
          <div className="empty">
            <Search />
            <h2>검색 결과가 없어요</h2>
            <p>다른 검색어를 입력해 보세요.</p>
          </div>
        )}
      </section>
    </main>
  );
}
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}
