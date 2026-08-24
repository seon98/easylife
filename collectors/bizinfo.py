from __future__ import annotations

import argparse
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


def page_rows(session: requests.Session, page: int) -> tuple[list[dict], int]:
    response = session.get(LIST_URL, params={"rows": 15, "cpage": page, "schEndAt": "N"}, timeout=20)
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="기업마당의 공개 지원사업 목록을 API 키 없이 수집합니다.")
    parser.add_argument("--max-pages", type=int, default=None, help="테스트용 최대 페이지 수")
    parser.add_argument("--delay", type=float, default=0.25, help="페이지 요청 간격(초)")
    args = parser.parse_args()
    print(f"완료: {collect(args.max_pages, max(args.delay, 0.2))}개")
