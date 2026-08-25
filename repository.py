from __future__ import annotations

"""SQLite 조회와 화면용 데이터 품질 계산을 담당하는 저장소 계층."""
import sqlite3
from collectors.bizinfo import DB_PATH


def with_quality(program: dict):
    """필수 상세 필드의 존재 여부로 사용자에게 보여줄 정보 완성도를 계산한다."""
    fields = {
        "기본정보": bool(program.get("title") and program.get("period")),
        "지원 대상": bool(program.get("target")),
        "지원 내용": bool(program.get("benefit")),
        "신청 방법": bool(program.get("application_method")),
        "문의처": bool(program.get("contact")),
        "제출 문서": bool(
            program.get("documents_json") and program.get("documents_json") != "[]"
        ),
    }
    completed = sum(fields.values())
    review = program.get("review_status") or "PENDING"
    quality = (
        "VERIFIED"
        if review == "APPROVED"
        else "EXTRACTED" if program.get("detail_collected_at") else "BASIC"
    )
    return {
        **program,
        "data_quality": {
            "score": round(completed / len(fields) * 100),
            "status": quality,
            "fields": fields,
        },
    }


def search_collected(
    q: str = "",
    region: str | None = None,
    category: str | None = None,
    status: str | None = None,
    limit: int = 100,
):
    """키워드는 주요 텍스트 전체에서, 필터는 정규화 컬럼에서 검색한다."""
    if not DB_PATH.exists():
        return []
    clauses, values = [], []
    for token in q.split():
        clauses.append(
            "(title LIKE ? OR ministry LIKE ? OR organization LIKE ? OR summary LIKE ? OR target LIKE ? OR benefit LIKE ?)"
        )
        values.extend([f"%{token}%"] * 6)
    for column, value in (
        ("region", region),
        ("category", category),
        ("status", status),
    ):
        if value and value != "전체":
            clauses.append(f"{column} = ?")
            values.append(value)
    sql = (
        "SELECT * FROM programs"
        + (" WHERE " + " AND ".join(clauses) if clauses else "")
        + " ORDER BY published_at DESC LIMIT ?"
    )
    values.append(min(limit, 500))
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return [with_quality(dict(row)) for row in conn.execute(sql, values)]


def collected_stats():
    """전체 사업과 고유 기관 수, 마지막 수집 시각을 집계한다."""
    if not DB_PATH.exists():
        return {"total": 0, "ministries": 0, "organizations": 0, "collected_at": None}
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT COUNT(*), COUNT(DISTINCT ministry), COUNT(DISTINCT organization), MAX(collected_at) FROM programs"
        ).fetchone()
    return {
        "total": row[0],
        "ministries": row[1],
        "organizations": row[2],
        "collected_at": row[3],
    }


def get_collected(source_id: str):
    """기업마당의 고유 공고 ID로 한 건을 조회한다."""
    if not DB_PATH.exists():
        return None
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM programs WHERE source_id = ?", (source_id,)
        ).fetchone()
    return with_quality(dict(row)) if row else None


def review_queue(limit: int = 100):
    """상세 추출이 끝난 공고를 미검수 항목부터 운영자에게 제공한다."""
    if not DB_PATH.exists():
        return []
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return [
            dict(row)
            for row in conn.execute(
                "SELECT * FROM programs WHERE detail_collected_at IS NOT NULL ORDER BY CASE review_status WHEN 'PENDING' THEN 0 ELSE 1 END, detail_collected_at DESC LIMIT ?",
                (min(limit, 200),),
            )
        ]


def set_review_status(source_id: str, status: str) -> bool:
    """허용된 검수 상태만 저장하고 실제 변경 여부를 반환한다."""
    if status not in {"PENDING", "APPROVED", "NEEDS_EDIT"}:
        return False
    with sqlite3.connect(DB_PATH) as conn:
        result = conn.execute(
            "UPDATE programs SET review_status=? WHERE source_id=?", (status, source_id)
        )
        conn.commit()
    return result.rowcount > 0
