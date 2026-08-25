"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Header from "./Header";

type Program = {
  source_id: string;
  title: string;
  organization: string;
  ministry: string;
  category: string;
  region: string;
  period: string;
  status: string;
};
type Status = "접수중" | "접수예정" | "접수마감";
const statuses: Status[] = ["접수중", "접수예정", "접수마감"];
const examples = [
  "청년 창업 지원",
  "서울 월세 지원",
  "소상공인 대출",
  "취업 준비 교육비",
];
const categories = [
  { label: "주거", icon: Home, tone: "mint" },
  { label: "창업", icon: Building2, tone: "orange" },
  { label: "금융", icon: Banknote, tone: "blue" },
  { label: "교육·취업", icon: BookOpen, tone: "violet" },
];

export default function HomeSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };
  return (
    <main>
      <Header />
      <section className="hero">
        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />
        <div className="eyebrow">
          <Sparkles size={15} /> 흩어진 정부 혜택, 한 번에
        </div>
        <h1>
          내게 맞는 지원사업,
          <br />
          <em>검색 한 번이면 충분해요.</em>
        </h1>
        <p className="hero-copy">
          어려운 정책 용어 대신 평소 쓰는 말로 검색하세요.
          <br className="desktop-only" /> 자격부터 신청 방법까지 한눈에 정리해
          드립니다.
        </p>
        <form className="hero-search" onSubmit={submit}>
          <Search size={25} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="어떤 지원을 찾고 계세요?"
            aria-label="지원사업 검색"
          />
          <button>
            검색하기 <ArrowRight size={19} />
          </button>
        </form>
        <div className="examples">
          <span>이렇게 검색해 보세요</span>
          {examples.map((item) => (
            <button
              key={item}
              onClick={() =>
                router.push(`/search?q=${encodeURIComponent(item)}`)
              }
            >
              {item}
            </button>
          ))}
        </div>
      </section>
      <ProgramNews />
      <section className="category-section content-width">
        <div className="section-heading">
          <div>
            <span>분야별 둘러보기</span>
            <h2>어떤 도움이 필요하세요?</h2>
          </div>
          <a href="/search" className="text-link">
            전체 보기 <ArrowRight size={17} />
          </a>
        </div>
        <div className="category-grid">
          {categories.map(({ label, icon: Icon, tone }) => (
            <button
              className="category-card"
              key={label}
              onClick={() =>
                router.push(`/search?category=${encodeURIComponent(label)}`)
              }
            >
              <span className={`category-icon ${tone}`}>
                <Icon />
              </span>
              <strong>{label}</strong>
              <small>지원사업 확인하기</small>
              <ArrowRight className="card-arrow" size={18} />
            </button>
          ))}
        </div>
      </section>
      <section className="trust-section">
        <div className="content-width trust-grid">
          <div className="trust-copy">
            <span className="section-kicker">혜택찾기의 약속</span>
            <h2>
              정확한 정보만,
              <br />
              이해하기 쉽게
            </h2>
            <p>
              정부와 공공기관의 공식 데이터를 바탕으로
              <br />
              복잡한 공고를 쉬운 문장으로 정리합니다.
            </p>
          </div>
          <div className="promise-list">
            <PromiseCard
              icon={ShieldCheck}
              title="공식 출처를 투명하게"
              text="모든 사업에 데이터 출처와 공식 링크를 표시해요."
            />
            <PromiseCard
              icon={BadgeCheck}
              title="자격 판단은 신중하게"
              text="관련성 높은 사업을 추천하되, 최종 자격은 공식 공고로 안내해요."
            />
          </div>
        </div>
      </section>
      <footer>
        <div className="content-width">
          <span className="brand footer-brand">
            <Sparkles size={17} />
            혜택찾기
          </span>
          <p>
            지원사업의 최종 내용과 자격은 반드시 공식 공고에서 확인해 주세요.
          </p>
          <span>© 2026 혜택찾기</span>
        </div>
      </footer>
    </main>
  );
}

function ProgramNews() {
  const [active, setActive] = useState<Status>("접수중");
  const [data, setData] = useState<Record<Status, Program[]>>({
    접수중: [],
    접수예정: [],
    접수마감: [],
  });
  const [page, setPage] = useState(0);
  useEffect(() => {
    // 홈 진입 시 접수 상태별 최신 공고를 한 번에 준비한다.
    Promise.all(
      statuses.map((status) =>
        fetch(`/api/programs?status=${encodeURIComponent(status)}&limit=9`)
          .then((response) => response.json())
          .then((result) => [status, result.items || []] as const),
      ),
    ).then((entries) =>
      setData(Object.fromEntries(entries) as Record<Status, Program[]>),
    );
  }, []);
  useEffect(() => {
    // 사용자가 조작하지 않아도 다양한 공고를 볼 수 있도록 상태 탭을 순환한다.
    const timer = window.setInterval(() => {
      setActive(
        (current) =>
          statuses[(statuses.indexOf(current) + 1) % statuses.length],
      );
      setPage(0);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);
  const items = data[active];
  const maxPage = Math.max(0, Math.ceil(items.length / 3) - 1);
  const visible = items.slice(page * 3, page * 3 + 3);
  const select = (status: Status) => {
    setActive(status);
    setPage(0);
  };
  return (
    <section className="news-section">
      <div className="content-width">
        <div className="news-title">
          <div>
            <span className="section-kicker">지금 확인해 보세요</span>
            <h2>새로운 지원사업 소식</h2>
            <p>공공기관에서 발표한 최신 공고를 접수 상태별로 모았습니다.</p>
          </div>
          <a
            className="text-link"
            href={`/search?status=${encodeURIComponent(active)}`}
          >
            전체 사업 보기 <ArrowRight size={17} />
          </a>
        </div>
        <div className="status-tabs">
          {statuses.map((status) => (
            <button
              key={status}
              className={active === status ? "active" : ""}
              onClick={() => select(status)}
            >
              <span className={`status-dot ${status}`} />
              {status}
              <b>{data[status].length}</b>
              {active === status && <i />}
            </button>
          ))}
        </div>
        <div className="news-stage">
          {visible.length ? (
            <div className="news-grid" key={`${active}-${page}`}>
              {visible.map((program) => (
                <a
                  className="news-card"
                  href={`/programs/${program.source_id}`}
                  key={program.source_id}
                >
                  <div>
                    <span className={`news-status ${active}`}>{active}</span>
                    <span className="news-category">
                      {program.category || "기타"}
                    </span>
                  </div>
                  <h3>{program.title}</h3>
                  <p>{program.ministry || program.organization}</p>
                  <div className="news-meta">
                    <span>
                      <CalendarDays /> {program.period}
                    </span>
                    <span>
                      <MapPin /> {program.region}
                    </span>
                  </div>
                  <span className="news-more">
                    자세히 보기 <ArrowRight />
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div className="news-empty">
              <CalendarDays />
              <strong>{active}인 공고가 아직 없어요</strong>
              <p>새 공고가 수집되면 이곳에 바로 표시됩니다.</p>
            </div>
          )}
          <button
            className="news-nav prev"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            aria-label="이전 사업"
          >
            <ChevronLeft />
          </button>
          <button
            className="news-nav next"
            disabled={page >= maxPage}
            onClick={() => setPage((value) => Math.min(maxPage, value + 1))}
            aria-label="다음 사업"
          >
            <ChevronRight />
          </button>
        </div>
        <div className="news-pages">
          {Array.from({ length: maxPage + 1 }, (_, index) => (
            <button
              className={page === index ? "active" : ""}
              key={index}
              onClick={() => setPage(index)}
              aria-label={`${index + 1}번째 목록`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PromiseCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="promise">
      <span>
        <Icon />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}
