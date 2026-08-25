"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  MapPin,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import Header from "@/components/Header";
type Quality = { score: number; status: "BASIC" | "EXTRACTED" | "VERIFIED" };
type Program = {
  source_id?: string;
  id?: number;
  title: string;
  organization: string;
  ministry?: string;
  category: string;
  region: string;
  period: string;
  status: string;
  target?: string;
  benefit?: string;
  summary?: string;
  application_method?: string;
  official_url: string;
  data_quality?: Quality;
  loadError?: boolean;
};
function CompareContent() {
  const params = useSearchParams();
  const ids = (params.get("ids") || "").split(",").filter(Boolean).slice(0, 3);
  const [items, setItems] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(0);
  // 먼저 캐시된 정보를 표시한 뒤, 부족한 사업만 병렬로 상세 보완한다.
  const load = async () => {
    setLoading(true);
    const initial = await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetch(
            `/api/programs/${encodeURIComponent(id)}`,
          );
          if (!response.ok) throw new Error();
          return await response.json();
        } catch {
          return {
            source_id: id,
            title: "정보를 불러오지 못했습니다",
            organization: "-",
            category: "-",
            region: "-",
            period: "-",
            status: "확인필요",
            official_url: "",
            loadError: true,
          };
        }
      }),
    );
    setItems(initial);
    setLoading(false);
    const basic = initial.filter(
      (item) => item.data_quality?.status === "BASIC" && !item.loadError,
    );
    if (basic.length) {
      setEnriching(basic.length);
      const enriched = await Promise.all(
        initial.map(async (item) => {
          if (item.data_quality?.status !== "BASIC") return item;
          try {
            const response = await fetch(
              `/api/programs/${encodeURIComponent(item.source_id)}/enrich`,
              { method: "POST" },
            );
            if (!response.ok) throw new Error();
            return await response.json();
          } catch {
            return item;
          } finally {
            setEnriching((value) => Math.max(0, value - 1));
          }
        }),
      );
      setItems(enriched);
    }
  };
  useEffect(() => {
    load();
  }, [params]);
  if (!ids.length)
    return (
      <main className="page-bg">
        <Header />
        <div className="empty">
          <WalletCards />
          <h2>비교할 사업을 선택해주세요</h2>
          <a className="primary-action" href="/search">
            지원사업 찾기
          </a>
        </div>
      </main>
    );
  return (
    <main className="page-bg">
      <Header />
      <section className="content-width compare-page">
        <a className="back" href="/search">
          <ArrowLeft /> 검색 결과로
        </a>
        <p className="page-kicker">사업 비교</p>
        <h1>어떤 사업이 더 잘 맞을까요?</h1>
        <p>지원 조건과 신청 정보를 나란히 비교해 보세요.</p>
        {(loading || enriching > 0) && (
          <div className="compare-loading">
            <LoaderCircle />
            <div>
              <strong>
                {loading
                  ? "비교할 사업을 불러오는 중입니다"
                  : "부족한 상세정보를 공식 공고에서 확인하고 있습니다"}
              </strong>
              <span>
                {enriching > 0
                  ? `${enriching}개 사업을 보완하고 있어요.`
                  : "잠시만 기다려 주세요."}
              </span>
            </div>
          </div>
        )}
        {!loading && (
          <div
            className="compare-table"
            style={{ "--compare-count": items.length } as React.CSSProperties}
          >
            <div className="compare-label blank" />
            {items.map((p) => (
              <div
                className={`compare-heading ${p.loadError ? "failed" : ""}`}
                key={p.source_id || p.id}
              >
                <span className={`status ${p.status}`}>{p.status}</span>
                <h2>{p.title}</h2>
                <small>
                  <Building2 />
                  {p.organization}
                </small>
                {p.data_quality && (
                  <div className="compare-quality">
                    <i style={{ width: `${p.data_quality.score}%` }} />
                    <span>
                      {p.data_quality.score}% ·{" "}
                      {p.data_quality.status === "VERIFIED"
                        ? "검수 완료"
                        : p.data_quality.status === "EXTRACTED"
                          ? "자동 정리"
                          : "기본 정보"}
                    </span>
                  </div>
                )}
                {p.loadError && (
                  <button onClick={load}>
                    <RefreshCw /> 다시 시도
                  </button>
                )}
              </div>
            ))}
            <Row
              label="지원 분야"
              icon={WalletCards}
              items={items}
              value={(p) => p.category || "기타"}
            />
            <Row
              label="대상 지역"
              icon={MapPin}
              items={items}
              value={(p) => p.region}
            />
            <Row
              label="지원 대상"
              icon={CheckCircle2}
              items={items}
              value={(p) => p.target || "공식 공고 확인 필요"}
            />
            <Row
              label="지원 내용"
              icon={WalletCards}
              items={items}
              value={(p) => p.benefit || "공식 공고 확인 필요"}
            />
            <Row
              label="신청 기간"
              icon={CalendarDays}
              items={items}
              value={(p) => p.period}
            />
            <Row
              label="신청 방법"
              icon={CheckCircle2}
              items={items}
              value={(p) => p.application_method || "공식 공고 확인 필요"}
            />
            <div className="compare-label">공식 공고</div>
            {items.map((p) => (
              <div className="compare-cell" key={`link-${p.source_id || p.id}`}>
                {p.official_url ? (
                  <a href={p.official_url} target="_blank" rel="noreferrer">
                    원문 확인 <ExternalLink />
                  </a>
                ) : (
                  "원문 연결 실패"
                )}
              </div>
            ))}
          </div>
        )}
        <div className="compare-notice">
          자동 정리된 비교 정보는 이해를 돕기 위한 요약입니다. 신청 전 반드시 각
          사업의 공식 공고를 확인해 주세요.
        </div>
      </section>
    </main>
  );
}
function Row({
  label,
  icon: Icon,
  items,
  value,
}: {
  label: string;
  icon: typeof MapPin;
  items: Program[];
  value: (program: Program) => string;
}) {
  return (
    <>
      <div className="compare-label">
        <Icon />
        {label}
      </div>
      {items.map((p) => (
        <div className="compare-cell" key={`${label}-${p.source_id || p.id}`}>
          <CompactValue value={value(p)} />
        </div>
      ))}
    </>
  );
}
function CompactValue({ value }: { value: string }) {
  // 비교 표에서는 핵심만 먼저 보여주고 긴 원문은 사용자가 펼쳐보게 한다.
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= 120) return <span>{clean}</span>;
  return (
    <details className="compact-value">
      <summary>{clean.slice(0, 120)}…</summary>
      <p>{clean}</p>
    </details>
  );
}
export default function ComparePage() {
  return (
    <Suspense>
      <CompareContent />
    </Suspense>
  );
}
