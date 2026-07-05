# UC-020: 기업 상세 조회

> 근거: `docs/userflow.md` 020, `docs/prd.md` 3장(기업 상세 페이지)·5장(IA `/companies/[ticker]`)·6장(데이터·지표 정책), `docs/database.md` §3.2·§3.4·§3.5·§3.8·§4.4·§4.5·§4.6, `docs/techstack.md` §4(Hono route → service → repository → Supabase).
> 본 기능은 **조회 전용**이다. 화면에 표시되는 모든 데이터(정형 정보/재무/공시/주가/시총/소속 체인)는 배치(UC-026~028, UC-031)가 사전 적재한 **자체 DB**에서만 읽으며, 요청 시점에 외부 API(OpenDART, SEC EDGAR, 토스증권)를 호출하지 않는다(PRD 8장).

---

## 1. Primary Actor

- **Guest / User** — 로그인 없이 열람 가능.
  - 소속 밸류체인 목록의 노출 범위만 권한에 따라 다르다: Guest = 공식 체인만, User = 공식 체인 + 본인 소유 체인.

## 2. Precondition (사용자 관점)

- 사용자가 다음 중 하나의 경로로 특정 상장기업에 도달할 수 있는 상태다.
  - 기업 통합 검색(UC-008) 결과 항목 선택.
  - 밸류체인 뷰에서 상장기업 노드 클릭(UC-011).
  - 티커 기반 직접 링크(URL) 진입.
- (로그인은 불필요하다. 내 소속 체인까지 보려면 로그인 상태여야 한다.)

## 3. Trigger

- 사용자가 위 경로 중 하나로 기업 상세 페이지에 진입한다.
- 또는 페이지 내에서 재무 그래프·주가 차트의 **기간 범위를 조작**하거나 공시 목록의 **더보기**를 선택한다(해당 섹션 재조회).

## 4. Main Scenario

1. 사용자가 기업 상세 페이지(`/companies/[ticker]`)에 진입한다.
2. FE가 기업 식별·요약 API(`GET /api/companies/:ticker`)를 호출한다(시장 구분이 알려진 경우 `market` 파라미터 포함).
3. Hono Router(route.ts)가 경로·쿼리 파라미터를 Zod 스키마로 검증한다.
4. Service(service.ts)가 Repository를 통해 종목 마스터(`securities`)에서 티커(+시장)로 기업을 식별하고, 정형 정보(`company_profiles`)를 함께 로드한다 — 회사명/티커/시장/업종/대표자/설립일/홈페이지 등 API 제공 필드만(서술형 개요 미제공).
5. Service가 상장 상태(`listing_status`)와 데이터 출처 메타(KRX → DART+토스증권, US → SEC EDGAR+토스증권), 최종 수집 시각을 구성하고 Row 검증 → DTO 변환 → Response 검증 후 반환한다. FE가 정형 정보 섹션과 출처·수집 시각을 렌더링한다(상장폐지/거래정지 시 상태 배지 표시).
6. FE가 응답의 `securityId`로 나머지 섹션 API를 병렬 호출한다.
   - **분기 재무**: `GET /api/securities/:securityId/financials` — `quarterly_financials`에서 2015 사업연도 이후 분기별 매출/영업이익/순이익을 조회한다. 값은 배치가 정규화해 저장한 결과(국내 누적 차감, 미국 태그 폴백)를 그대로 사용한다. FE는 표 + 그래프로 렌더링한다.
   - **주요 공시**: `GET /api/securities/:securityId/disclosures` — `disclosures`에서 최신순 목록(제목/일자/원문 링크)을 페이지네이션으로 조회한다. FE는 목록 + 원문 링크(외부 새 창)를 렌더링한다.
   - **주가/시가총액**: `GET /api/securities/:securityId/quotes` — `daily_quotes`에서 기간 내 일봉(OHLCV)을 조회하고, 시가총액 추이 = 일별 종가 × 최신 상장주식수(`shares_outstanding` 최신 `as_of_date` 행)로 산출한다. FE는 일봉 캔들차트 + 시총 추이와 '주식수 기준일' 주석을 렌더링한다(차트는 거래일만 표시).
   - **소속 밸류체인**: `GET /api/securities/:securityId/valuechains` — 최신 스냅샷에 해당 종목 노드가 존재하는 체인을 조회한다. 비로그인 = 공식 체인만, 로그인 = 공식 + 본인 체인. 각 체인의 현황 요약(노드 수, 최신 가치총액, 커버리지)을 함께 반환한다.
7. 각 Service는 Row 스키마 검증 → DTO 변환(snake_case → camelCase) → Response 스키마 검증 후 `success()`를 반환한다.
8. FE가 전체 페이지를 완성한다: 정형 정보 / 분기 재무 표+그래프 / 공시 목록 / 일봉+시총 추이 / 소속 체인 목록 / 데이터 출처·최종 수집 시각 표기.
9. 사용자가 소속 체인 항목을 선택하면 해당 밸류체인 뷰(UC-009)로 이동한다.

## 5. Edge Cases

| # | 상황 | 처리 |
|---|---|---|
| E1 | 존재하지 않는/미상장 티커 | `404 COMPANY_NOT_FOUND` → FE 안내 후 메인/검색 유도 |
| E2 | 상장폐지(`listing_status=delisted`) 종목 | 200 정상 응답 + 상태 배지 표시, 보유한 과거 데이터(재무/공시/주가)는 그대로 표시(신규 수집만 중단) |
| E3 | 거래정지(`listing_status=suspended`) 종목 | 200 정상 응답 + 상태 배지, 시세는 마지막 관측값까지 표시 |
| E4 | 동일 티커가 KRX·US 양 시장에 존재하고 `market` 미지정 | `409 TICKER_AMBIGUOUS` → FE가 시장 선택 유도(검색·노드 경유 진입은 market을 알고 있어 발생하지 않음) |
| E5 | 재무 데이터 결측(신규 상장/미수집/2015 사업연도 이전) | 200 + 빈 배열 또는 부분 시계열 → FE는 결측 구간 안내와 함께 부분 표시(2015 이전은 사양상 미제공) |
| E6 | 미국 매출 태그 미매핑 기업(`is_revenue_tag_unmapped=true`) | 매출 값 `null` + 미매핑 플래그 반환 → FE는 매출 항목 제외/주석 표시(영업이익 등 다른 계정은 표시) |
| E7 | 연간 전용(20-F) 기업 — 분기 손익 미제공 | `periodType=annual` 행만 반환 → FE는 연간 축으로 표시 + "분기 미제공" 주석 |
| E8 | 시세 미수집/장애(일봉 결측·종가 미확정) | quotes API만 빈 결과/부분 결과 또는 500 → FE는 주가·시총 섹션만 폴백(미확정 표기·재시도), 정형·재무·공시는 정상 표시 |
| E9 | 상장주식수 미갱신/기준일 과거(`as_of_date` 오래됨) | 시총 추이에 '주식수 기준일' 주석으로 명시(값은 최신 보관 행 기준). 상장주식수 이력 자체가 없으면 시총 추이 미표시 + 안내 |
| E10 | 공시 없음 | 200 + 빈 배열 → FE 빈 목록 안내(오류와 구분) |
| E11 | 소속 체인 없음 | 200 + 빈 배열 → FE 빈 목록 안내 |
| E12 | 비로그인 사용자의 내 체인 노출 | 서버가 세션 부재 시 공식 체인만 반환(클라이언트 우회 불가 — 서버 측 필터) |
| E13 | 상장기업 노드 경유 진입인데 종목 매핑 유실(종목 마스터에서 식별 불가) | `404 COMPANY_NOT_FOUND` → UC-011의 폴백 패널/안내로 처리 |
| E14 | 과거 시점(타임라인) 조회 중 노드 클릭으로 진입 | 기업 상세는 항상 **최신 데이터 기준** 표시, FE가 조회 중이던 시점 컨텍스트를 안내(UC-011/012 연계) |
| E15 | 잘못된 파라미터(날짜 형식 오류, from > to, page < 1 등) | `400 INVALID_REQUEST` — Zod 검증 실패 상세 포함 |
| E16 | DB 조회 실패/스키마 검증 실패 | 해당 섹션 API만 `500` → FE는 섹션 단위 오류 폴백 + 재시도 제공(페이지 전체 실패로 확산하지 않음) |

## 6. Business Rules

### 6.1 표시·데이터 규칙

- **정형 정보만 제공**: 회사명/티커/시장/업종/대표자/설립일/홈페이지 등 API 제공 필드만 표시한다. 서술형 기업 개요는 제공하지 않는다(PRD Non-Goals).
- **재무 시계열 하한**: 2015 사업연도 이후만 제공한다(상수 `TIMESERIES_MIN_START_YEAR`, OpenDART 제약).
- **재무 값은 배치 정규화 결과를 그대로 사용**: 국내 분기 매출은 누적치 차감값(`amount_basis`), 미국은 태그 폴백 체인 결과(`revenue_source_tag`)가 이미 반영되어 저장돼 있으며, 조회 시 재계산하지 않는다.
- **시가총액 산출**: 일별 종가(`daily_quotes.close_price`) × **최신** 상장주식수(`shares_outstanding`의 최대 `as_of_date` 행 1건, PRD 기준 정책). '주식수 기준일'을 주석으로 노출한다.
- **표시 통화**: 주가·시총·재무는 해당 종목의 거래/보고 통화(`securities.currency`, `quarterly_financials.currency`) 기준으로 표시한다(KRW 환산 정책은 체인 지표 전용 — Open Question 참조).
- **공시 목록**: 최신순(`disclosure_date DESC`) 정렬, 원문 링크(`url`)는 외부 원문(DART/SEC)으로 연결한다. 페이지당 건수는 상수로 관리한다.
- **차트 표시**: 일봉/시총 차트는 거래일만 표시한다(결측 일자는 x축에서 제외). 종가 미확정(`is_closing_confirmed=false`) 일자는 미확정으로 표기한다.
- **출처·수집 시각 표기**: 시장별 데이터 출처(KRX = 금융감독원 DART + 토스증권, US = SEC EDGAR + 토스증권)와 섹션별 최종 수집 시각(정형 정보 `last_collected_at`, 시세·재무·공시는 각 최신 데이터 일자)을 표기한다.
- **상장 상태 처리**: `delisted`/`suspended`는 접근을 막지 않고 상태 배지 + 보유 과거 데이터 표시로 처리한다(물리 삭제 금지 — `securities` 소프트 상태).
- 조회 전용 기능 — 어떠한 데이터 변경(사이드이펙트)도 없다.

### 6.2 접근 권한 규칙

- 기업 상세의 정형 정보/재무/공시/주가 섹션은 **공개**(비로그인 열람 가능).
- 소속 밸류체인 목록은 서버 측에서 필터링한다: `chain_type='official'`(보관 제외) 전체 + 로그인 시 `owner_id = 현재 사용자`인 체인. 타인의 사용자 체인은 어떤 경우에도 노출하지 않는다.
- RLS 비활성 정책 — 인가는 Hono 미들웨어(`withAppContext`, 세션 식별)와 Service의 서버 측 필터로 수행한다.

### 6.3 API Specification

#### (1) 기업 식별·정형 정보 조회

- **Endpoint**: `GET /api/companies/:ticker`
- **인증**: 불필요(공개 API)
- **Query Parameters** (`CompanySummaryQuerySchema`):

  ```typescript
  {
    market?: 'KRX' | 'US'   // 동일 티커가 양 시장에 존재할 때 구분용(검색/노드 경유 진입 시 FE가 전달)
  }
  ```

- **Response Schema** (`CompanySummaryResponseSchema`):

  ```typescript
  {
    security: {
      id: string,                 // securities.id — 이후 섹션 API의 경로 키
      ticker: string,
      name: string,
      englishName: string | null,
      market: 'KRX' | 'US',
      currency: 'KRW' | 'USD',
      listingStatus: 'listed' | 'suspended' | 'delisted'
    },
    profile: {                    // 정형 정보 미수집 시 null
      representativeName: string | null,
      establishedDate: string | null,   // YYYY-MM-DD
      homepageUrl: string | null,
      sector: string | null,
      lastCollectedAt: string | null    // ISO 8601
    } | null,
    dataSources: {
      financialSource: 'dart' | 'sec',  // KRX→dart, US→sec
      quoteSource: 'toss',
      lastQuoteDate: string | null,       // daily_quotes 최신 trade_date
      lastDisclosureDate: string | null   // disclosures 최신 disclosure_date
    }
  }
  ```

- **Error Codes**:

  | 코드 | HTTP | 조건 |
  |---|---|---|
  | `INVALID_REQUEST` | 400 | 티커/market 파라미터 검증 실패 |
  | `COMPANY_NOT_FOUND` | 404 | 종목 마스터에 해당 티커 없음(미상장 포함) |
  | `TICKER_AMBIGUOUS` | 409 | 동일 티커가 복수 시장에 존재하고 `market` 미지정 |
  | `COMPANY_FETCH_ERROR` | 500 | DB 조회 실패 |
  | `COMPANY_VALIDATION_ERROR` | 500 | Row/Response 스키마 검증 실패 |

#### (2) 분기 재무 조회

- **Endpoint**: `GET /api/securities/:securityId/financials`
- **인증**: 불필요
- **Query Parameters** (`FinancialsQuerySchema`):

  ```typescript
  {
    fromYear?: number,   // 회계연도, 기본값: 기본 조회 기간 상수, 하한 2015로 보정
    toYear?: number      // 기본값: 최신
  }
  ```

- **Response Schema** (`FinancialsResponseSchema`):

  ```typescript
  {
    securityId: string,
    currency: 'KRW' | 'USD',                 // 보고 통화
    items: Array<{
      periodType: 'quarter' | 'annual',      // annual = 20-F 등 연간 전용 행
      fiscalYear: number,
      fiscalQuarter: number | null,          // 1~4, annual이면 null
      calendarYear: number | null,           // 역년 정규화 축(참고용)
      calendarQuarter: number | null,
      revenue: number | null,                // 태그 미매핑 시 null
      operatingIncome: number | null,
      netIncome: number | null,
      amountBasis: 'three_month' | 'derived_from_cumulative' | null,
      isRevenueTagUnmapped: boolean,
      source: 'dart' | 'sec'
    }>,
    annotations: {
      minFiscalYear: number,                 // 2015 (상수)
      isAnnualOnly: boolean                  // 분기 행 없이 연간 행만 존재(20-F) 여부
    }
  }
  ```

- **Error Codes**: `INVALID_REQUEST`(400) / `COMPANY_NOT_FOUND`(404, securityId 미존재) / `FINANCIALS_FETCH_ERROR`(500) / `FINANCIALS_VALIDATION_ERROR`(500). 결측·빈 시계열은 200 + `items: []`.

#### (3) 주요 공시 목록 조회

- **Endpoint**: `GET /api/securities/:securityId/disclosures`
- **인증**: 불필요
- **Query Parameters** (`DisclosuresQuerySchema`):

  ```typescript
  {
    page?: number   // ≥1, 기본 1. 페이지당 건수는 상수(DISCLOSURES_PAGE_SIZE)
  }
  ```

- **Response Schema** (`DisclosuresResponseSchema`):

  ```typescript
  {
    securityId: string,
    items: Array<{
      id: string,
      title: string,
      disclosureDate: string,     // YYYY-MM-DD, 최신순 정렬
      url: string,                // 원문 링크(DART/SEC)
      source: 'dart' | 'sec'
    }>,
    page: number,
    pageSize: number,
    hasMore: boolean
  }
  ```

- **Error Codes**: `INVALID_REQUEST`(400) / `COMPANY_NOT_FOUND`(404) / `DISCLOSURES_FETCH_ERROR`(500) / `DISCLOSURES_VALIDATION_ERROR`(500). 공시 없음은 200 + `items: []`.

#### (4) 주가(일봉)·시가총액 추이 조회

- **Endpoint**: `GET /api/securities/:securityId/quotes`
- **인증**: 불필요
- **Query Parameters** (`QuotesQuerySchema`):

  ```typescript
  {
    from?: string,   // YYYY-MM-DD, 기본값: 기본 조회 기간 상수
    to?: string      // YYYY-MM-DD, 기본값: 오늘(미래 일자는 오늘로 보정)
  }
  ```

- **Response Schema** (`QuotesResponseSchema`):

  ```typescript
  {
    securityId: string,
    currency: 'KRW' | 'USD',
    candles: Array<{                          // 거래일만 포함(일봉 캔들차트)
      tradeDate: string,
      open: number | null,
      high: number | null,
      low: number | null,
      close: number | null,
      volume: number | null,
      isClosingConfirmed: boolean             // 종가 확정 여부(미확정 표기용)
    }>,
    marketCapSeries: Array<{                  // 일별 종가 × 최신 상장주식수
      tradeDate: string,
      marketCap: number | null
    }>,
    sharesMeta: {                             // 상장주식수 이력 없으면 null → 시총 추이 미표시
      shares: number,
      asOfDate: string,                       // '주식수 기준일' 주석용
      source: 'toss' | 'dart' | 'sec',
      isMultiClassPartial: boolean            // 다중 클래스 부분 집계 여부(주석)
    } | null
  }
  ```

- **Error Codes**: `INVALID_REQUEST`(400) / `COMPANY_NOT_FOUND`(404) / `QUOTES_FETCH_ERROR`(500) / `QUOTES_VALIDATION_ERROR`(500). 시세 미수집은 200 + `candles: []`(FE 폴백 표시).

#### (5) 소속 밸류체인 목록 조회

- **Endpoint**: `GET /api/securities/:securityId/valuechains`
- **인증**: 선택(Optional) — 세션 존재 시 본인 체인 포함, 부재 시 공식 체인만
- **Query Parameters**: 없음
- **Response Schema** (`CompanyValuechainsResponseSchema`):

  ```typescript
  {
    securityId: string,
    items: Array<{
      chainId: string,
      name: string,
      chainType: 'official' | 'user',        // user = 본인 소유 체인(로그인 시에만 포함)
      focusType: 'industry' | 'company',
      nodeCount: number,                     // 최신 스냅샷 기준 노드 수
      summary: {                             // 현황 요약(집계 미존재 시 null)
        totalMarketCapKrw: number | null,
        coveredNodeCount: number,
        totalNodeCount: number,
        metricDate: string | null            // 최신 집계 일자
      } | null
    }>
  }
  ```

- **Error Codes**: `COMPANY_NOT_FOUND`(404) / `CHAINS_FETCH_ERROR`(500) / `CHAINS_VALIDATION_ERROR`(500). 소속 체인 없음은 200 + `items: []`.

### 6.4 Database Operations

조회 전용 유스케이스 — **SELECT만 수행**하며 INSERT/UPDATE/DELETE는 없다.

| 테이블 | 연산 | 용도 |
|---|---|---|
| `securities` | SELECT | 티커(+시장)로 기업 식별(`uq(market, ticker)`), 상장 상태·통화·시장 확인 |
| `company_profiles` | SELECT | 정형 정보(대표자/설립일/홈페이지/업종) + 최종 수집 시각(1:1) |
| `quarterly_financials` | SELECT | 분기/연간 재무 시계열(`fiscal_year >= 2015`, `uq(security, year, quarter)`), 태그 미매핑·연간 전용 플래그 |
| `disclosures` | SELECT | 최신순 공시 목록(`idx(security, date DESC)`), 페이지네이션 |
| `daily_quotes` | SELECT | 기간 내 일봉 OHLCV·종가 확정 플래그(`uq(security_id, trade_date)`) — 시총 추이 입력 |
| `shares_outstanding` | SELECT | 최신 `as_of_date` 상장주식수 1건(database.md §4.4 `DISTINCT ON` 패턴) — 시총 산출·기준일 주석 |
| `value_chains` | SELECT | 소속 체인 후보(공식 + 본인 소유, `is_archived=false`) |
| `chain_snapshots` | SELECT | 체인별 최신 스냅샷 식별(`idx(chain_id, effective_at DESC)`, database.md §4.6 LATERAL 패턴) |
| `snapshot_nodes` | SELECT | 최신 스냅샷에 해당 `security_id` 노드 존재 여부 + 노드 수 |
| `chain_daily_metrics` | SELECT | 소속 체인 현황 요약(최신 가치총액·커버리지, `uq(chain_id, metric_date)`) |

- 소속 체인 조회(최신 스냅샷 LATERAL 조인)는 복잡 조인이므로 Postgres 함수/뷰로 캡슐화해 `client.rpc()`로 호출한다(techstack §7). SQL은 마이그레이션에 포함해 SOT를 유지한다.
- RLS 비활성(전역 정책) — service-role 클라이언트로 조회하며, 사용자 체인 필터(`owner_id`)는 Service 계층에서 세션 사용자 기준으로 적용한다.

### 6.5 External Service Integration

- **본 유스케이스는 요청 시점의 외부 서비스 직접 연동이 없다.** 클라이언트가 보는 모든 데이터는 자체 DB에서 제공된다(PRD 8장: 외부 API는 배치 적재 전용).
- 데이터 공급 경로(간접 의존, 별도 유스케이스):
  - **OpenDART**(`docs/external/opendart.md`): 국내 재무/공시/기업정보/주식총수 → `quarterly_financials`·`disclosures`·`company_profiles`·`shares_outstanding` (UC-027).
  - **SEC EDGAR**(`docs/external/sec-edgar-api.md`): 미국 재무/공시/상장주식수 → 동일 테이블 (UC-027).
  - **토스증권 Open API**(`docs/external/tossinvest-openapi.md`): 시세(일봉)·상장주식수 1순위 소스 → `daily_quotes`·`shares_outstanding` (UC-026/027).
- 공시 **원문 링크**는 자체 DB에 저장된 `disclosures.url`을 그대로 노출하며, 클릭 시 사용자 브라우저가 외부 원문(DART/SEC 사이트)으로 직접 이동한다 — 서버 측 프록시/호출 없음.
- 배치 장애로 수집이 지연·결측되어도 본 API는 가용한 저장값 범위 내에서 응답하며(섹션별 폴백), 외부 API를 대체 호출하지 않는다.
- 데이터 출처 표기: 금융감독원 DART, SEC EDGAR, 토스증권 + 최종 수집 시각(법적 고지 정책, UC-025 연계).

---

## 7. Sequence Diagram

```plantuml
@startuml
actor User
participant FE
participant "Hono Router\n(route.ts)" as Router
participant "Service\n(service.ts)" as Service
participant "Repository\n(repository.ts)" as Repo
database "Supabase\n(Postgres)" as DB

User -> FE: 기업 상세 진입\n(검색 결과 선택 / 노드 클릭 / 직접 링크)
FE -> Router: GET /api/companies/:ticker?market
Router -> Router: 경로·쿼리 파라미터 Zod 검증

alt 파라미터 검증 실패
    Router --> FE: 400 INVALID_REQUEST
    FE --> User: 잘못된 접근 안내
else 검증 통과
    Router -> Service: getCompanySummary(ticker, market)
    Service -> Repo: findSecurityByTicker(ticker, market)
    Repo -> DB: SELECT securities + company_profiles\n(+ 최신 quote/disclosure 일자 메타)
    DB --> Repo: rows
    Repo --> Service: 종목·정형 정보

    alt 종목 미존재(미상장 포함)
        Service --> Router: failure(404, COMPANY_NOT_FOUND)
        Router --> FE: 404
        FE --> User: 미존재 안내 후 메인/검색 유도
    else 동일 티커 복수 시장 + market 미지정
        Service --> Router: failure(409, TICKER_AMBIGUOUS)
        Router --> FE: 409
        FE --> User: 시장 선택 유도
    else 식별 성공
        Service -> Service: Row 검증 → DTO 변환(snake→camel)\n출처·최종 수집 시각·상장 상태 메타 구성
        Service --> Router: success(CompanySummary)
        Router --> FE: 200 OK (securityId 포함)
        FE --> User: 정형 정보 + 출처/수집 시각 표시\n(상장폐지/거래정지 시 상태 배지)

        par 분기 재무
            FE -> Router: GET /api/securities/:securityId/financials\n?fromYear&toYear
            Router -> Service: getFinancials(securityId, range)
            Service -> Repo: findQuarterlyFinancials(securityId, range)
            Repo -> DB: SELECT quarterly_financials\nWHERE fiscal_year >= 2015
            DB --> Repo: 재무 행(태그 미매핑·연간 전용 플래그 포함)
            Repo --> Service: 재무 시계열
            Service --> Router: success(FinancialsResponse)
            Router --> FE: 200 OK
        and 주요 공시
            FE -> Router: GET /api/securities/:securityId/disclosures?page
            Router -> Service: getDisclosures(securityId, page)
            Service -> Repo: findDisclosures(securityId, page)
            Repo -> DB: SELECT disclosures\nORDER BY disclosure_date DESC LIMIT/OFFSET
            DB --> Repo: 공시 행
            Repo --> Service: 공시 목록 + hasMore
            Service --> Router: success(DisclosuresResponse)
            Router --> FE: 200 OK
        and 주가·시가총액
            FE -> Router: GET /api/securities/:securityId/quotes?from&to
            Router -> Service: getQuotes(securityId, range)
            Service -> Repo: findDailyQuotes(securityId, range)
            Repo -> DB: SELECT daily_quotes\nWHERE trade_date BETWEEN
            DB --> Repo: 일봉 행(종가 확정 플래그 포함)
            Service -> Repo: findLatestShares(securityId)
            Repo -> DB: SELECT shares_outstanding\nDISTINCT ON ... ORDER BY as_of_date DESC
            DB --> Repo: 최신 상장주식수 + 기준일
            Repo --> Service: 일봉 + 주식수 메타
            Service -> Service: 시총 추이 산출\n(일별 종가 x 최신 상장주식수)

            alt 시세 미수집/DB 오류
                Service --> Router: 200(빈 candles) 또는\nfailure(500, QUOTES_FETCH_ERROR)
                Router --> FE: 200 / 500
                FE --> User: 주가·시총 섹션만 폴백\n(정형·재무·공시는 정상 표시, 재시도)
            else 성공
                Service --> Router: success(QuotesResponse)
                Router --> FE: 200 OK
            end
        and 소속 밸류체인
            FE -> Router: GET /api/securities/:securityId/valuechains
            Router -> Router: 세션 식별(withAppContext)\n비로그인이면 userId 없음
            Router -> Service: getBelongingChains(securityId, userId?)
            Service -> Repo: findChainsContainingSecurity(securityId, userId?)
            Repo -> DB: RPC: value_chains + 최신 chain_snapshots(LATERAL)\n+ snapshot_nodes(security_id 매칭)\n+ chain_daily_metrics(현황 요약)
            DB --> Repo: 체인 행(공식 + 본인 체인만)
            Repo --> Service: 소속 체인 목록
            Service -> Service: 서버 측 노출 범위 필터 확인\n(타인 체인 배제) → DTO 변환
            Service --> Router: success(CompanyValuechainsResponse)
            Router --> FE: 200 OK
        end

        FE --> User: 재무 표+그래프 / 공시 목록(원문 링크)\n일봉 캔들 + 시총 추이(주식수 기준일 주석)\n소속 체인 목록(현황 요약) 렌더링
        opt 소속 체인 선택
            User -> FE: 체인 항목 선택
            FE --> User: 밸류체인 뷰로 이동(UC-009)
        end
    end
end
@enduml
```
