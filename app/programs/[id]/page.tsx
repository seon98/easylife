"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  MapPin,
  Phone,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import Header from "@/components/Header";
type Quality = {
  score: number;
  status: "BASIC" | "EXTRACTED" | "VERIFIED";
  fields: Record<string, boolean>;
};
type Program = {
  title: string;
  category: string;
  period: string;
  ministry?: string;
  organization: string;
  region: string;
  status: string;
  official_url: string;
  summary?: string;
  application_method?: string;
  contact?: string;
  source_name?: string;
  collected_at?: string;
  target?: string;
  benefit?: string;
  requirements?: string[];
  documents?: string[];
  how_to?: string;
  notice_url?: string;
  source?: string;
  documents_json?: string;
  data_quality?: Quality;
};
export default function Detail() {
  const id = String(useParams().id);
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(false);
  // 기본 목록 정보만 있는 공고는 상세 페이지 최초 접근 때 한 번 보완한다.
  useEffect(() => {
    fetch(`/api/programs/${encodeURIComponent(id)}`)
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(async (data: Program) => {
        setProgram(data);
        if (data.data_quality?.status === "BASIC") {
          setEnriching(true);
          try {
            const response = await fetch(
              `/api/programs/${encodeURIComponent(id)}/enrich`,
              { method: "POST" },
            );
            if (!response.ok) throw new Error();
            setProgram(await response.json());
          } catch {
            setEnrichError(true);
          } finally {
            setEnriching(false);
          }
        }
      })
      .catch(() => setProgram(null))
      .finally(() => setLoading(false));
  }, [id]);
  if (loading)
    return (
      <main className="page-bg">
        <Header />
        <div className="empty">
          <p>지원사업 정보를 불러오는 중입니다…</p>
        </div>
      </main>
    );
  if (!program)
    return (
      <main className="page-bg">
        <Header />
        <div className="empty">
          <h2>지원사업을 찾을 수 없습니다.</h2>
          <a className="primary-action" href="/search">
            검색으로 돌아가기
          </a>
        </div>
      </main>
    );
  const p = program;
  const description =
    p.summary ||
    "공식 공고에서 지원 대상과 상세 지원 내용을 확인할 수 있습니다.";
  let documents: string[] = p.documents || [];
  try {
    if (!documents.length && p.documents_json)
      documents = JSON.parse(p.documents_json);
  } catch {}
  return (
    <main className="page-bg">
      <Header />
      <div className="content-width detail-wrap">
        <a className="back" href="/search">
          <ArrowLeft /> 검색 결과로
        </a>
        {p.data_quality && (
          <QualityBanner
            quality={p.data_quality}
            enriching={enriching}
            error={enrichError}
          />
        )}
        <div className="detail-grid">
          <article className="detail-main">
            <div className="badges">
              <span className={`status ${p.status}`}>{p.status}</span>
              <span>{p.category || "기타"}</span>
              <span>{p.source_name || p.source || "공식 웹"}</span>
            </div>
            <h1>{p.title}</h1>
            <p className="org">
              <Building2 />
              {p.ministry ? `${p.ministry} · ` : ""}
              {p.organization}
            </p>
            <ReadableText value={description} summary />
            <div className="quick-grid">
              <Quick
                icon={UserRound}
                label="지원 대상"
                value={shortText(p.target || "공식 공고에서 확인", 72)}
              />
              <Quick
                icon={FileText}
                label="지원 내용"
                value={shortText(p.benefit || "공식 공고에서 확인", 72)}
              />
              <Quick icon={CalendarDays} label="신청 기간" value={p.period} />
              <Quick icon={MapPin} label="대상 지역" value={p.region} />
            </div>
            <div className="notice">
              <ShieldAlert />
              <p>
                <strong>자격 확인 안내</strong>입력한 조건과 관련성이 높은
                사업입니다. 최종 지원 대상 여부는 공식 공고에서 확인해 주세요.
              </p>
            </div>
            <Info title="상세 지원 자격" icon={UserRound}>
              <ReadableText
                value={
                  p.target ||
                  "현재 공개 목록에는 상세 자격이 포함되지 않았습니다. 공식 공고 원문에서 정확한 조건을 확인해 주세요."
                }
              />
            </Info>
            <Info title="무엇을 지원하나요?" icon={FileText}>
              <ReadableText
                value={
                  p.benefit ||
                  "지원 금액과 상세 내용은 공식 공고에서 확인해 주세요."
                }
              />
            </Info>
            <Info title="어떻게 신청하나요?" icon={FileText}>
              <ReadableText
                value={
                  p.application_method ||
                  p.how_to ||
                  "신청 방법과 제출서류는 공식 공고 원문에서 확인할 수 있습니다."
                }
              />
            </Info>
            <PreparationChecklist
              programId={id}
              documents={documents}
              hasTarget={Boolean(p.target)}
              hasMethod={Boolean(p.application_method || p.how_to)}
            />
          </article>
          <aside className="action-card">
            <span>신청 기간</span>
            <strong>{p.period}</strong>
            <b>{p.status}</b>
            <a
              href={p.official_url}
              target="_blank"
              rel="noreferrer"
              className="primary-action"
            >
              공식 공고 확인하기 <ExternalLink />
            </a>
            {p.notice_url && p.notice_url !== p.official_url && (
              <a
                href={p.notice_url}
                target="_blank"
                rel="noreferrer"
                className="secondary-action"
              >
                <FileText /> 공고문 확인하기
              </a>
            )}
            <div className="contact">
              <Phone />
              <span>
                문의처
                <small>{p.contact || `${p.organization} 공식 공고 참조`}</small>
              </span>
            </div>
            {p.collected_at && (
              <p className="collected-time">
                마지막 수집: {new Date(p.collected_at).toLocaleString("ko-KR")}
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
function QualityBanner({
  quality,
  enriching,
  error,
}: {
  quality: Quality;
  enriching: boolean;
  error: boolean;
}) {
  const label =
    quality.status === "VERIFIED"
      ? "운영자 검수 완료"
      : quality.status === "EXTRACTED"
        ? "공식 공고 자동 정리"
        : "기본 공고 정보";
  return (
    <div className={`quality-banner ${quality.status}`}>
      <div>
        <strong>{label}</strong>
        <span>정보 완성도 {quality.score}%</span>
      </div>
      <div className="quality-track">
        <i style={{ width: `${quality.score}%` }} />
      </div>
      <small>
        {enriching
          ? "공식 공고에서 상세정보를 확인하고 있습니다…"
          : error
            ? "일부 정보는 공식 공고에서 직접 확인해 주세요."
            : "자동 정리된 내용은 원문과 함께 확인해 주세요."}
      </small>
    </div>
  );
}
function Quick({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="quick">
      <Icon />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function Info({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="info-section">
      <h2>
        <span>
          <Icon />
        </span>
        {title}
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

function shortText(value: string, length: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}

function ReadableText({
  value,
  summary = false,
}: {
  value: string;
  summary?: boolean;
}) {
  // 공고문의 기호와 줄바꿈을 목록으로 바꿔 긴 자동 추출 문장을 읽기 쉽게 만든다.
  const normalized = value
    .replace(/\s*[☞※]\s*/g, "\n")
    .replace(/\s+-\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  const items = normalized
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const content =
    items.length > 1 ? (
      <ul className="readable-list">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    ) : (
      <p>{normalized}</p>
    );
  if (!summary || normalized.length <= 220)
    return (
      <div className={summary ? "detail-summary" : "readable-text"}>
        {content}
      </div>
    );
  return (
    <div className="detail-summary">
      <p>{shortText(normalized, 220)}</p>
      <details>
        <summary>사업 개요 전체 보기</summary>
        <div className="readable-text">{content}</div>
      </details>
    </div>
  );
}
function PreparationChecklist({
  programId,
  documents,
  hasTarget,
  hasMethod,
}: {
  programId: string;
  documents: string[];
  hasTarget: boolean;
  hasMethod: boolean;
}) {
  // 체크 상태는 사업별 키로 저장해 페이지를 다시 열어도 준비 진행률을 유지한다.
  const base = [
    {
      id: "eligibility",
      label: "지원 대상과 제외 조건 확인",
      hint: hasTarget
        ? "추출된 지원 대상을 공식 공고와 비교하세요."
        : "공식 공고에서 지원 대상을 확인하세요.",
    },
    {
      id: "period",
      label: "신청 마감일을 일정에 등록",
      hint: "마감 당일보다 2~3일 먼저 제출하는 것을 권장해요.",
    },
    ...documents.map((document, index) => ({
      id: `document-${index}`,
      label: document,
      hint: "제출 전 발급일과 유효기간을 확인하세요.",
    })),
    {
      id: "method",
      label: "신청 방법과 제출처 확인",
      hint: hasMethod
        ? "안내된 접수 방법을 다시 확인하세요."
        : "공식 공고에서 접수 방법을 확인하세요.",
    },
    {
      id: "final",
      label: "공식 공고 최종 확인",
      hint: "변경 공고와 추가 안내가 없는지 확인하세요.",
    },
  ];
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(
    () =>
      setChecked(
        JSON.parse(localStorage.getItem(`checklist:${programId}`) || "[]"),
      ),
    [programId],
  );
  const toggle = (item: string) => {
    const next = checked.includes(item)
      ? checked.filter((value) => value !== item)
      : [...checked, item];
    setChecked(next);
    localStorage.setItem(`checklist:${programId}`, JSON.stringify(next));
  };
  const percent = Math.round((checked.length / base.length) * 100);
  return (
    <section className="prep-section">
      <div className="prep-heading">
        <span>
          <ClipboardCheck />
        </span>
        <div>
          <h2>신청 준비 체크리스트</h2>
          <p>확인한 항목은 이 기기에 자동 저장됩니다.</p>
        </div>
        <strong>{percent}%</strong>
      </div>
      <div className="prep-progress">
        <i style={{ width: `${percent}%` }} />
      </div>
      <div className="prep-list">
        {base.map((item) => (
          <button
            className={checked.includes(item.id) ? "checked" : ""}
            onClick={() => toggle(item.id)}
            key={item.id}
          >
            <span>{checked.includes(item.id) ? <CheckCircle2 /> : null}</span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
