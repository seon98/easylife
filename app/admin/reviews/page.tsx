"use client";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileWarning,
  RefreshCw,
} from "lucide-react";
import Header from "@/components/Header";

type Item = {
  source_id: string;
  title: string;
  organization: string;
  summary: string;
  target: string;
  benefit: string;
  application_method: string;
  official_url: string;
  review_status: string;
};
export default function ReviewsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  // 자동 추출이 완료된 공고를 미검수 순서로 다시 불러온다.
  const load = () => {
    setLoading(true);
    fetch("/api/admin/reviews?limit=100")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  // 승인 여부만 저장하고 공식 원문이나 자동 추출 결과는 변경하지 않는다.
  const update = (id: string, status: string) =>
    fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(load);
  return (
    <main className="page-bg">
      <Header />
      <section className="content-width review-page">
        <p className="page-kicker">운영 관리</p>
        <h1>상세 정보 검수</h1>
        <p>
          자동 추출된 대상과 지원 내용을 원문과 비교한 뒤 상태를 지정하세요.
        </p>
        <div className="review-toolbar">
          <strong>
            {loading ? "불러오는 중…" : `${items.length}건 검수 대기`}
          </strong>
          <button onClick={load}>
            <RefreshCw /> 새로고침
          </button>
        </div>
        {items.map((item) => (
          <article className="review-card" key={item.source_id}>
            <div className="review-card-head">
              <span className={`review-status ${item.review_status}`}>
                {item.review_status}
              </span>
              <small>{item.organization}</small>
              <a href={item.official_url} target="_blank" rel="noreferrer">
                원문 <ExternalLink />
              </a>
            </div>
            <h2>{item.title}</h2>
            <dl>
              <div>
                <dt>사업 개요</dt>
                <dd>{item.summary || "추출 내용 없음"}</dd>
              </div>
              <div>
                <dt>지원 대상</dt>
                <dd>{item.target || "확인 필요"}</dd>
              </div>
              <div>
                <dt>지원 내용</dt>
                <dd>{item.benefit || "확인 필요"}</dd>
              </div>
              <div>
                <dt>신청 방법</dt>
                <dd>{item.application_method || "확인 필요"}</dd>
              </div>
            </dl>
            <div className="review-actions">
              <button
                className="approve"
                onClick={() => update(item.source_id, "APPROVED")}
              >
                <CheckCircle2 /> 승인
              </button>
              <button onClick={() => update(item.source_id, "NEEDS_EDIT")}>
                <FileWarning /> 수정 필요
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
