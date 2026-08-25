"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  GitCompareArrows,
  HelpCircle,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Header from "@/components/Header";

type CheckItem = { label: string; state: "MATCH" | "MISMATCH" | "UNKNOWN" };
type Program = {
  source_id?: string;
  id?: number;
  title: string;
  category: string;
  period: string;
  ministry?: string;
  organization: string;
  region: string;
  status: string;
  official_url: string;
  source_name?: string;
  source?: string;
  summary?: string;
  match?: { score: number; checks: CheckItem[] };
};
type Conditions = {
  age: number | null;
  region: string | null;
  category: string | null;
};

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(params.get("q") || "");
  const [submitted, setSubmitted] = useState(params.get("q") || "");
  const [region, setRegion] = useState("전체");
  const [status, setStatus] = useState(params.get("status") || "전체");
  const [items, setItems] = useState<Program[]>([]);
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState<string[]>([]);
  const category = params.get("category") || "전체";
  // 비교 선택은 로그인 전에도 유지되도록 브라우저에 저장한다.
  useEffect(() => {
    setCompare(JSON.parse(localStorage.getItem("compare") || "[]"));
  }, []);
  useEffect(() => {
    const search = new URLSearchParams({ limit: "100" });
    if (submitted) search.set("q", submitted);
    if (region !== "전체") search.set("region", region);
    if (status !== "전체") search.set("status", status);
    if (category !== "전체") search.set("category", category);
    setLoading(true);
    // 조건형 자연어는 설명 가능한 매칭 API를, 일반 검색은 빠른 목록 API를 사용한다.
    const hasConditions =
      /(\d{2}\s*세|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(
        submitted,
      );
    fetch(
      hasConditions
        ? `/api/match?q=${encodeURIComponent(submitted)}&limit=50`
        : `/api/programs?${search}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setConditions(data.conditions || null);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [submitted, region, status, category]);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(query.trim());
    router.replace(`/search?q=${encodeURIComponent(query.trim())}`);
  };
  const toggleCompare = (id: string) => {
    // 비교 표의 가독성을 위해 동시에 선택할 수 있는 사업을 3개로 제한한다.
    const next = compare.includes(id)
      ? compare.filter((item) => item !== id)
      : compare.length < 3
        ? [...compare, id]
        : compare;
    setCompare(next);
    localStorage.setItem("compare", JSON.stringify(next));
  };
  return (
    <main className="page-bg">
      <Header />
      <section className="search-top">
        <div className="content-width">
          <p className="page-kicker">지원사업 통합검색</p>
          <h1>필요한 혜택을 찾아보세요</h1>
          <form className="result-search" onSubmit={submit}>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="서울에 사는 27세 청년 창업 지원…"
            />
            <button>검색</button>
          </form>
          {conditions && (
            <div className="condition-summary">
              <strong>검색 조건을 이렇게 이해했어요</strong>
              <div>
                {conditions.region && (
                  <span>
                    <MapPin />
                    {conditions.region}
                  </span>
                )}
                {conditions.age && <span>{conditions.age}세</span>}
                {conditions.category && <span>{conditions.category}</span>}
              </div>
              <small>
                조건 일치는 참고 정보이며 최종 자격은 공식 공고에서 확인해야
                합니다.
              </small>
            </div>
          )}
        </div>
      </section>
      <div className="content-width results-layout">
        <aside className="filters">
          <h3>
            <SlidersHorizontal size={18} /> 검색 필터
          </h3>
          <label>
            지역
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option>전체</option>
              <option>전국</option>
              <option>서울</option>
              <option>경기</option>
              <option>부산</option>
              <option>경남</option>
              <option>제주</option>
            </select>
          </label>
          <label>
            접수 상태
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>전체</option>
              <option>접수중</option>
              <option>접수예정</option>
              <option>상시접수</option>
              <option>접수마감</option>
            </select>
          </label>
          <button
            className="reset"
            onClick={() => {
              setRegion("전체");
              setStatus("전체");
            }}
          >
            필터 초기화
          </button>
        </aside>
        <section className="results">
          <div className="results-head">
            <div>
              <strong>
                {submitted ? `‘${submitted}’ 검색 결과` : "수집된 지원사업"}
              </strong>
              <span>{loading ? "불러오는 중…" : `총 ${items.length}개`}</span>
            </div>
            <span className="official-data-label">
              기업마당 공식 공개 데이터
            </span>
          </div>
          {!loading &&
            items.map((program) => {
              const id = program.source_id || String(program.id);
              return (
                <article className="program-card" key={id}>
                  <div className="card-top">
                    <div className="badges">
                      <span className={`status ${program.status}`}>
                        {program.status}
                      </span>
                      <span>{program.category || "기타"}</span>
                      <span>{program.source_name || program.source}</span>
                    </div>
                    <button
                      className={`compare-toggle ${compare.includes(id) ? "selected" : ""}`}
                      onClick={() => toggleCompare(id)}
                    >
                      <GitCompareArrows />
                      {compare.includes(id) ? "비교 선택됨" : "비교하기"}
                    </button>
                  </div>
                  {program.match && (
                    <div className="match-panel">
                      <div className="match-score">
                        <strong>{program.match.score}%</strong>
                        <span>조건 관련도</span>
                      </div>
                      <div className="match-checks">
                        {program.match.checks.map((check) => (
                          <span className={check.state} key={check.label}>
                            {check.state === "MATCH" ? (
                              <Check />
                            ) : check.state === "MISMATCH" ? (
                              <X />
                            ) : (
                              <HelpCircle />
                            )}
                            {check.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <a href={`/programs/${id}`}>
                    <h2>{program.title}</h2>
                  </a>
                  <p className="org">
                    <Building2 size={16} />
                    {program.ministry ? `${program.ministry} · ` : ""}
                    {program.organization}
                  </p>
                  {program.summary && (
                    <p className="summary">{program.summary}</p>
                  )}
                  <div className="card-meta">
                    <span>
                      <CalendarDays /> {program.period}
                    </span>
                    <span>
                      <MapPin /> {program.region}
                    </span>
                    <b>{program.status}</b>
                  </div>
                  <div className="card-actions">
                    <a className="detail-link-inline" href={`/programs/${id}`}>
                      자세히 보기 <ArrowRight size={17} />
                    </a>
                    <a
                      className="official-link"
                      href={program.official_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      공식 원문 <ExternalLink size={15} />
                    </a>
                  </div>
                </article>
              );
            })}
          {!loading && !items.length && (
            <div className="empty">
              <Search />
              <h2>검색 결과가 없어요</h2>
              <p>검색어를 줄이거나 필터를 초기화해 보세요.</p>
            </div>
          )}
        </section>
      </div>
      {compare.length > 0 && (
        <div className="compare-dock">
          <div>
            <GitCompareArrows />
            <strong>{compare.length}개 사업 선택</strong>
            <span>최대 3개까지 비교할 수 있어요.</span>
          </div>
          <button
            onClick={() => router.push(`/compare?ids=${compare.join(",")}`)}
          >
            선택한 사업 비교 <ArrowRight />
          </button>
        </div>
      )}
    </main>
  );
}
export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
