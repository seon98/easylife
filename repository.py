from __future__ import annotations
import sqlite3
from collectors.bizinfo import DB_PATH

def search_collected(q: str = "", region: str | None = None, category: str | None = None, status: str | None = None, limit: int = 100):
    if not DB_PATH.exists(): return []
    clauses, values = [], []
    for token in q.split():
        clauses.append("(title LIKE ? OR ministry LIKE ? OR organization LIKE ?)")
        values.extend([f"%{token}%"] * 3)
    for column, value in (("region", region), ("category", category), ("status", status)):
        if value and value != "전체": clauses.append(f"{column} = ?"); values.append(value)
    sql = "SELECT * FROM programs" + (" WHERE " + " AND ".join(clauses) if clauses else "") + " ORDER BY published_at DESC LIMIT ?"
    values.append(min(limit, 500))
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(sql, values)]

def collected_stats():
    if not DB_PATH.exists(): return {"total": 0, "ministries": 0, "organizations": 0, "collected_at": None}
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT COUNT(*), COUNT(DISTINCT ministry), COUNT(DISTINCT organization), MAX(collected_at) FROM programs").fetchone()
    return {"total": row[0], "ministries": row[1], "organizations": row[2], "collected_at": row[3]}
