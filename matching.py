from __future__ import annotations

"""자연어 검색 조건을 해석하고 추천 이유를 설명하는 규칙 기반 모듈."""
import re

# 초기 버전에서 인식하는 국내 광역 지역명과 분야별 동의어다.
REGIONS = (
    "서울",
    "부산",
    "대구",
    "인천",
    "광주",
    "대전",
    "울산",
    "세종",
    "경기",
    "강원",
    "충북",
    "충남",
    "전북",
    "전남",
    "경북",
    "경남",
    "제주",
)
CATEGORY_WORDS = {
    "창업": ("창업", "스타트업"),
    "금융": ("대출", "융자", "자금", "금융"),
    "인력": ("취업", "고용", "인턴", "일자리"),
    "기술": ("기술", "R&D", "연구"),
    "주거": ("월세", "주거", "임대"),
}


def parse_conditions(text: str) -> dict:
    """자연어 검색문에서 현재 지원하는 연령·지역·분야 조건을 추출한다."""
    age_match = re.search(r"(?:만\s*)?(\d{2})\s*세", text)
    region = next((item for item in REGIONS if item in text), None)
    category = next(
        (
            category
            for category, words in CATEGORY_WORDS.items()
            if any(word in text for word in words)
        ),
        None,
    )
    return {
        "age": int(age_match.group(1)) if age_match else None,
        "region": region,
        "category": category,
    }


def explain_match(program: dict, conditions: dict) -> dict:
    """자격을 확정하지 않고 조건별 관련성과 확인 필요 항목만 설명한다."""
    checks, score = [], 0
    region = conditions.get("region")
    if region:
        matched = program.get("region") in (region, "전국") or region in (
            program.get("title") or ""
        )
        checks.append(
            {"label": f"{region} 지역", "state": "MATCH" if matched else "MISMATCH"}
        )
        score += 35 if matched else 0
    category = conditions.get("category")
    if category:
        haystack = " ".join(
            str(program.get(key, ""))
            for key in ("title", "category", "summary", "benefit")
        )
        matched = category in haystack or any(
            word in haystack for word in CATEGORY_WORDS.get(category, ())
        )
        checks.append(
            {"label": f"{category} 분야", "state": "MATCH" if matched else "MISMATCH"}
        )
        score += 35 if matched else 0
    age = conditions.get("age")
    if age:
        target = program.get("target") or program.get("summary") or ""
        ranges = re.findall(r"(?:만\s*)?(\d{2})\s*[~～~-]\s*(\d{2})\s*세", target)
        if ranges:
            matched = any(int(start) <= age <= int(end) for start, end in ranges)
            checks.append(
                {"label": f"만 {age}세", "state": "MATCH" if matched else "MISMATCH"}
            )
            score += 30 if matched else 0
        else:
            checks.append({"label": f"만 {age}세", "state": "UNKNOWN"})
    if not checks:
        score = 50
    return {
        "score": score,
        "checks": checks,
        "notice": "관련성 참고 결과이며 최종 자격은 공식 공고에서 확인해야 합니다.",
    }
