from __future__ import annotations
import json
import os
import sqlite3
from collectors.bizinfo import DB_PATH, initialize
import psycopg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://easylife:easylife_local@localhost:5432/easylife")

def migrate() -> int:
    """개발용 SQLite 데이터를 운영용 PostgreSQL 스키마로 반복 이전한다."""
    with sqlite3.connect(DB_PATH) as source:
        initialize(source)
        source.row_factory = sqlite3.Row
        rows = [dict(row) for row in source.execute("SELECT * FROM programs")]
    sql = """
      INSERT INTO programs(source_id,title,category,period,ministry,organization,published_at,region,status,official_url,summary,target,benefit,application_method,contact,documents,source_name,source_type,collected_at,detail_collected_at,content_hash,review_status,raw_source_url)
      VALUES(%(source_id)s,%(title)s,%(category)s,%(period)s,%(ministry)s,%(organization)s,NULLIF(%(published_at)s,'')::date,%(region)s,%(status)s,%(official_url)s,%(summary)s,%(target)s,%(benefit)s,%(application_method)s,%(contact)s,%(documents)s::jsonb,%(source_name)s,%(source_type)s,%(collected_at)s::timestamptz,NULLIF(%(detail_collected_at)s,'')::timestamptz,%(content_hash)s,%(review_status)s,%(raw_source_url)s)
      ON CONFLICT(source_id) DO UPDATE SET title=excluded.title,category=excluded.category,period=excluded.period,ministry=excluded.ministry,organization=excluded.organization,published_at=excluded.published_at,region=excluded.region,status=excluded.status,official_url=excluded.official_url,summary=excluded.summary,target=excluded.target,benefit=excluded.benefit,application_method=excluded.application_method,contact=excluded.contact,documents=excluded.documents,collected_at=excluded.collected_at,detail_collected_at=excluded.detail_collected_at,content_hash=excluded.content_hash,review_status=excluded.review_status
    """
    with psycopg.connect(DATABASE_URL) as target:
        for row in rows:
            row["documents"] = row.pop("documents_json", "[]") or "[]"
            row["detail_collected_at"] = row.get("detail_collected_at") or ""
            target.execute(sql, row)
    return len(rows)

if __name__ == "__main__": print(f"PostgreSQL 이전 완료: {migrate()}개")
