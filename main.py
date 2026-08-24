from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from data import PROGRAMS
from repository import collected_stats, search_collected

app = FastAPI(title="혜택찾기 API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
def health(): return {"status": "ok"}

@app.get("/api/programs")
def search_programs(q: str = "", region: str | None = None, category: str | None = None, status: str | None = None, limit: int = 100):
    collected = search_collected(q, region, category, status, limit)
    if collected:
        return {"items": collected, "total": len(collected), "query": q, "source": "collected"}
    tokens = q.lower().split()
    results = []
    for program in PROGRAMS:
        haystack = " ".join(str(program.get(key, "")) for key in ("title", "organization", "summary", "target", "region", "category", "tags")).lower()
        if tokens and not all(token in haystack for token in tokens): continue
        if region and region != "전체" and program["region"] != region: continue
        if category and category != "전체" and program["category"] != category: continue
        if status and status != "전체" and program["status"] != status: continue
        results.append(program)
    return {"items": results, "total": len(results), "query": q}

@app.get("/api/collected/stats")
def get_collected_stats():
    return collected_stats()

@app.get("/api/programs/{program_id}")
def get_program(program_id: int):
    program = next((item for item in PROGRAMS if item["id"] == program_id), None)
    if not program: raise HTTPException(status_code=404, detail="지원사업을 찾을 수 없습니다.")
    return program
