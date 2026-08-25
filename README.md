# 혜택찾기

정부지원사업을 자연어로 검색하고 자격, 지원 내용, 신청 방법과 공식 링크를 한 화면에서 확인하는 MVP입니다.

## 실행

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

다른 터미널에서:

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. API 문서는 `http://localhost:8000/docs`에서 확인할 수 있습니다.

현재 화면은 대표 DEMO 데이터도 포함하며, 실제 운영 전에는 공공데이터 API 수집 작업과 PostgreSQL 연결이 필요합니다.

## API 키 없는 공식 공고 수집

기업마당의 공개 지원사업 목록에서 중앙부처·지자체·공공기관 공고를 SQLite로 가져옵니다.

```bash
source .venv/bin/activate
pip install -r requirements.txt
python -m collectors.bizinfo
```

수집 결과는 `support_programs.db`에 저장되고 검색 API가 자동으로 사용합니다. 원문 주소, 출처 유형과 수집 시각을 함께 보존합니다. 정부24와 인증키가 필요한 공식 API는 우회 수집하지 않습니다.

FastAPI와 Next.js를 함께 실행한 뒤 `http://localhost:3000/data`에서 수집 결과를 검색하고 공식 원문을 확인할 수 있습니다.

상세 공고를 순차 보완하려면 다음처럼 실행합니다. 기관 서버 보호를 위해 요청 간격은 최소 0.3초로 제한됩니다.

```bash
python -m collectors.bizinfo --max-pages 1 --details 100
```

자동 추출 결과는 `http://localhost:3000/admin/reviews`에서 원문과 비교해 승인 또는 수정 필요로 분류할 수 있습니다.

### PostgreSQL 전환

```bash
docker compose up -d postgres
export DATABASE_URL=postgresql://easylife:easylife_local@localhost:5432/easylife
python scripts/migrate_to_postgres.py
```

개발 환경에서는 SQLite를 그대로 사용할 수 있으며, 운영 전환용 PostgreSQL 스키마에는 전문 검색 인덱스와 공고 변경 이력 테이블이 포함되어 있습니다.
