# 기업 상세 페이지 (company-detail) — 요구사항

> 근거 문서: `docs/prd.md` 3장(기업 상세 페이지)·5장(IA `/companies/[ticker]`), `docs/userflow.md` 020, `docs/usecases/020/spec.md`, `docs/usecases/000_decisions.md`(B-5, B-6, C-5 — spec과 충돌 시 이 문서 우선), `docs/techstack.md` §1·§4.
> 라우트: `/companies/[ticker]` (`apps/web/src/app/(public)/companies/[ticker]/page.tsx`) — 비로그인 열람 가능(공개 페이지).
> 본 페이지는 **조회 전용**이다. 어떠한 데이터 변경(사이드이펙트)도 발생시키지 않으며, 모든 데이터는 배치가 사전 적재한 자체 DB에서만 읽는다(요청 시점 외부 API 호출 없음).

---

## 1. 페이지 개요

상장기업 1개(티커 기준)에 대해 아래 6개 섹션을 표시한다.

| # | 섹션 | 내용 | 데이터 근원 |
|---|---|---|---|
| S1 | 기업 정형 정보 | 회사명/티커/시장/업종/대표자/설립일/홈페이지 + 상장 상태 배지 + 데이터 출처·최종 수집 시각 | `GET /api/companies/:ticker` |
| S2 | 분기 재무 | 2015 사업연도 이후 분기별 매출/영업이익/순이익 — 표 + 그래프 | `GET /api/securities/:securityId/financials` |
| S3 | 주요 공시 | 최신순 목록(제목/일자/원문 링크), 더보기 페이지네이션 | `GET /api/securities/:securityId/disclosures` |
| S4 | 주가·시가총액 | 일봉 캔들차트 + 시총 추이(일별 종가 × 최신 상장주식수), 기간 선택, '주식수 기준일' 주석 | `GET /api/securities/:securityId/quotes` |
| S5 | 소속 밸류체인 | 이 기업이 포함된 체인 목록 + 현황 요약. 비로그인=공식 체인만, 로그인=공식+내 체인(서버 측 필터) | `GET /api/securities/:securityId/valuechains` |
| S6 | 출처·법적 고지 | 시장별 출처(KRX=DART+토스증권, US=SEC EDGAR+토스증권), 섹션별 최종 수집 시각 | S1 응답의 `dataSources` 메타 |

서술형 기업 개요는 제공하지 않는다(PRD Non-Goals). 섹션은 **독립적으로 로드·실패**한다 — 한 섹션의 오류가 페이지 전체 실패로 확산하지 않는다(UC-020 E8, E16).

## 2. 사용자가 할 수 있는 행동과 데이터 변화 흐름

### 2.1 페이지 진입 (검색 결과 선택 / 밸류체인 노드 클릭 / 직접 링크)

1. URL의 `ticker`(경로)와 `market`(쿼리, 선택)으로 기업 식별 API(S1)를 호출한다.
2. 성공 시 응답의 `securityId`로 S2~S5의 4개 API를 **병렬** 호출한다. 이때 S2·S4의 쿼리 파라미터는 페이지의 기간 선택 상태에서 파생된다.
3. 각 섹션은 자기 쿼리의 로딩/성공/실패에 따라 스켈레톤 → 콘텐츠 또는 오류 폴백을 렌더링한다.

**식별 실패 분기** (S1 응답에 따라 페이지 전체 분기):

- `404 COMPANY_NOT_FOUND`: 미존재/미상장 안내 화면 + 메인·검색 유도. S2~S5는 호출하지 않는다(`securityId` 부재).
- `409 TICKER_AMBIGUOUS`: 동일 티커가 KRX·US 양 시장에 존재 + `market` 미지정. 시장 선택 UI를 표시하고, 사용자가 시장을 선택하면 **URL 쿼리 `?market=`을 갱신**하여 S1을 재조회한다(000_decisions B-6 — 시장 구분은 URL이 보유).
- `listingStatus`가 `delisted`/`suspended`: 접근을 막지 않고 상태 배지를 표시하며 보유 과거 데이터를 그대로 보여준다(000_decisions B-5).

### 2.2 주가/시총 차트 기간 선택 (S4)

- 사용자가 기간 프리셋(예: 1개월/3개월/6개월/1년/3년/전체)을 선택한다. 기본값은 상수(`QUOTES_DEFAULT_PERIOD`, 000_decisions C-5의 "최근 1년" 정책 준용).
- 프리셋 선택 → 페이지 상태 `quotesPeriod` 변경 → `from`/`to` 날짜가 **파생 계산**(오늘 기준, 미래 보정) → quotes 쿼리 키 변경 → TanStack Query가 해당 기간을 재조회 → 캔들차트·시총 추이 갱신.
- 종가 미확정(`isClosingConfirmed=false`) 일자는 미확정 표기, 차트는 거래일만 x축에 표시한다.
- `sharesMeta`가 `null`이면 시총 추이를 표시하지 않고 안내만 노출한다(E9).

### 2.3 분기 재무 조회 기간 조작 (S2)

- 사용자가 연도 범위 프리셋(예: 최근 3년/5년/10년/전체)을 선택한다. 기본값은 상수(`FINANCIALS_DEFAULT_PERIOD`).
- 프리셋 선택 → 페이지 상태 `financialsPeriod` 변경 → `fromYear`/`toYear`가 파생 계산(하한 `TIMESERIES_MIN_START_YEAR = 2015`로 클램프) → financials 쿼리 재조회 → 표 + 그래프 갱신.
- `isRevenueTagUnmapped=true` 행은 매출 항목 제외/주석(E6), `annotations.isAnnualOnly=true`면 연간 축 + "분기 미제공" 주석(E7), 결측 구간은 부분 표시 + 안내(E5).

### 2.4 공시 목록 더보기 (S3)

- 초기 1페이지(`DISCLOSURES_PAGE_SIZE` 상수)를 표시하고, `hasMore=true`면 "더보기" 버튼을 노출한다.
- 더보기 클릭 → 다음 페이지를 조회해 목록에 **누적**한다. 페이지 커서·누적 목록·`hasMore`는 모두 서버 상태(TanStack Query `useInfiniteQuery`)가 관리하며 페이지 자체 상태로 두지 않는다.
- 공시 항목 클릭 → 저장된 `url`로 외부 원문(DART/SEC)을 **새 창**으로 연다(서버 프록시 없음, 데이터 변화 없음).
- 공시 없음(빈 배열)은 오류와 구분되는 빈 목록 안내를 표시한다(E10).

### 2.5 소속 밸류체인 선택 (S5)

- 체인 항목 클릭 → 밸류체인 뷰(UC-009)로 **페이지 이동**(라우팅). 페이지 내 데이터 변화 없음.
- 소속 체인 없음은 빈 목록 안내(E11). 노출 범위(공식만 vs 공식+내 체인)는 서버가 세션으로 필터하므로 클라이언트는 분기 로직을 갖지 않는다(E12).

### 2.6 섹션 오류 재시도

- S2~S5 중 실패한 섹션은 오류 폴백 + "재시도" 버튼을 표시한다. 재시도 클릭 → 해당 쿼리의 `refetch()` 호출. 별도 페이지 상태를 두지 않는다(쿼리 상태에서 파생).

### 2.7 타임라인 시점 컨텍스트 안내 배너 (E14)

- 밸류체인 뷰에서 **과거 시점(타임라인) 조회 중** 노드 클릭으로 진입한 경우, 진입 URL에 시점 컨텍스트 파라미터(예: `?asOf=YYYY-MM-DD`)가 실려 온다.
- 페이지는 "본 페이지는 최신 데이터 기준이며, 조회하시던 시점은 YYYY-MM-DD입니다" 형태의 안내 배너를 표시한다. 사용자가 닫기를 누르면 배너가 사라진다(닫음 여부만 페이지 상태).

## 3. 데이터베이스 사용

본 페이지가 호출하는 5개 API는 아래 테이블을 **SELECT 전용**으로 조회한다(INSERT/UPDATE/DELETE 없음 — UC-020 §6.4). 클라이언트가 DB에 직접 접근하지 않으며, 항상 Hono API(route → service → repository → Supabase)를 경유한다.

| 테이블 | 용도 | 사용 섹션 |
|---|---|---|
| `securities` | 티커(+시장)로 기업 식별, 상장 상태·통화 | S1 |
| `company_profiles` | 정형 정보 + 최종 수집 시각 | S1 |
| `quarterly_financials` | 분기/연간 재무 시계열(`fiscal_year >= 2015`) | S2 |
| `disclosures` | 최신순 공시 목록(페이지네이션) | S3 |
| `daily_quotes` | 기간 내 일봉 OHLCV·종가 확정 플래그 | S4 |
| `shares_outstanding` | 최신 `as_of_date` 상장주식수 1건(시총 산출·기준일 주석) | S4 |
| `value_chains` / `chain_snapshots` / `snapshot_nodes` / `chain_daily_metrics` | 소속 체인 식별(최신 스냅샷 LATERAL) + 현황 요약 | S5 |

## 4. 상태 정의 — 관리 상태 vs 파생 데이터

원칙(techstack §1·§2): **서버 상태는 TanStack Query가 전담**하고, 페이지(클라이언트) 상태는 최소한으로 둔다. 파생 가능한 값은 상태로 두지 않는다.

### 4.1 관리해야 할 상태 (페이지 클라이언트 상태 — useReducer 관리 대상)

| # | 상태 | 타입 | 초기값 | 설명 |
|---|---|---|---|---|
| C1 | `quotesPeriod` | `QuotesPeriodPreset` (`'1M' \| '3M' \| '6M' \| '1Y' \| '3Y' \| 'MAX'`) | `QUOTES_DEFAULT_PERIOD` 상수 | 주가/시총 차트 조회 기간 프리셋 |
| C2 | `financialsPeriod` | `FinancialsPeriodPreset` (`'3Y' \| '5Y' \| '10Y' \| 'ALL'`) | `FINANCIALS_DEFAULT_PERIOD` 상수 | 분기 재무 조회 연도 범위 프리셋 |
| C3 | `isTimelineNoticeDismissed` | `boolean` | `false` | E14 시점 컨텍스트 안내 배너 닫음 여부 |

이게 전부다. 프리셋 유니온·기본값 상수는 `packages/domain/constants`에서 관리한다(하드코딩 금지).

### 4.2 화면에 보이지만 상태가 아닌 것 (파생/서버/URL — reducer에 두지 않음)

| 표시 데이터 | 실제 소유자 | 파생 방법 |
|---|---|---|
| `ticker`, `market` | **URL** (경로 파라미터 + `?market=` 쿼리) | 라우터가 관리. 시장 선택도 URL 갱신으로 처리(새로고침/공유 시 재현 가능) |
| `asOf` 시점 컨텍스트 값 | **URL** (`?asOf=` 쿼리) | 배너 문구는 URL에서 읽음. 닫음 여부(C3)만 상태 |
| 기업 요약/정형 정보, `securityId` | **서버 캐시** (summary 쿼리) | `useCompanySummary(ticker, market)` 응답 |
| 분기 재무 시계열·주석 플래그 | **서버 캐시** (financials 쿼리) | 쿼리 키에 파생된 연도 범위 포함 |
| 공시 누적 목록·`hasMore`·페이지 커서 | **서버 캐시** (`useInfiniteQuery`) | 더보기 = `fetchNextPage()`. 페이지 번호를 reducer에 중복 보관하지 않음 |
| 일봉 캔들·시총 추이·주식수 메타 | **서버 캐시** (quotes 쿼리) | 쿼리 키에 파생된 `from`/`to` 포함 |
| 소속 체인 목록 | **서버 캐시** (valuechains 쿼리) | 세션 필터는 서버 수행 |
| quotes `from`/`to` 날짜 | 파생 | `quotesPeriod` + 오늘 날짜에서 순수 함수로 계산 |
| financials `fromYear`/`toYear` | 파생 | `financialsPeriod` + 현재 연도에서 계산, 2015 하한 클램프 |
| 각 섹션의 로딩/오류/빈 상태 | 파생 | 각 쿼리의 `isPending`/`isError`/`data.items.length === 0` |
| 상장 상태 배지, 출처·수집 시각 표기 | 파생 | summary 응답의 `listingStatus`/`dataSources` 렌더 시 매핑 |
| 시장 선택 UI 표시 여부 | 파생 | summary 쿼리 오류가 `TICKER_AMBIGUOUS`(409)인지로 판정 |
| 시총 추이 표시/미표시, '주식수 기준일' 주석 | 파생 | quotes 응답 `sharesMeta` 유무·값 |
| 재무 그래프용 데이터 구조 | 파생 | financials `items`를 차트 라이브러리 입력 형태로 렌더 시 변환(메모이제이션 가능) |
| 매출 미매핑/연간 전용/미확정 종가 주석 | 파생 | 응답 플래그(`isRevenueTagUnmapped`, `isAnnualOnly`, `isClosingConfirmed`) |
| 로그인 여부 | 전역 인증 상태(Supabase 세션) | 페이지 상태 아님. S5 노출 범위도 서버가 결정 |

### 4.3 상태 전환 테이블 (변경 조건 + UI 반영)

**관리 상태(C1~C3)의 전환:**

| 상태 | 전환 | 변경 조건(트리거) | 변경 시 화면 반영 |
|---|---|---|---|
| C1 `quotesPeriod` | 기본 프리셋 → 선택 프리셋 | 사용자가 기간 프리셋 버튼 클릭(현재 값과 다를 때만) | 선택 버튼 활성 표시 → `from`/`to` 재파생 → quotes 쿼리 키 변경 → 재조회 동안 차트 영역 로딩 표시(기존 데이터 유지 가능) → 완료 시 캔들차트·시총 추이가 새 기간으로 갱신 |
| C2 `financialsPeriod` | 기본 프리셋 → 선택 프리셋 | 사용자가 연도 범위 프리셋 클릭(현재 값과 다를 때만) | 선택 버튼 활성 표시 → `fromYear`/`toYear` 재파생(2015 클램프) → financials 재조회 → 표 + 그래프가 새 범위로 갱신, 결측 구간 안내 재평가 |
| C3 `isTimelineNoticeDismissed` | `false → true` | 사용자가 안내 배너 닫기 클릭 | 배너 즉시 제거(단방향 — 페이지 재진입 전까지 되돌리지 않음) |

**파생 표시 상태(쿼리 생명주기)의 UI 매핑** (reducer 관여 없음, 참고용):

| 섹션 | 쿼리 상태/응답 조건 | 화면 |
|---|---|---|
| 전체 | summary `isPending` | 페이지 스켈레톤 |
| 전체 | summary 404 | 미존재 안내 + 메인/검색 유도(S2~S5 미호출) |
| 전체 | summary 409 | 시장 선택 UI → 선택 시 `?market=` URL 갱신 후 재조회 |
| S1 | `listingStatus ≠ 'listed'` | 상장폐지/거래정지 배지 + 과거 데이터 정상 표시 |
| S2 | `items: []` | 결측 안내(2015 이전 미제공 문구 포함) |
| S2 | `isAnnualOnly=true` | 연간 축 그래프 + "분기 미제공" 주석 |
| S3 | `items: []` | 빈 목록 안내(오류와 구분) |
| S3 | `hasMore=true` / `isFetchingNextPage` | 더보기 버튼 노출 / 버튼 로딩 표시 |
| S4 | `candles: []` 또는 500 | 주가·시총 섹션만 폴백 + 재시도(타 섹션 정상 유지) |
| S4 | `sharesMeta=null` | 시총 추이 미표시 + 안내 |
| S4 | `sharesMeta.asOfDate` 존재 | '주식수 기준일' 주석 표시 |
| S5 | `items: []` | 빈 목록 안내 |
| S2~S5 공통 | `isError` | 섹션 단위 오류 폴백 + 재시도 버튼(`refetch`) |

## 5. 후속 문서

- 상태 관리 설계(Flux 패턴 — Action/Reducer/View): `docs/pages/company-detail/state_management.md`
