from __future__ import annotations

"""프론트엔드가 사용하는 검색·상세·매칭·검수 FastAPI 진입점."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from data import PROGRAMS
from collectors.bizinfo import enrich_program
from matching import explain_match, parse_conditions
from repository import (
    collected_stats,
    get_collected,
    review_queue,
    search_collected,
    set_review_status,
    with_quality,
)

app = FastAPI(title="혜택찾기 API", version="1.0.0")
# Next.js 개발 서버에서 직접 API를 호출할 수 있도록 로컬 CORS만 허용한다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/programs")
def search_programs(
    q: str = "",
    region: str | None = None,
    category: str | None = None,
    status: str | None = None,
    limit: int = 100,
):
    """수집 DB를 우선 검색하고, DB가 비어 있을 때만 DEMO 데이터로 대체한다."""
    collected = search_collected(q, region, category, status, limit)
    if collected or collected_stats()["total"]:
        return {
            "items": collected,
            "total": len(collected),
            "query": q,
            "source": "collected",
        }
    tokens = q.lower().split()
    results = []
    for program in PROGRAMS:
        haystack = " ".join(
            str(program.get(key, ""))
            for key in (
                "title",
                "organization",
                "summary",
                "target",
                "region",
                "category",
                "tags",
            )
        ).lower()
        if tokens and not all(token in haystack for token in tokens):
            continue
        if region and region != "전체" and program["region"] != region:
            continue
        if category and category != "전체" and program["category"] != category:
            continue
        if status and status != "전체" and program["status"] != status:
            continue
        results.append(program)
    return {"items": results, "total": len(results), "query": q}


@app.get("/api/collected/stats")
def get_collected_stats():
    """데이터 현황 화면에 표시할 사업·기관 수를 반환한다."""
    return collected_stats()


@app.get("/api/match")
def match_programs(q: str, limit: int = 30):
    """검색 조건과 조건별 관련성 근거를 함께 반환한다."""
    conditions = parse_conditions(q)
    candidates = search_collected(
        "", conditions.get("region"), None, None, min(limit * 5, 200)
    )
    ranked = [
        {**program, "match": explain_match(program, conditions)}
        for program in candidates
    ]
    ranked.sort(key=lambda item: item["match"]["score"], reverse=True)
    return {
        "conditions": conditions,
        "items": ranked[:limit],
        "notice": "최종 지원 대상 여부는 공식 공고에서 확인해주세요.",
    }


class ReviewUpdate(BaseModel):
    """운영자가 지정할 검수 상태 요청 본문."""

    status: str


@app.get("/api/admin/reviews")
def get_reviews(limit: int = 100):
    """상세정보가 추출된 사업을 운영자 검수 순서로 반환한다."""
    return {"items": review_queue(limit)}


@app.patch("/api/admin/reviews/{source_id}")
def update_review(source_id: str, body: ReviewUpdate):
    """검수 상태를 허용된 값으로만 변경한다."""
    if not set_review_status(source_id, body.status):
        raise HTTPException(status_code=400, detail="검수 상태를 변경할 수 없습니다.")
    return {"source_id": source_id, "status": body.status}


@app.get("/api/programs/{program_id}")
def get_program(program_id: str):
    """공식 수집 데이터를 우선 반환하고 개발용 ID도 하위 호환한다."""
    collected = get_collected(program_id)
    if collected:
        return collected
    program = next((item for item in PROGRAMS if str(item["id"]) == program_id), None)
    if not program:
        raise HTTPException(status_code=404, detail="지원사업을 찾을 수 없습니다.")
    return program


@app.post("/api/programs/{program_id}/enrich")
def enrich_program_detail(program_id: str):
    """상세·비교 화면에서 요청한 공고 한 건을 공식 원문으로 보완한다."""
    try:
        program = enrich_program(program_id)
    except Exception as error:
        raise HTTPException(
            status_code=502, detail="공식 공고 상세정보를 가져오지 못했습니다."
        ) from error
    if not program:
        raise HTTPException(status_code=404, detail="지원사업을 찾을 수 없습니다.")
    return with_quality(program)
