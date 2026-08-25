from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.bizinfo.go.kr"
LIST_URL = f"{BASE_URL}/sii/siia/selectSIIA200View.do"
DB_PATH = Path(__file__).resolve().parents[1] / "support_programs.db"
USER_AGENT = "EasyLifeSupportSearch/1.0 (+public-data collector; contact: admin@example.com)"


def clean(value: str) -> str:
    return " ".join(value.split())


def region_from(title: str, ministry: str) -> str:
    match = re.match(r"\[([^]]+)]", title)
    if match:
        return match.group(1).split("·")[0]
    if ministry.endswith(("특별시", "광역시", "특별자치시", "특별자치도")) or ministry in ("경기도", "강원도", "충청북도", "충청남도", "전라북도", "전라남도", "경상북도", "경상남도"):
        return ministry.replace("특별자치도", "").replace("특별시", "").replace("광역시", "").replace("도", "")
    return "전국"


def status_from(period: str) -> str:
    dates = re.findall(r"\d{4}-\d{2}-\d{2}", period)
    today = datetime.now().date()
    if not dates:
        return "상시접수" if "상시" in period else "접수중"
    start = datetime.strptime(dates[0], "%Y-%m-%d").date()
    end = datetime.strptime(dates[-1], "%Y-%m-%d").date()
    if today < start:
        return "접수예정"
    if today > end:
        return "접수마감"
    return "접수중"


def initialize(conn: sqlite3.Connection) -> None:
    """필요한 테이블과 컬럼을 안전하게 생성해 기존 로컬 DB도 자동 업그레이드한다."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS programs (
            source_id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT,
            period TEXT, ministry TEXT, organization TEXT, published_at TEXT,
            region TEXT, status TEXT, official_url TEXT NOT NULL,
            summary TEXT DEFAULT '', application_method TEXT DEFAULT '',
            contact TEXT DEFAULT '', source_name TEXT NOT NULL,
            source_type TEXT NOT NULL, collected_at TEXT NOT NULL,
            raw_source_url TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_programs_title ON programs(title)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status)")
    existing = {row[1] for row in conn.execute("PRAGMA table_info(programs)")}
    additions = {
        "target": "TEXT DEFAULT ''", "benefit": "TEXT DEFAULT ''",
        "documents_json": "TEXT DEFAULT '[]'", "detail_collected_at": "TEXT",
        "content_hash": "TEXT DEFAULT ''", "review_status": "TEXT DEFAULT 'PENDING'",
    }
    for column, definition in additions.items():
        if column not in existing:
            conn.execute(f"ALTER TABLE programs ADD COLUMN {column} {definition}")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS program_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL,
            content_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL,
            detected_at TEXT NOT NULL, UNIQUE(source_id, content_hash)
        )
    """)


def page_rows(session: requests.Session, page: int, ended: bool = False) -> tuple[list[dict], int]:
    """기업마당 목록 한 페이지를 공통 프로그램 필드로 변환한다."""
    response = session.get(LIST_URL, params={"rows": 15, "cpage": page, "schEndAt": "Y" if ended else "N"}, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    rows = []
    for tr in soup.select(".table_Type_1 tbody tr"):
        cells = tr.find_all("td", recursive=False)
        link = tr.select_one("a[href*='pblancId=']")
        if len(cells) < 8 or not link:
            continue
        href = link.get("href", "")
        source_id = parse_qs(urlparse(href).query).get("pblancId", [""])[0]
        title = clean(link.get_text(" ", strip=True))
        period, ministry, organization = (clean(cells[i].get_text(" ", strip=True)) for i in (3, 4, 5))
        rows.append({
            "source_id": source_id, "title": title, "category": clean(cells[1].get_text(" ", strip=True)),
            "period": period, "ministry": ministry, "organization": organization,
            "published_at": clean(cells[6].get_text(" ", strip=True)), "region": region_from(title, ministry),
            "status": status_from(period), "official_url": urljoin(BASE_URL, href),
        })
    last_link = soup.select_one("a[title='마지막페이지']")
    last_page = int(parse_qs(urlparse(last_link["href"]).query).get("cpage", [page])[0]) if last_link else page
    return rows, last_page


def collect(max_pages: int | None = None, delay: float = 0.25) -> int:
    """접수 중인 공고 목록을 순회하며 source_id 기준으로 추가하거나 갱신한다."""
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9"})
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        initialize(conn)
        first_rows, last_page = page_rows(session, 1)
        final_page = min(last_page, max_pages) if max_pages else last_page
        total = 0
        for page in range(1, final_page + 1):
            rows = first_rows if page == 1 else page_rows(session, page)[0]
            for item in rows:
                conn.execute("""
                    INSERT INTO programs(source_id,title,category,period,ministry,organization,published_at,region,status,official_url,source_name,source_type,collected_at,raw_source_url)
                    VALUES(:source_id,:title,:category,:period,:ministry,:organization,:published_at,:region,:status,:official_url,'기업마당','OFFICIAL_WEB',:collected_at,:official_url)
                    ON CONFLICT(source_id) DO UPDATE SET title=excluded.title,category=excluded.category,period=excluded.period,ministry=excluded.ministry,organization=excluded.organization,published_at=excluded.published_at,region=excluded.region,status=excluded.status,official_url=excluded.official_url,collected_at=excluded.collected_at
                """, {**item, "collected_at": now})
            total += len(rows)
            conn.commit()
            if page < final_page:
                time.sleep(delay)
            print(f"[{page}/{final_page}] {total}개 수집", flush=True)
    return total


def collect_closed(max_pages: int = 5, delay: float = 0.25) -> int:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9"})
    now = datetime.now(timezone.utc).isoformat()
    total = 0
    with sqlite3.connect(DB_PATH) as conn:
        initialize(conn)
        for page in range(1, max_pages + 1):
            rows, _ = page_rows(session, page, ended=True)
            for item in rows:
                conn.execute("""INSERT INTO programs(source_id,title,category,period,ministry,organization,published_at,region,status,official_url,source_name,source_type,collected_at,raw_source_url) VALUES(:source_id,:title,:category,:period,:ministry,:organization,:published_at,:region,:status,:official_url,'기업마당','OFFICIAL_WEB',:collected_at,:official_url) ON CONFLICT(source_id) DO UPDATE SET status=excluded.status,period=excluded.period,collected_at=excluded.collected_at""", {**item, "collected_at": now})
            conn.commit()
            total += len(rows)
            if page < max_pages: time.sleep(max(delay, 0.2))
    return total


def labeled_value(soup: BeautifulSoup, label: str) -> str:
    for item in soup.select(".view_cont > ul > li"):
        title = item.select_one(".s_title")
        value = item.select_one(".txt")
        if title and value and clean(title.get_text(" ", strip=True)) == label:
            return clean(value.get_text("\n", strip=True))
    return ""


def infer_target(summary: str) -> str:
    """공고 개요에서 대상과 관련된 문장만 보수적으로 골라낸다."""
    candidates = []
    for line in summary.splitlines():
        normalized = clean(line).lstrip("☞-ㆍ· ")
        if any(word in normalized for word in ("대상", "기업", "소상공인", "청년", "근로자", "창업자", "거주")):
            candidates.append(normalized)
    return " ".join(candidates[:3])[:1000]


def infer_benefit(summary: str) -> str:
    """금액·융자·지원 표현이 있는 문장을 지원 내용 후보로 골라낸다."""
    candidates = []
    for line in summary.splitlines():
        normalized = clean(line).lstrip("☞-ㆍ· ")
        if any(word in normalized for word in ("지원", "최대", "한도", "만원", "억원", "보조", "융자")):
            candidates.append(normalized)
    return " ".join(candidates[-3:])[:1000]


def detail_record(session: requests.Session, row: dict) -> dict:
    """공식 상세 페이지를 읽어 비교 화면에 필요한 상세 필드를 구조화한다."""
    response = session.get(row["official_url"], timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    summary_node = next((item.select_one(".txt") for item in soup.select(".view_cont > ul > li") if item.select_one(".s_title") and clean(item.select_one(".s_title").get_text(" ", strip=True)) == "사업개요"), None)
    summary = "\n".join(clean(line) for line in summary_node.get_text("\n", strip=True).splitlines() if clean(line)) if summary_node else ""
    application_method = labeled_value(soup, "사업신청 방법")
    contact = labeled_value(soup, "문의처")
    file_names = [clean(node.get("title", "") or node.get_text(" ", strip=True)) for node in soup.select("#iframe[title], a[onclick*='fileLoad']")]
    documents = [name for name in dict.fromkeys(file_names) if name]
    record = {
        "summary": summary, "target": infer_target(summary), "benefit": infer_benefit(summary),
        "application_method": application_method, "contact": contact,
        "documents_json": json.dumps(documents, ensure_ascii=False),
    }
    record["content_hash"] = hashlib.sha256(json.dumps(record, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return record


def collect_details(limit: int = 50, delay: float = 0.4, refresh: bool = False) -> int:
    """상세정보가 없는 최신 공고를 제한된 수만큼 순차 보완한다."""
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9"})
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        initialize(conn)
        condition = "1=1" if refresh else "detail_collected_at IS NULL"
        conn.row_factory = sqlite3.Row
        rows = [dict(row) for row in conn.execute(f"SELECT * FROM programs WHERE {condition} ORDER BY published_at DESC LIMIT ?", (limit,))]
        completed = 0
        for row in rows:
            try:
                detail = detail_record(session, row)
                snapshot = json.dumps({**row, **detail}, ensure_ascii=False, sort_keys=True)
                conn.execute("INSERT OR IGNORE INTO program_versions(source_id,content_hash,snapshot_json,detected_at) VALUES(?,?,?,?)", (row["source_id"], detail["content_hash"], snapshot, now))
                conn.execute("""UPDATE programs SET summary=:summary,target=:target,benefit=:benefit,application_method=:application_method,contact=:contact,documents_json=:documents_json,content_hash=:content_hash,detail_collected_at=:now,review_status='PENDING' WHERE source_id=:source_id""", {**detail, "now": now, "source_id": row["source_id"]})
                conn.commit()
                completed += 1
                print(f"[{completed}/{len(rows)}] {row['title']}", flush=True)
            except requests.RequestException as error:
                print(f"[건너뜀] {row['source_id']}: {error}", flush=True)
            time.sleep(max(delay, 0.3))
    return completed


def enrich_program(source_id: str, refresh: bool = False) -> dict | None:
    """사용자가 연 공고 한 건만 즉시 보완하고 결과를 캐시한다."""
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9"})
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        initialize(conn)
        conn.row_factory = sqlite3.Row
        row_value = conn.execute("SELECT * FROM programs WHERE source_id=?", (source_id,)).fetchone()
        if not row_value:
            return None
        row = dict(row_value)
        if row.get("detail_collected_at") and not refresh:
            return row
        detail = detail_record(session, row)
        snapshot = json.dumps({**row, **detail}, ensure_ascii=False, sort_keys=True)
        conn.execute("INSERT OR IGNORE INTO program_versions(source_id,content_hash,snapshot_json,detected_at) VALUES(?,?,?,?)", (source_id, detail["content_hash"], snapshot, now))
        conn.execute("""UPDATE programs SET summary=:summary,target=:target,benefit=:benefit,application_method=:application_method,contact=:contact,documents_json=:documents_json,content_hash=:content_hash,detail_collected_at=:now,review_status='PENDING' WHERE source_id=:source_id""", {**detail, "now": now, "source_id": source_id})
        conn.commit()
        updated = conn.execute("SELECT * FROM programs WHERE source_id=?", (source_id,)).fetchone()
        return dict(updated) if updated else None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="기업마당의 공개 지원사업 목록을 API 키 없이 수집합니다.")
    parser.add_argument("--max-pages", type=int, default=None, help="테스트용 최대 페이지 수")
    parser.add_argument("--delay", type=float, default=0.25, help="페이지 요청 간격(초)")
    parser.add_argument("--details", type=int, default=0, help="상세 내용을 보완할 최대 공고 수")
    parser.add_argument("--refresh-details", action="store_true", help="이미 수집한 상세 내용도 다시 확인")
    parser.add_argument("--closed-pages", type=int, default=0, help="최근 마감 공고를 가져올 페이지 수")
    args = parser.parse_args()
    print(f"목록 완료: {collect(args.max_pages, max(args.delay, 0.2))}개")
    if args.details:
        print(f"상세 완료: {collect_details(args.details, max(args.delay, 0.3), args.refresh_details)}개")
    if args.closed_pages:
        print(f"마감 공고 완료: {collect_closed(args.closed_pages, max(args.delay, 0.2))}개")
