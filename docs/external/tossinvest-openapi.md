# 토스증권 Open API 정리

> 출처: <https://developers.tossinvest.com/docs> (인터랙티브 레퍼런스)
> 정리 기준일: 2026-07-05 (1차 조사) / **보강 조사: 2026-07-05** — 시가총액 소스, symbols 제약, candles 페이지네이션, 이용약관 재배포 조항, Rate Limit 재확인 (§8 참고)
> 이 문서는 요약본입니다. 최종 진실의 출처(Source of Truth)는 아래 **공식 문서 소스**의 OpenAPI JSON입니다.
>
> ⚠️ **프로젝트 영향도 최상 이슈**: 토스증권 오픈 API 이용약관상 제공 데이터는 **개인투자자 본인의 매매 목적**으로만 이용 가능하며 **제3자 제공·배포·상업적 활용이 금지**되고, **법인 고객은 서비스 대상에서 제외**됩니다. `invest-in-best`처럼 시세를 수집해 대시보드로 제공하는 서비스 형태와 충돌할 소지가 있으므로 §8.4 및 문서 하단 Open Questions를 반드시 확인하세요.

## 1. 개요

- **무엇**: 국내(KRX/NXT) 및 미국 주식의 **시세·종목정보·환율·장 운영시간·계좌·보유주식·주문**을 다루는 REST API
- **Base 서버**: `https://openapi.tossinvest.com`
- **연동 방식**: 현재 **REST API만** 제공 (WebSocket / 스트리밍 없음)
- **카테고리(4종)**:
  - **인증 (Auth)** — OAuth 2.0 토큰 발급
  - **시세·종목 정보 (Market Data · Stock Info · Market Info)** — 시세, 종목 마스터, 환율, 장 운영시간
  - **계좌·자산 (Account · Asset)** — 계좌 목록 및 보유 주식 조회
  - **주문 (Order · Order History · Order Info)** — 주문 생성·정정·취소, 조회, 거래 가능 정보

### 공식 문서 소스 (Source of Truth)

| 문서 | 용도 |
|------|------|
| [overview.md](https://openapi.tossinvest.com/openapi-docs/overview.md) | 사람이 읽는 개요·퀵스타트·레이트리밋·에러 모델 |
| [api-reference/README.md](https://openapi.tossinvest.com/openapi-docs/latest/api-reference/README.md) | LLM/AI 에이전트용 마크다운 API 레퍼런스 |
| [openapi.json](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) | **정식 OpenAPI 3.0 스펙 (최종 진실의 출처)** |
| [/docs](https://developers.tossinvest.com/docs) | 브라우저 인터랙티브 레퍼런스 |
| [/llms.txt](https://developers.tossinvest.com/llms.txt) | AI 에이전트 및 비-JS 사용자용 진입 안내 |

---

## 2. 인증 (OAuth 2.0)

- 모든 호출은 **OAuth 2.0 Client Credentials Grant**로 발급한 access token 필요
- 인증 스킴명: `oauth2ClientCredentials` (Type: OAuth, Flow: application)
- 공통 헤더: `Authorization: Bearer {access_token}`
- **계좌·자산·주문** 카테고리는 추가로 계좌 식별 헤더 필요: `X-Tossinvest-Account: {accountSeq}`

### 시작 절차

1. **클라이언트 등록** — 토스증권 WTS 로그인 → **설정 > Open API** 메뉴에서 `client_id` / `client_secret` 발급
2. **액세스 토큰 발급** — `POST /oauth2/token` (Client Credentials Grant)
3. **API 호출** — 발급 토큰을 `Authorization: Bearer {access_token}` 헤더에 담아 호출
   - 계좌·자산 / 주문 카테고리는 `X-Tossinvest-Account: {accountSeq}` 헤더 동반

### 예시 (cURL)

```bash
# 1) 토큰 발급
curl -s -X POST 'https://openapi.tossinvest.com/oauth2/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials' \
  -d 'client_id=xxx' \
  -d 'client_secret=yyy'

# 2) 시세·종목 정보 (토큰만 필요)
curl -s 'https://openapi.tossinvest.com/api/v1/stocks?symbols=005930' \
  -H 'Authorization: Bearer eyJhbGciOi...'

# 3) 계좌·자산 / 주문 (토큰 + 계좌 헤더)
curl -s 'https://openapi.tossinvest.com/api/v1/holdings' \
  -H 'Authorization: Bearer eyJhbGciOi...' \
  -H 'X-Tossinvest-Account: 1'
```

---

## 3. 엔드포인트 전체 목록 (총 20개)

### 🔐 인증 — Auth (토큰만)

| Method | Endpoint | 설명 | 그룹 |
|--------|----------|------|------|
| `POST` | `/oauth2/token` | OAuth 2.0 액세스 토큰 발급 (Client Credentials Grant) | `AUTH` |

### 📈 시세·종목 정보 (토큰만 필요, 계좌 헤더 불필요)

#### Market Data — 시세

| Method | Endpoint | 설명 | 그룹 |
|--------|----------|------|------|
| `GET` | `/api/v1/orderbook` | 호가 조회 | `MARKET_DATA` |
| `GET` | `/api/v1/prices` | 현재가 조회 (`symbols` 콤마 구분, **최대 200개**) | `MARKET_DATA` |
| `GET` | `/api/v1/trades` | 최근 체결 내역 조회 (`count` 최대 50, 기본 50) | `MARKET_DATA` |
| `GET` | `/api/v1/price-limits` | 상/하한가 조회 | `MARKET_DATA` |
| `GET` | `/api/v1/candles` | 캔들 차트 조회 (`interval`: `1m`\|`1d`만 지원, `count` 최대 200, `before` 커서 페이지네이션) | `MARKET_DATA_CHART` |

#### Stock Info — 종목 정보

| Method | Endpoint | 설명 | 그룹 |
|--------|----------|------|------|
| `GET` | `/api/v1/stocks` | 종목 기본 정보 (symbol, 종목명, 시장, 통화, 상장 상태, **발행주식수** 등). `symbols` 콤마 구분 **최대 200개**, **필수 파라미터** (전체 종목 덤프 불가) | `STOCK` |
| `GET` | `/api/v1/stocks/{symbol}/warnings` | 매수 유의사항 (정리매매, 단기과열, 투자경고/위험, VI 발동, 신주인수권) | `STOCK` |

#### Market Info — 환율·장 운영 시간

| Method | Endpoint | 설명 | 그룹 |
|--------|----------|------|------|
| `GET` | `/api/v1/exchange-rate` | KRW↔USD 환율 조회 | `MARKET_INFO` |
| `GET` | `/api/v1/market-calendar/KR` | 국내 장 운영 정보 (KRX·NXT 세션별 시간) | `MARKET_INFO` |
| `GET` | `/api/v1/market-calendar/US` | 해외 장 운영 정보 (데이마켓·프리·정규·애프터마켓) | `MARKET_INFO` |

### 💼 계좌·자산 (토큰 + `X-Tossinvest-Account`)

| Method | Endpoint | 설명 | 그룹 |
|--------|----------|------|------|
| `GET` | `/api/v1/accounts` | 계좌 목록 조회 | `ACCOUNT` |
| `GET` | `/api/v1/holdings` | 보유 주식 조회 (종목별 상세 + 평가금액·손익 합산) | `ASSET` |

### 📝 주문 (토큰 + `X-Tossinvest-Account`)

#### Order — 주문 (생성·정정·취소)

| Method | Endpoint | 설명 | 그룹 |
|--------|----------|------|------|
| `POST` | `/api/v1/orders` | 주문 생성 (지정가·시장가 / KR·US) | `ORDER` |
| `POST` | `/api/v1/orders/{orderId}/modify` | 주문 정정 (가격·수량) | `ORDER` |
| `POST` | `/api/v1/orders/{orderId}/cancel` | 주문 취소 | `ORDER` |

#### Order History — 주문 조회

| Method | Endpoint | 설명 | 그룹 |
|--------|----------|------|------|
| `GET` | `/api/v1/orders` | 주문 목록 조회 (대기중/종료) | `ORDER_HISTORY` |
| `GET` | `/api/v1/orders/{orderId}` | 주문 상세 조회 (모든 상태) | `ORDER_HISTORY` |

#### Order Info — 거래 가능 정보

| Method | Endpoint | 설명 | 그룹 |
|--------|----------|------|------|
| `GET` | `/api/v1/buying-power` | 매수 가능 금액 (현금 기반, KRW·USD) | `ORDER_INFO` |
| `GET` | `/api/v1/sellable-quantity` | 판매 가능 수량 조회 | `ORDER_INFO` |
| `GET` | `/api/v1/commissions` | 매매 수수료 조회 (KR·US 시장별) | `ORDER_INFO` |

---

## 4. Rate Limits

- **클라이언트 × API 그룹** 단위로 초당 요청 수(TPS) 제한
- 각 API 의 description 끝에 해당 API 가 속한 Rate Limits Group 이 표기됨
- 구체적 한도는 운영 상황에 따라 사전 공지 없이 조정될 수 있으며, 현재 한도는 응답 헤더로 확인

| Rate Limits Group | 요청 한도 | 피크시간 한도 |
|-------------------|-----------|----------------|
| `AUTH` | 초당 최대 5회 | — |
| `ACCOUNT` | 초당 최대 1회 | — |
| `ASSET` | 초당 최대 5회 | — |
| `STOCK` | 초당 최대 5회 | — |
| `MARKET_INFO` | 초당 최대 3회 | — |
| `MARKET_DATA` | 초당 최대 10회 | — |
| `MARKET_DATA_CHART` | 초당 최대 5회 | — |
| `ORDER` | 초당 최대 6회 | 09:00 ~ 09:10 KST: **초당 최대 3회** |
| `ORDER_HISTORY` | 초당 최대 5회 | — |
| `ORDER_INFO` | 초당 최대 6회 | 09:00 ~ 09:10 KST: **초당 최대 3회** |

### 응답 헤더 (정상·429 응답 모두 포함)

| 헤더 | 의미 |
|------|------|
| `X-RateLimit-Limit` | 현재 허용된 초당 요청 수 (burst capacity) |
| `X-RateLimit-Remaining` | 버킷에 남은 토큰 수 (429 시 0) |
| `X-RateLimit-Reset` | 토큰 1개 재충전까지 예상 초 |
| `Retry-After` | 재시도 권장 초 (429 응답에만 포함) |

### 429 대응 권장 사항

- 429 수신 시 `Retry-After` 헤더 값만큼 대기 후 재시도
- 지수 백오프(1s → 2s → 4s ...) 와 jitter 함께 적용
- `X-RateLimit-Remaining` 이 낮아질 때 클라이언트 측에서 요청 속도를 선제적으로 완화

---

## 5. 에러 응답

모든 에러 응답은 다음 envelope 으로 내려갑니다.

```json
{
  "error": {
    "requestId": "01HXYZABCDEFG123456789",
    "code": "invalid-request",
    "message": "주문 방향이 올바르지 않습니다.",
    "data": {
      "field": "side",
      "allowedValues": ["BUY", "SELL"]
    }
  }
}
```

- `requestId` 는 응답 헤더 `X-Request-Id` 와 동일한 값. CS 문의 시 첨부 권장. (requestId 누락 시 응답 헤더 `x-amz-cf-id` 값 첨부)
- `code` 는 에러 코드 (예: `invalid-tick-size`, `order-not-found`, `invalid-token`)
- `message` 는 에러 관련 메시지
- `data` 는 에러 해결 힌트로, 코드별로 포함 여부와 키 구조가 다름

### 에러 코드 표

| HTTP Status | 에러 코드 | 발생 이유 |
|-------------|-----------|-----------|
| 400 BAD_REQUEST | `invalid-request` | 요청이 유효하지 않음 (호가 유형·주문 방향·수량·금액·필수 파라미터 누락 등) |
| 400 BAD_REQUEST | `confirm-high-value-required` | 주문 금액 1억원 이상인데 `confirmHighValueOrder` 가 `true` 가 아님 |
| 400 BAD_REQUEST | `account-header-required` | `X-Tossinvest-Account` 헤더 미전달 |
| 401 UNAUTHORIZED | `invalid-token` | 토큰이 유효하지 않거나 형식 오류 |
| 401 UNAUTHORIZED | `edge-blocked` | `Authorization` 헤더 미전달 |
| 401 UNAUTHORIZED | `expired-token` | 액세스 토큰 만료 |
| 401 UNAUTHORIZED | `login-user-not-found` | 토큰에 대응하는 로그인 정보 없음 |
| 403 FORBIDDEN | `edge-blocked` | 허용되지 않은 요청 |
| 403 FORBIDDEN | `forbidden` | 요청에 필요한 권한 부족 |
| 404 NOT_FOUND | `edge-blocked` | 요청한 API 경로 미지원 |
| 404 NOT_FOUND | `stock-not-found` | 요청한 종목을 찾을 수 없음 |
| 404 NOT_FOUND | `exchange-rate-not-found` | 환율 정보를 찾을 수 없음 |
| 404 NOT_FOUND | `account-not-found` | `X-Tossinvest-Account` 가 가리키는 계좌 없음 |
| 404 NOT_FOUND | `order-not-found` | `orderId` 에 해당하는 주문 없음 |
| 409 CONFLICT | `request-in-progress` | 동일 `clientOrderId` 에 대한 주문 생성 요청이 이미 처리 중 |
| 409 CONFLICT | `already-filled` | 정정/취소 대상 주문이 이미 체결됨 |
| 409 CONFLICT | `already-canceled` | 정정/취소 대상 주문이 이미 취소됨 |
| 409 CONFLICT | `already-modified` | 정정/취소 대상 주문이 이미 정정됨 |
| 409 CONFLICT | `already-rejected` | 정정/취소 대상 주문이 이미 거부됨 |
| 409 CONFLICT | `already-processing` | 동일 주문에 대한 정정/취소가 이미 처리 중 |
| 422 UNPROCESSABLE_ENTITY | `insufficient-buying-power` | 주문 가능 금액 부족 |
| 422 UNPROCESSABLE_ENTITY | `order-hours-closed` | 현재 주문(생성/정정/취소)을 접수할 수 없는 시간 |
| 422 UNPROCESSABLE_ENTITY | `stock-restricted` | 해당 종목이 거래 제한 상태 |
| 422 UNPROCESSABLE_ENTITY | `price-out-of-range` | 주문 가격이 허용 범위(상/하한가)를 벗어남 |
| 422 UNPROCESSABLE_ENTITY | `opposite-pending-order-exists` | 동일 종목에 반대 방향의 체결 대기 주문 존재 |
| 422 UNPROCESSABLE_ENTITY | `order-type-not-allowed` | 현재 사용할 수 없는 호가 유형 |
| 422 UNPROCESSABLE_ENTITY | `prerequisite-required` | 약관 동의·위험 고지 등 사전 자격 요건 미충족 |
| 422 UNPROCESSABLE_ENTITY | `market-not-supported-for-stock` | 해당 종목은 요청 시장에서 거래 불가 (KR) |
| 422 UNPROCESSABLE_ENTITY | `investor-exchange-not-integrated` | 투자자지시 거래소 설정이 통합(SOR)이 아님 (KR) |
| 422 UNPROCESSABLE_ENTITY | `amount-order-outside-regular-hours` | 금액 주문은 정규장에만 가능 (US) |
| 422 UNPROCESSABLE_ENTITY | `modify-restricted` | 해당 주문은 정정 제한 |
| 422 UNPROCESSABLE_ENTITY | `cancel-restricted` | 해당 주문은 취소 제한 |
| 429 TOO_MANY_REQUESTS | `edge-rate-limit-exceeded` | Rate limit 초당 요청 수 초과 |
| 429 TOO_MANY_REQUESTS | `rate-limit-exceeded` | Rate limit 초당 요청 수 초과 |
| 500 INTERNAL_SERVER_ERROR | `internal-error` | 서버 일시 장애 |
| 500 INTERNAL_SERVER_ERROR | `maintenance` | 시스템 점검 중 |

---

## 6. 데이터 모델 (참고)

API 레퍼런스에는 약 65개의 데이터 모델이 정의되어 있습니다. 주요 모델:

- **인증**: `OAuth2TokenResponse`, `OAuth2ErrorResponse`
- **공통**: `ApiResponse`, `ApiError`, `ErrorResponse`, `Currency`, `MarketCountry`, `MarketValue`, `Cost`
- **시세**: `OrderbookResponse`, `OrderbookEntry`, `PriceResponse`, `Price`, `Trade`, `PriceLimitResponse`, `Candle`, `CandlePageResponse`
- **종목**: `StockInfo`, `StockWarning`
- **환율·캘린더**: `ExchangeRateResponse`, `KrMarketCalendarResponse`, `KrMarketDay`, `KrMarketDetail`, `IntegratedHour`, `UsMarketCalendarResponse`, `UsMarketDay`, `UsDayMarketSession`, `UsPreMarketSession`, `UsRegularMarketSession`, `UsAfterMarketSession`, `PreMarketSession`, `RegularMarketSession`, `AfterMarketSession`
- **계좌·자산**: `Account`, `HoldingsItem`, `HoldingsOverview`, `ProfitLoss`, `DailyProfitLoss`, `OverviewMarketValue`, `OverviewProfitLoss`, `OverviewDailyProfitLoss`
- **주문**: `Order`, `OrderCreateRequest`, `OrderCreateQuantityBased`, `OrderCreateAmountBased`, `OrderModifyRequest`, `OrderResponse`, `OrderOperationResponse`, `OrderExecution`, `OrderStatus`, `PaginatedOrderResponse`
- **거래 정보**: `BuyingPowerResponse`, `SellableQuantityResponse`, `Commission`

> 각 모델의 상세 필드는 [OpenAPI JSON](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) 또는 [Models 디렉토리](https://openapi.tossinvest.com/openapi-docs/latest/api-reference/Models/) 참조.

#### `StockInfo` 전체 필드 (보강 조사, §8.1 참고)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `symbol` | String | 종목 심볼 |
| `name` | String | 종목명 (한글) |
| `englishName` | String | 영문 종목명 |
| `isinCode` | String | ISIN (ISO 6166) |
| `market` | String | 상장 시장 |
| `securityType` | String | 종목 유형 |
| `isCommonShare` | Boolean | 보통주 여부 |
| `status` | String | 상장 상태 |
| `currency` | Currency | 통화 정보 |
| `listDate` | date | 상장일 (YYYY-MM-DD, KST) |
| `delistDate` | date | 상장폐지일 (YYYY-MM-DD, KST) |
| `sharesOutstanding` | BigDecimal | **발행주식수** |
| `leverageFactor` | BigDecimal | 레버리지 배수 (ETF/ETN 대상) |
| `koreanMarketDetail` | KrMarketDetail | 국내 시장 상세 (`nxtSupported`, `krxTradingSuspended` 등) |

> **시가총액(`marketCap`/`marketCapitalization`) 필드는 존재하지 않음.** `sharesOutstanding`(발행주식수)만 제공되므로, 시가총액은 `종가(prices 또는 candles) × sharesOutstanding`으로 **자체 계산**해야 한다. 상세는 §8.1 참고.

#### `CandlePageResponse` 페이지네이션 (보강 조사, §8.3 참고)

- `candles[]`: `timestamp`, `openPrice`, `highPrice`, `lowPrice`, `closePrice`, `volume`, `currency`
- `nextBefore`: 다음 페이지 요청 시 `before` 파라미터에 그대로 전달할 커서(ISO 8601). 마지막 페이지는 `null`.

---

## 7. 핵심 유의사항 요약

- **인증**: 모든 API는 OAuth 2.0 토큰 필수. 계좌/자산/주문은 `X-Tossinvest-Account` 헤더도 필수.
- **고액 주문**: 주문 금액 **1억원 이상**이면 `confirmHighValueOrder=true` 필요.
- **피크시간 주문 제한**: `ORDER` / `ORDER_INFO` 그룹은 09:00~09:10 KST 에 3 TPS로 축소.
- **거래소별 특수 규칙**: US 금액 주문은 정규장에만 가능, KR은 SOR(통합) 설정·시장 지원 여부 확인 필요.
- **멱등성**: 주문 생성 시 `clientOrderId` 로 중복 요청 방지(`request-in-progress` 409).
- **스트리밍 없음**: 실시간 데이터는 REST 폴링으로 처리 (Rate Limit 준수).
- **시가총액 필드 없음**: `sharesOutstanding`(발행주식수)만 제공, 시총은 자체 계산 필요 (§8.1).
- **전체 종목 목록 덤프 불가**: `symbols`는 필수·최대 200개. 전 종목 마스터 리스트는 별도 소스로 확보해야 함 (§8.2, Open Questions 참고).
- **이용약관상 재배포·상업적 이용 제한 및 법인 고객 제외**: 서비스 설계 전 반드시 검토 (§8.4, Open Questions 참고).

---

## 8. 보강 조사 결과 (2026-07-05, 시가총액 대시보드 프로젝트 관점)

> 본 장은 기존 문서에서 "확인 필요"로 남았던 5개 항목을 공식 소스(overview.md, api-reference/README.md, openapi.json)와 보조 소스(공식 이용약관, 커뮤니티 실측 자료)로 재조사한 결과다. 각 항목마다 확인 결과와 신뢰도, 미확인 부분을 명시한다.

### 8.1 `/api/v1/stocks` 응답에 시가총액·상장주식수 필드가 있는가

**결론: 상장주식수(O), 시가총액(X).**

- `StockInfo` 모델(§6 표 참고)에 `sharesOutstanding`(BigDecimal, 발행주식수) 필드가 존재한다. 응답 예시에서 `"5919637922"`와 같이 문자열/숫자 형태의 대형 정수로 내려온다.
- `marketCap`, `marketCapitalization` 등 시가총액 관련 필드는 **openapi.json 스펙에 존재하지 않는다.**
- **시총 계산 소스 우선순위 (변경)**:
  1. **1순위**: `/api/v1/stocks`의 `sharesOutstanding` × 종가(`/api/v1/prices`의 `lastPrice` 또는 `/api/v1/candles`의 일봉 `closePrice`) — 자체 계산
  2. `sharesOutstanding`은 자주 바뀌지 않는 값이므로, 배치 설계상 **일 1회(장 마감 후) stocks를 재조회해 상장주식수 변동(증자·감자·액면분할 등)을 반영**하고, 시간당 배치는 가격만 갱신하는 방식을 권장.
- 검증: openapi.json 원문 스펙(WebFetch로 직접 파싱) + Models/StockInfo.md 레퍼런스 페이지 교차 확인. 두 소스 모두 동일한 필드 목록을 보여줌 → **신뢰도 높음.**

### 8.2 symbols 파라미터 최대 개수 / 전체 종목 목록 덤프 지원 여부

**결론: 최대 200개, 전체 덤프 미지원.**

| 엔드포인트 | symbols 제약 | 근거 |
|---|---|---|
| `GET /api/v1/stocks` | 콤마 구분, **최대 200개**, 파라미터 자체가 **필수** (생략 불가) | openapi.json 파라미터 설명 "종목 심볼. 콤마로 구분하여 최대 200건" |
| `GET /api/v1/prices` | 콤마 구분, **최대 200개** | openapi.json 파라미터 설명 "최대 200 개를 콤마(`,`)로 구분" |

- `market`/`country`/`exchange` 같은 필터 파라미터로 "해당 시장 전 종목"을 한 번에 받아오는 기능은 **존재하지 않는다.** 즉 사전에 종목 코드(symbol) 목록을 알고 있어야만 조회 가능한 구조다.
- **프로젝트 영향**: "전 종목 정기 수집"을 위해서는 KRX/미국 상장 종목의 전체 심볼 마스터를 **토스 API 밖에서 별도로 확보·관리**해야 한다(예: KRX 정보데이터시스템(data.krx.co.kr) 상장법인목록, DART 고유번호 목록, 미국은 NASDAQ/NYSE 심볼 리스트 등). 이후 그 심볼 목록을 200개씩 청크로 나눠 `/api/v1/stocks`, `/api/v1/prices`, `/api/v1/candles`를 호출하는 파이프라인이 필요하다. → **Open Questions에 반영.**
- 검증: openapi.json 파라미터 설명 원문을 두 차례(직접 파싱 + api-reference/README.md 경유) 교차 확인, 동일 수치 확인 → **신뢰도 높음.**

### 8.3 `/api/v1/candles` 과거 조회 가능 기간 · 1회 최대 캔들 수 · 페이지네이션 방식

**결론: 최대 캔들 수·페이지네이션 방식은 확인됨. 과거 조회 가능 "기간 상한"은 공식 문서에 명시되어 있지 않음(실호출 검증 필요).**

- **파라미터**:
  - `symbol` (필수)
  - `interval` (필수, enum: `1m` | `1d` — **분봉은 1분봉만 지원, 3/5/15/30/60분봉 등은 없음**)
  - `count` (선택, **최대 200**, 기본값 100)
  - `before` (선택, ISO 8601, **exclusive 상한 커서** — 이 시각 이전 데이터를 조회)
  - `adjusted` (선택, 수정주가 적용 여부, 기본값 `true`)
- **페이지네이션 방식**: cursor 기반. 응답의 `nextBefore` 값을 다음 요청의 `before`로 그대로 전달하며 과거로 반복 페이지네이션한다(offset/page 번호 방식이 아님).
- **일봉 과거 조회 가능 기간의 명시적 상한**: openapi.json, overview.md, api-reference/README.md 어디에도 "N년 전까지" 또는 "상장일부터 전체 제공" 같은 명시적 문구가 **없다.** 커뮤니티 실측 자료(비공식 CLI 프로젝트들)에서도 이 부분에 대한 실측 기록을 찾지 못했다.
  - ⚠️ **실호출 검증 필요**: 실제 계약 후 `interval=1d&count=200&before=<오늘>`로 반복 페이지네이션하여, 오래된 종목(상장일이 수년~수십 년 전인 대형주, 예: 삼성전자)을 대상으로 실제로 상장일까지 소급되는지, 아니면 특정 시점(예: 최근 N년)에서 데이터가 끊기는지 직접 확인해야 한다. 백필 파이프라인은 "데이터가 끊기는 시점(빈 배열 또는 `nextBefore=null`)"을 종료 조건으로 설계하면 상한을 몰라도 안전하게 동작한다.
  - `count=200, interval=1d` 기준 1회 호출로 약 200 영업일(~9~10개월)치를 받아오므로, 예를 들어 10년 백필 시 종목당 약 13회 호출이 필요하다(호출 간 `MARKET_DATA_CHART` 그룹 5 TPS 준수).
- 검증: openapi.json 직접 파싱 + api-reference/Apis/MarketDataApi.md 교차 확인 → 파라미터·최대값·페이지네이션 방식은 **신뢰도 높음**. 과거 조회 기간 상한 유무는 문서 부재를 교차 확인했을 뿐 실측은 못 했으므로 **신뢰도 낮음(실호출 필요)**.

### 8.4 이용약관·개발자 정책상 제3자 재제공(재배포) 관련 조항

**결론: 존재함. 프로젝트 사업 모델과 정면 충돌 소지가 있는 중대 이슈.**

- 공식 약관: [오픈 API 서비스 이용 약관](https://corp.tossinvest.com/ko/terms/v2?id=752) (`corp.tossinvest.com`, 2026-05-18자 기준 확인된 버전)
- 확인된 핵심 조항(요지, 검색엔진 인덱스 스니펫으로 반복 교차 확인):
  - "고객은 회사에서 제공하는 시세(국내주식, 해외주식) 정보를 **개인투자자 본인의 매매 목적에 한하여** 이용하여야 하며, **제3자에게 제공하거나 배포 또는 상업적으로 활용해서는 안 된다.**"
  - "**법인 고객은 오픈 API 서비스 대상에서 제외**된다. 법인 고객이 시세 정보를 수신하고자 하는 경우 (주)코스콤 등 시세 제공업체와 직접 계약을 체결하여야 한다."
  - 보안코드(앱키·시크릿키)를 제3자에게 대여·위임·양도·누설 금지.
- ⚠️ **검증 한계**: 해당 약관 페이지는 Next.js 클라이언트 사이드 렌더링(SPA)으로 구성되어 있어 WebFetch/curl로 원문 HTML을 직접 파싱할 수 없었다(초기 HTML에 `BAILOUT_TO_CLIENT_SIDE_RENDERING`만 존재, 본문은 브라우저에서 API 호출 후 JS로 렌더링됨). 위 조항 텍스트는 **검색엔진(WebSearch) 결과 스니펫을 통해 서로 다른 두 차례의 독립 질의에서 동일한 문구로 반복 확인**한 것이며, 약관 페이지를 브라우저로 직접 열어 원문을 재확인하는 절차가 **실호출(수동) 검증 필요**로 남아있다.
- **프로젝트 영향**: `invest-in-best`는 "1시간 1회 배치로 시세 수집 → 자체 DB 저장 → 대시보드로 제공"하는 서비스다. 이는
  1. 수집한 시세를 대시보드 사용자(제3자일 수 있음)에게 "제공"하는 행위로 해석될 여지가 있고,
  2. 서비스 형태로 운영될 경우 "개인투자자 본인의 매매 목적" 범위를 벗어날 가능성이 있으며,
  3. 만약 운영 주체가 법인이라면 애초에 오픈 API 신청 자격 자체가 없을 수 있다.
  → **법률 검토 및 대체 소스(예: KRX 정보데이터시스템 공식 시세 데이터, 코스콤 시세 라이선스, 상장기업 공시 기반 발행주식수 등) 병행 검토가 필요**하다. Open Questions에 반드시 반영.

### 8.5 Rate Limit 상세 재확인 (그룹별 TPS)

**결론: 기존 문서(§4)와 동일. overview.md 원문 재확인 완료.**

| Rate Limits Group | 요청 한도 | 피크시간 한도 | 프로젝트에서 쓰는 API |
|---|---|---|---|
| `STOCK` | 초당 최대 5회 | — | `/api/v1/stocks` |
| `MARKET_DATA` | 초당 최대 10회 | — | `/api/v1/prices`, `/api/v1/orderbook`, `/api/v1/trades`, `/api/v1/price-limits` |
| `MARKET_DATA_CHART` | 초당 최대 5회 | — | `/api/v1/candles` |
| `MARKET_INFO` | 초당 최대 3회 | — | `/api/v1/exchange-rate`, `/api/v1/market-calendar/*` |
| `AUTH` | 초당 최대 5회 | — | `/oauth2/token` |

- 값 자체는 overview.md와 openapi.json의 API별 description 말미 표기가 모두 일치 → **신뢰도 높음.**
- 다만 문서에도 "구체적 한도는 운영 상황에 따라 사전 공지 없이 조정될 수 있다"고 명시되어 있으므로, 배치 스케줄러는 **하드코딩된 TPS 상수가 아니라 응답 헤더(`X-RateLimit-Remaining`, `X-RateLimit-Reset`)를 읽어 동적으로 속도를 조절**하도록 구현하는 것이 안전하다.
- **배치 소요 시간 추정 (참고용)**: KRX 상장 종목 약 2,600여 개 + 미국 주요 종목을 합쳐 약 5,000 심볼 가정 시,
  - `stocks` 조회: 5,000 ÷ 200 = 25회 호출 ÷ 5 TPS ≈ **5초**
  - `prices` 조회: 25회 호출 ÷ 10 TPS ≈ **2.5초**
  - 일봉 `candles` 백필(종목당 1회, 최근 구간만): 5,000회 호출 ÷ 5 TPS ≈ **1,000초(약 16.7분)**
  - 시간당 배치 주기(1시간)에 비해 충분히 여유 있는 수준이나, candles를 종목당 여러 페이지로 백필할 경우 소요 시간이 배수로 증가하므로 초기 백필과 일 단위 증분 수집을 분리하는 설계를 권장.
  - 이 추정치는 실제 상장 종목 수·API 응답 지연시간을 반영하지 않은 **개략적 추정**이며, 실제 배치 설계 시 실측 필요.
