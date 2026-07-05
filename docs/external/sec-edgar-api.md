# SEC EDGAR API (data.sec.gov) 연동 정리

> 출처(1차, 공식): <https://www.sec.gov/search-filings/edgar-application-programming-interfaces> (EDGAR APIs 공식 문서, 페이지 최종 갱신 2025-04-08 / 내용 게시일 2024-06-06, 2026-07-05 재확인 — 내용 동일), <https://www.sec.gov/os/webmaster-faq> (Developer FAQ), <https://www.sec.gov/filergroup/announcements-old/new-rate-control-limits> (Rate Control Limits 공지, 최종 갱신 2024-06-28, 2026-07-05 재확인)
> 출처(2차, 실호출 검증): 2026-07-05 기준 `data.sec.gov` 및 `www.sec.gov` 실제 엔드포인트를 직접 호출하여 아래 회사들의 실데이터로 교차 검증함 — Apple(CIK 320193), Alphabet(CIK 1652044), Meta(CIK 1326801), Berkshire Hathaway(CIK 1067983), Alibaba(CIK 1577552), TSMC(CIK 1046179)
> 출처(3차, 커뮤니티/도구, 보조 참고용): [edgartools 공식 문서](https://edgartools.readthedocs.io/en/stable/guides/local-storage/), [edgartools GitHub Discussion #368](https://github.com/dgunning/edgartools/discussions/368), [tldrfiling.com 블로그](https://tldrfiling.com/blog/sec-edgar-api-rate-limits-best-practices), [XBRL US DQC 0067 규칙](https://xbrl.us/data-rule/dqc_0067/)
> 정리 기준일: 2026-07-05
> 이 문서는 요약본입니다. 최종 진실의 출처(Source of Truth)는 공식 페이지이며, 세부 스펙은 실제 호출로 최종 검증되었으나 회사별 예외가 있을 수 있으므로 구현 시 반드시 대상 종목 표본으로 재검증할 것.

## 1. 개요

- **무엇**: 미국 증권거래위원회(SEC)가 운영하는 전자공시시스템 EDGAR의 **기업 제출서류(submissions) 이력**과 **XBRL 재무데이터**를, 화면 파싱 없이 **RESTful JSON API**로 제공하는 서비스
- **Base 호스트**: `https://data.sec.gov` (데이터 API), 벌크 파일은 `https://www.sec.gov`
- **연동 방식**: **REST(JSON) API만** 제공. 공식 SDK 없음, Webhook/실시간 스트리밍 없음.
  - 이 프로젝트에서는 공식 REST 엔드포인트를 직접 호출하는 방식(개별 종목 갱신)과 **벌크 ZIP 다운로드 방식(전 종목 일일 배치)**을 병행한다.
- **인증**: **없음.** API 키·인증 토큰 불필요 (누구나 접근 가능). 단, **User-Agent 헤더 선언은 필수**(3장 참고).
- **응답 포맷**: 전부 JSON. 문자열이 아닌 **컬럼형 배열(columnar array)** 구조를 일부 사용해 용량을 압축한다.
- **갱신 주기**: 제출 시점에 실시간 갱신. submissions API는 통상 1초 미만, XBRL API는 통상 1분 미만 지연(피크 시 더 길어질 수 있음). 벌크 ZIP은 매일 새벽 약 03:00 ET 재생성 (단, 신규 제출이 없는 주말·공휴일에는 파일 내용이 갱신되지 않을 수 있음 — 5.2절 실측 참고).
- **커버 대상 XBRL 폼**: 10-Q, 10-K, 8-K, 20-F, 40-F, 6-K 및 그 변형. XBRL은 2009년부터 SEC 제출 의무화됨.
- **버전/LTS 개념 없음**: REST API이므로 SDK와 같은 버전 관리가 없다. 2024-06-06 게시, 2025-04-08 최종 검토된 공식 문서 내용이 2026-07-05 재확인 시점에도 URL·스펙 변경 없이 동일함을 확인했다. 즉 현재 시점 기준 최신·유효 스펙이다.

### 공식 문서 소스 (Source of Truth)

| 문서 | 용도 |
|------|------|
| [EDGAR APIs 공식 문서](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | 엔드포인트 목록·URL 형식·벌크 데이터 안내 |
| [Developer FAQ / Webmaster FAQ](https://www.sec.gov/os/webmaster-faq) | User-Agent 선언 방법, 요청 제한(10 req/s), Access Denied 대응 |
| [Rate Control Limits 공지](https://www.sec.gov/filergroup/announcements-old/new-rate-control-limits) | 초당 10요청 초과 시 실제 동작(차단 조건·해제 조건) |
| [Internet Security Policy](https://www.sec.gov/privacy#security) | 자동화 접근 시 준수해야 할 보안 정책 |
| [CIK Lookup](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany) | 회사 CIK 조회 |
| Ticker↔CIK 매핑 파일 | `https://www.sec.gov/files/company_tickers.json` (티커→CIK 전체 맵) |
| [SIC 코드 목록](https://www.sec.gov/search-filings/standard-industrial-classification-sic-code-list) | submissions API의 `sic` 필드 해석용 |

---

## 2. 핵심 개념

### CIK (Central Index Key)

- EDGAR가 각 제출 주체(회사·개인)에 부여하는 식별자.
- **API URL에는 반드시 10자리, 앞자리 0 패딩(leading zeros)** 형태로 넣는다.
  - 예: Apple의 CIK는 `320193` → URL에는 `CIK0000320193`.
- 티커(예: `AAPL`)만 알고 있다면 먼저 `https://www.sec.gov/files/company_tickers.json`으로 CIK를 조회 후 10자리로 zero-pad 한다.
- ⚠️ JSON 응답 바디 내부의 `cik` 필드는 (URL의 zero-pad 규칙과 달리) **문자열이며 이미 10자리로 zero-pad된 형태**로 내려온다 (실측: Apple `"cik": "0000320193"`). 타입은 항상 `string`이므로 숫자로 파싱 시 앞자리 0 유실에 주의.

### XBRL / 택소노미(taxonomy)

- XBRL(eXtensible Business Reporting Language): 재무제표 보고용 XML 기반 표준. 개별 XML 또는 최근에는 HTML 리포트에 인라인(inline XBRL)으로 임베드됨.
- 각 **fact(수치)** 는 표준 택소노미의 **concept(태그)** 에 매핑됨: `us-gaap`, `ifrs-full`, `dei`, `srt` 등.
- 아래 XBRL API들은 **비커스텀(non-custom) 택소노미** 이고 **전체 제출 주체(entity) 단위(= 차원/축(dimension/axis) 없는 non-segmented fact)** 에 적용되는 fact만 집계하므로, 회사 간·기간 간 비교가 가능하다.
  - ⚠️ **이 "non-segmented fact만 집계"라는 제약이 6장(상장주식수)의 다중 클래스 주식 이슈의 근본 원인이다.** 회사가 Class A/B/C처럼 축(Axis)을 붙여 세분화해서만 보고하는 값은 `companyconcept`/`companyfacts`/`frames` API에 **전혀 나타나지 않는다** (404 또는 필드 자체 부재). 반드시 6장을 읽고 구현할 것.

---

## 3. 필수 요청 규칙 (반드시 준수)

> ⚠️ 이 규칙을 어기면 `Undeclared Automated Tool` 또는 `Access Denied` 오류로 차단된다.

### 3.1 User-Agent 헤더 선언 (필수)

모든 자동화 요청은 **연락 가능한 정보를 담은 User-Agent** 를 선언해야 한다. SEC 권장 샘플 헤더:

```http
User-Agent: Sample Company Name AdminContact@<sample company domain>.com
Accept-Encoding: gzip, deflate
Host: www.sec.gov
```

- User-Agent에는 **회사/서비스명 + 관리자 연락 이메일**을 넣는다. (봇 식별 및 문제 발생 시 SEC가 연락하기 위함)
- `Accept-Encoding: gzip, deflate` 권장 — 응답 압축으로 대역폭 절약.
- `data.sec.gov` 호출 시 `Host: data.sec.gov` 로 맞춘다(위 샘플은 www.sec.gov 기준).
- 실호출 검증: User-Agent를 `"InvestInBest-Research research@investinbest.example.com"` 형태(서비스명+이메일, 공백 구분)로 설정해 모든 엔드포인트(submissions/companyconcept/companyfacts/frames/벌크 ZIP)를 문제없이 호출 확인함(2026-07-05).

### 3.2 요청 빈도 제한 (Rate Limit)

- **최대 초당 10 요청(10 requests per second).** 초과 시 일시 차단될 수 있다.
- 공식 공지 원문(2024-06-28 최종 검토, 2026-07-05 재확인): *"If a user or application submits more than 10 requests per second to EDGAR websites, the SEC may limit further requests from the relevant IP address(es) **for a brief period**. When the rate of requests drops below the 10-requests-per-second threshold, the user will be able to resume access."*
  - 즉 SEC는 차단 지속 시간을 **"brief period(짧은 기간)"** 로만 명시하고 정확한 분/초 단위를 공식 발표하지 않는다.
  - 일부 개발자 블로그(tldrfiling.com 등)는 "약 10분간 차단"이라고 언급하나 **공식 확인 불가 — 실호출 검증 필요.** 안전하게는 차단 감지 시 최소 수 분 이상 백오프 후 재시도하도록 구현 권장.
- 이 제한은 **IP 주소 단위**로 적용되며(공식 문서 표현), 클라이언트에 **레이트 리미터(초당 10건 이하, 안전 마진을 위해 초당 5~8건 권장)** 를 반드시 구현한다.

### 3.3 CORS

- `data.sec.gov`는 **CORS를 지원하지 않는다.** 브라우저에서 직접 fetch 불가 → **반드시 백엔드(서버)에서 호출**하고 프론트에 전달한다.

---

## 4. 엔드포인트 정리

### 4.1 Submissions — 제출 이력 + 기업 메타데이터

제출 주체의 최근 제출서류 이력과 메타데이터(현재명·이전명·상장 거래소·티커·SIC 업종코드·주소 등).

```
GET https://data.sec.gov/submissions/CIK##########.json
```

- `##########`: 10자리 zero-pad CIK.
- 예: `https://data.sec.gov/submissions/CIK0000320193.json` (Apple)
- 응답에는 **최근 1년치 또는 최근 1,000건 중 더 많은 쪽**의 제출 이력이 `filings.recent`에 컬럼형 배열로 담긴다.
- 그보다 오래된 이력이 있으면 응답의 `filings.files` 배열에 **추가 JSON 파일명과 해당 파일이 커버하는 날짜 범위**가 들어있다 → 필요 시 이어서 조회한다.

#### 4.1.1 최상위 필드 전체 목록 (실호출 검증 완료, Apple/Alibaba 응답 기준)

**"기업 정형 정보" 화면에 그대로 쓸 수 있는 필드들이다.**

| 필드 | 타입 | 설명 | Apple 예시 | 참고 |
|------|------|------|-----------|------|
| `cik` | string | 10자리 zero-pad CIK | `"0000320193"` | |
| `entityType` | string | 제출 주체 유형 | `"operating"` | Alibaba는 `"other"` |
| `sic` | string | **SIC 코드(4자리, 문자열)** | `"3571"` | 업종 분류. [SIC 코드 목록](https://www.sec.gov/search-filings/standard-industrial-classification-sic-code-list) 참고 |
| `sicDescription` | string | SIC 코드의 업종명(영문) | `"Electronic Computers"` | |
| `ownerOrg` | string | SEC 내부 심사 조직(업종 대분류) | `"06 Technology"` | |
| `insiderTransactionForOwnerExists` / `insiderTransactionForIssuerExists` | 0/1 | Form 3/4/5 내부자거래 신고 존재 여부 | | |
| `name` | string | 현재 등록 기업명 | `"Apple Inc."` | |
| `tickers` | string[] | 티커 배열(복수 상장 시 여러 개, `exchanges`와 인덱스 매칭) | `["AAPL"]` | Alibaba는 `["BABA","BABAF","BBAAY"]` |
| `exchanges` | string[] | `tickers`와 병렬 매칭되는 거래소 배열 | `["Nasdaq"]` | Alibaba는 `["NYSE","OTC","OTC"]` |
| `ein` | string | 미국 고용주 식별번호(Employer ID) | `"942404110"` | |
| `lei` | string\|null | Legal Entity Identifier | `null` | 대부분 null (거의 미사용) |
| `description` | string | 기업 설명 | `""` | 대부분 공란 — **화면 노출용 회사 소개문으로 쓰기엔 부적합, 별도 소스 필요** |
| `website` | string | 등록 웹사이트 | `""` | 대부분 공란 — **신뢰 불가, 필수 필드로 쓰지 말 것** |
| `investorWebsite` | string | IR 웹사이트 | `""` | 대부분 공란 |
| `category` | string | 제출자 규모 분류 | `"Large accelerated filer"` | Large/Accelerated/Non-accelerated filer 등 |
| `fiscalYearEnd` | string\|null | 회계연도 종료일(MMDD 4자리) | `"0926"` | **Alibaba(20-F)는 `null`** — 20-F 외국 민간 발행인은 이 필드가 비어있을 수 있음. 회계연도 말일은 대신 최근 10-K/20-F의 `reportDate`로 역산 필요 |
| `stateOfIncorporation` | string | 설립 주(州)/국가 코드 | `"CA"` | Alibaba는 `"K3"`(홍콩) |
| `stateOfIncorporationDescription` | string | 위 코드의 설명 | `"CA"` | Alibaba는 `"Hong Kong"` |
| `addresses.mailing` / `addresses.business` | object | 우편/사업 주소 (`street1`,`street2`,`city`,`stateOrCountry`,`zipCode`,`country`,`countryCode`,`isForeignLocation`) | 아래 참고 | 외국 기업은 `stateOrCountry`가 `null`이고 `country`/`countryCode`가 채워짐 (`isForeignLocation: 1`) |
| `phone` | string | 대표 전화번호 | `"(408) 996-1010"` | |
| `flags` | string | 특이 플래그(파산 등) | `""` | 대부분 공란 |
| `formerNames` | array | 과거 사명 이력 (`name`,`from`,`to`) | Apple Computer Inc 등 3건 | |
| `filings.recent` | object(컬럼형) | 최근 제출 이력 (`accessionNumber`,`filingDate`,`reportDate`,`acceptanceDateTime`,`act`,`form`,`fileNumber`,`filmNumber`,`items`,`core_type`,`size`,`isXBRL`,`isInlineXBRL`,`isXBRLNumeric`,`primaryDocument`,`primaryDocDescription`) | | `isXBRL=1`인 항목만 XBRL 구조화 데이터 존재 |

**Apple 주소 예시** (`addresses.business`):
```json
{
  "street1": "ONE APPLE PARK WAY",
  "street2": null,
  "city": "CUPERTINO",
  "stateOrCountry": "CA",
  "zipCode": "95014",
  "isForeignLocation": 0,
  "country": null,
  "countryCode": null
}
```

**Alibaba 주소 예시**(외국 민간 발행인, 20-F):
```json
{
  "street1": "26/F TOWER ONE",
  "street2": "TIMES SQUARE, 1 MATHESON STREET",
  "city": "CAUSEWAY BAY",
  "stateOrCountry": null,
  "zipCode": "00000",
  "isForeignLocation": 1,
  "country": "Hong Kong",
  "countryCode": "K3"
}
```

> **정리: "기업 정형 정보" 화면에 매핑할 필드 세트** — 회사명(`name`), 업종(`sic`+`sicDescription`), 티커/거래소(`tickers`+`exchanges`), 본사주소(`addresses.business`), 전화(`phone`), 제출자 규모(`category`), 설립지(`stateOfIncorporation`+`stateOfIncorporationDescription`), EIN(`ein`), 회계연도말(`fiscalYearEnd`, null 가능). `website`/`description`/`investorWebsite`는 공란이 매우 흔하므로 필수 UI 요소로 설계하지 말 것.

### 4.2 Company Concept — 회사×개념

한 회사(CIK)의 특정 concept(택소노미+태그) 하나에 대한 모든 XBRL 공시값. 측정단위(unit)별로 별도 배열로 반환(예: USD, CAD).

```
GET https://data.sec.gov/api/xbrl/companyconcept/CIK##########/{taxonomy}/{tag}.json
```

- 예: `https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/AccountsPayableCurrent.json`
- `{taxonomy}`: `us-gaap`, `ifrs-full`, `dei`, `srt` 등.
- `{tag}`: 해당 택소노미의 concept 태그명(대소문자 구분, 예: `AccountsPayableCurrent`).
- 해당 회사가 그 태그를 (비차원 fact로) 한 번도 보고한 적 없으면 **HTTP 404**를 반환한다. 이는 오류가 아니라 "그 태그로는 데이터 없음"을 뜻하므로, 폴백 체인 로직에서 **404를 정상적인 분기 조건으로 처리**해야 한다(6장·7장 참고).

### 4.3 Company Facts — 회사 전체 facts

한 회사의 **모든 concept 데이터**를 단일 호출로 반환(companyconcept를 회사 단위로 전부 합친 것).

```
GET https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json
```

- 예: `https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json`
- 응답 용량이 크므로 gzip 사용 권장. (실측: Apple ~수백KB, Alphabet 약 3.07MB, Meta 약 2.70MB — 시가총액 상위 기업일수록 보고 이력이 길어 용량이 커지는 경향)
- 구조: `facts.{taxonomy}.{tag}.units.{unit}` 배열. 특정 태그가 아예 없으면 그 taxonomy 객체에 키 자체가 없다(404가 아니라 단순 부재).

### 4.4 Frames — 특정 기간의 전 기업 스냅샷

하나의 concept에 대해, 요청한 **역년(calendar) 기간**에 가장 근접하게 마지막으로 제출된 fact를 **모든 제출 주체 단위로 하나씩** 모아준다. 기업 간 횡단 비교용.

```
GET https://data.sec.gov/api/xbrl/frames/{taxonomy}/{tag}/{unit}/{period}.json
```

- 예: `https://data.sec.gov/api/xbrl/frames/us-gaap/AccountsPayableCurrent/USD/CY2019Q1I.json`

**`{unit}` 규칙**
- 분자/분모가 있는 단위는 `-per-` 로 연결: 예 `USD-per-shares`.
- XBRL 기본 단위는 `pure`.

**`{period}` 규칙**
| 형식 | 의미 | 기간(duration) |
|------|------|-----------------|
| `CY####` | 연간 데이터 | 365일 ±30일 |
| `CY####Q#` | 분기 데이터 | 91일 ±30일 |
| `CY####Q#I` | 특정 시점(instantaneous, 잔액성 계정) | 시점값 |

- 예: `CY2019Q1I` = 2019년 1분기 시점(instant). `CY2019` = 2019 연간. `CY2019Q1` = 2019 1분기 기간.
- ⚠️ 회사마다 회계 캘린더 시작·종료일이 달라, frame은 역년 분기/연에 가장 잘 맞는 날짜 기준으로 조립된다. **동일 frame 안의 fact들도 실제 보고 시작/종료일이 다를 수 있음**에 유의. (구체적 사례·주의사항은 8장 참고)

---

## 5. 벌크 데이터 (대량 수집 시 권장 — 전 종목 일일 배치 최적화)

대량 데이터가 필요하면 개별 API 반복 호출보다 **벌크 ZIP 아카이브**가 훨씬 효율적. 매일 새벽 재컴파일됨.

### 5.1 파일 목록

| 파일 | 내용 | URL |
|------|------|-----|
| `companyfacts.zip` | XBRL Frames API + Company Facts API의 전체 데이터 | `https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip` |
| `submissions.zip` | 전체 제출 주체의 공개 제출 이력(Submissions API) | `https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip` |

### 5.2 실측 크기·갱신 시각 (2026-07-05 05:30 UTC 기준 HTTP HEAD 실측)

| 파일 | Content-Length | 환산 | Last-Modified |
|------|----------------|------|---------------|
| `companyfacts.zip` | 1,388,563,072 bytes | 약 1.29 GiB (1.39 GB) | 2026-07-03 22:19:12 GMT |
| `submissions.zip` | 1,549,810,197 bytes | 약 1.44 GiB (1.55 GB) | 2026-07-03 22:25:51 GMT |

- 두 파일 모두 확인 시점(일요일) 기준 **최근 갱신은 금요일 밤**이었다 → 신규 제출이 없는 주말·공휴일에는 파일이 재생성되지 않거나 내용이 바뀌지 않을 수 있다는 정황. 배치 스케줄러는 "매일 무조건 새 파일"을 가정하지 말고, 다운로드 전 `Last-Modified`/`ETag`를 확인해 **불필요한 재다운로드를 스킵**하는 조건부 요청(`If-Modified-Since` 또는 로컬 캐시 비교)을 구현하는 것이 좋다.
- ⚠️ 커뮤니티 도구(edgartools 공식 문서)는 companyfacts를 "약 2GB(압축)", submissions를 "약 5GB"로 추정한다 — 위 실측치와 차이가 있다(edgartools 쪽이 다른 시점 측정이거나 별도 번들을 포함했을 가능성). **실제 배치 설계 시에는 이 문서의 실측치보다, 구현 시점에 HTTP HEAD로 직접 재확인할 것** (파일은 계속 증가 추세이므로 시간이 지날수록 더 커진다).

### 5.3 내부 구조 (실호출 검증: ZIP 파일 tail 부분 범위 요청으로 중앙 디렉터리 확인)

두 ZIP 모두 **CIK 단위로 쪼개진 개별 JSON 파일**을 담고 있으며, 각 파일 내용은 해당 CIK로 API를 직접 호출했을 때와 **완전히 동일한 JSON**이다.

- `submissions.zip` 내부: `CIK##########.json` (submissions API 응답과 동일), 이력이 길어 페이지네이션된 회사는 `CIK##########-submissions-###.json` 형태의 추가 파일도 포함 (예: `CIK0000312070-submissions-031.json`). → `filings.files`에서 참조하는 추가 파일명 그대로 존재.
- `companyfacts.zip` 내부: `CIK##########.json` (companyfacts API 응답과 동일).
- 즉 **압축 해제 후 파일명으로 바로 CIK 매칭**이 가능하며, API 응답을 별도로 파싱/변환할 필요 없이 그대로 저장소에 적재 가능하다.

### 5.4 수집 전략 권장안 (프로젝트: 1일 1회, 미국 상장 전 종목)

| 방식 | 장점 | 단점 | 권장 상황 |
|------|------|------|-----------|
| **A. 벌크 ZIP 다운로드 후 필요 CIK만 추출** | SEC 서버 부하 최소화(공식 권장 방식), 네트워크 왕복 1~2회로 끝남, `submissions`+`companyfacts` 필드가 API와 100% 동일 | 매일 약 2.7GB 다운로드/스트리밍 압축해제 필요, 디스크·메모리 관리 필요 | **전 종목 일괄 수집(이 프로젝트의 기본 배치)** |
| B. 종목별 `companyconcept`/`companyfacts` 개별 호출 | 구현이 단순, 필요한 종목만 즉시 최신값 확인 가능 | 관리 종목 수(N)에 비례해 왕복 필요(초당 5~8건 제한 시 N=5,000이면 약 10~17분) — 다수 종목 순회 시 SEC에 불필요한 부하 | 신규 상장 종목 추가, 사용자 요청 즉시 갱신 등 **부분/증분 갱신** |

- **실무 팁**: ZIP은 통째로 디스크에 풀지 않고 **스트리밍으로 중앙 디렉터리를 읽어 관리 대상 CIK 목록에 해당하는 엔트리만 선택 추출**하면 디스크 사용량과 처리 시간을 크게 줄일 수 있다(예: Python `zipfile.ZipFile` + `namelist()` 필터링, 또는 Node `yauzl` 등). 전 세계 모든 CIK(비상장·펀드·개인 포함 수십만 건) 중 실제 "미국 상장 종목"은 일부이므로 필터링 효과가 크다.
- gzip 요청 헤더(`Accept-Encoding: gzip, deflate`)는 개별 API 호출(방식 B)에는 유효하지만, 벌크 ZIP은 이미 압축된 바이너리이므로 별도 gzip 협상이 큰 의미는 없다.

---

## 6. 상장주식수(Shares Outstanding) 조회 가이드 — 시가총액 계산용 (신규 보강)

> 프로젝트 요구사항: 시가총액 = 종가 × 상장주식수. 아래는 2026-07-05 실호출 검증 결과이며, **다중 클래스 주식 발행 기업은 표준 API만으로는 상장주식수를 안정적으로 얻을 수 없는 경우가 실제로 존재**함을 확인했다. 반드시 폴백 체인 + 예외 플래그 설계가 필요하다.

### 6.1 1순위 태그: `dei:EntityCommonStockSharesOutstanding`

```
GET https://data.sec.gov/api/xbrl/companyconcept/CIK##########/dei/EntityCommonStockSharesOutstanding.json
```

- SEC 공식 설명(API 응답의 `description` 필드 원문, dei 택소노미 정의 그대로):
  > "Indicate number of shares or other units outstanding of each of registrant's classes of capital or common stock or other ownership interests, if and as stated on cover of related periodic report. Where multiple classes or units exist define each class/interest by adding class of stock items such as Common Class A [Member], Common Class B [Member] or Partnership Interest [Member] onto the Instrument [Domain] of the Entity Listings, Instrument."
- 이 값은 **각 정기보고서(10-K/10-Q/20-F) 표지(cover page)** 에 기재된 발행주식수이며, 분기말이 아니라 **보고서 제출 직전 특정 영업일 기준**(예: Apple 10-Q 표지는 통상 회계분기 종료 후 2~3주 뒤 시점) 값이다. 시가총액용으로 쓰기엔 "그 시점"과 "결산일" 사이에 약간의 시차가 있음에 유의.

### 6.2 단일 클래스 기업 — 정상 동작 확인 (Apple 실측)

Apple(CIK 320193)은 보통주 단일 클래스이며, 해당 태그가 2009년부터 현재(2026-04-17, FY2026 Q2 10-Q)까지 총 69건 정상 수신됨:

```json
{
  "end": "2026-04-17",
  "val": 14687356000,
  "accn": "0000320193-26-000013",
  "fy": 2026,
  "fp": "Q2",
  "form": "10-Q",
  "filed": "2026-05-01",
  "frame": "CY2026Q1I"
}
```

### 6.3 다중 클래스(Class A/B/C) 기업 — 실제로 깨지는 사례 3건 (실호출 검증)

| 회사 | CIK | `dei:EntityCommonStockSharesOutstanding` (companyconcept) | `us-gaap:CommonStockSharesOutstanding` (companyconcept) |
|------|-----|---|---|
| Alphabet Inc. (Class A/B/C) | 1652044 | **HTTP 404** (완전 부재) | HTTP 200, 정상 — 최근값 12,088,000,000 (2025-12-31, **클래스 합산 총합**으로 추정) |
| Meta Platforms (Class A/B) | 1326801 | **HTTP 404** | **HTTP 404** (역시 완전 부재) |
| Berkshire Hathaway (Class A/B) | 1067983 | HTTP 200이지만 **2009~2011년 사이 7건만 존재, 이후 완전 중단**. 그중 1건은 `val: 0`(비정상값 포함) | **HTTP 404** |

- **원인**: 이 3사 모두 표지에 발행주식수를 **클래스별로(Axis: `us-gaap:StatementClassOfStockAxis`) 나누어서만** 보고하기 때문에, "차원(축) 없는 entity-wide fact"만 모으는 `companyconcept`/`companyfacts` API에는 애초에 집계되지 않는다(2장의 근본 원인 참고). Berkshire는 2011년까지는 비차원 fact를 병행 보고하다가 이후 완전히 차원 전용으로 전환한 것으로 보인다.
- Alphabet의 `us-gaap:CommonStockSharesOutstanding`이 예외적으로 존재하는 이유: 대차대조표 자본 항목에서는 클래스 합산 총계를 별도 non-dimensional fact로도 병행 보고하기 때문. **이 병행 보고 여부는 회사마다 다르므로 일반화 불가** — 반드시 종목별 실측 필요.

### 6.4 다중 클래스 실제 원본 데이터 검증 (Alphabet FY2025 10-K 표지 직접 확인)

`companyconcept`/`companyfacts`로는 안 보이지만, **개별 filing의 원본 R-file(재무제표 뷰어 HTML)을 직접 열어보면 클래스별 수치가 존재**함을 확인했다 (accession `0001652044-26-000018`, `R1.htm` = Cover Page):

| 클래스 | XBRL Axis/Member | 실측값 (2026-01-30 기준) |
|--------|-------------------|--------------------------|
| Class A | `us-gaap:StatementClassOfStockAxis` = `us-gaap:CommonClassAMember` | 5,822,000,000 |
| Class B | `us-gaap:StatementClassOfStockAxis` = `us-gaap:CommonClassBMember` | 837,000,000 |
| Class C | `us-gaap:StatementClassOfStockAxis` = `goog_CapitalClassCMember` (**회사 커스텀 확장 태그**) | 5,438,000,000 |
| 합계 | — | 12,097,000,000 (≈ `us-gaap:CommonStockSharesOutstanding` 12,088,000,000과 거의 일치, 기준일 차이로 소폭 차이) |

- Class C가 표준 taxonomy 멤버가 아니라 **회사별 커스텀 확장(`goog:` 네임스페이스)** 이라는 점이 중요하다 — 이는 공식 문서가 명시한 "커스텀 택소노미로 확장한 값은 비교 API에서 제외된다"는 제약이 실제로 발현된 사례다.
- 클래스별 원본 수치가 반드시 필요하다면 `companyconcept`/`companyfacts`/`frames`가 아니라 **개별 filing의 `FilingSummary.xml` → Cover Page R-file(R1.htm 등)** 을 직접 파싱해야 한다. 이는 이 프로젝트가 현재 사용 중인 회사/기간 단위 API의 스코프를 벗어나는 별도 파이프라인이므로, **다중 클래스 기업에 한해 별도 처리(수동 확인 또는 별도 크롤러) 여부는 Open Questions로 남긴다.**

### 6.5 권장 폴백 체인 (구현 지침)

```
1) dei:EntityCommonStockSharesOutstanding (companyconcept)
   → 200이고 최신 데이터(최근 1개 분기 이내)면 채택
2) 실패(404) 또는 최신성 없음 시 → us-gaap:CommonStockSharesOutstanding (companyconcept)
   → 200이면 "합산 총계로 추정"이라는 신뢰도 플래그와 함께 채택 (회사별 검증 필요)
3) 그마저 실패 시 → us-gaap:WeightedAverageNumberOfSharesOutstandingBasic (companyconcept)
   → 분기/연간 "가중평균" 발행주식수이며 특정 시점(point-in-time) 값이 아니므로
     시가총액 계산용으로는 근사치(proxy)로만 사용하고 반드시 신뢰도 플래그를 낮춰 저장
   → 실측: Meta는 이 태그가 정상 존재(2025Q3 약 25.2억주, 클래스 합산) → 최후 대안으로 유효
4) 1~3 모두 실패 시 → "shares_outstanding_source: manual_override_needed"로 플래그하고
   해당 종목은 배치에서 자동 값 대신 수동/대체 데이터 소스로 별도 관리
```

- 이 태그 우선순위 목록은 **하드코딩 금지 원칙에 따라 코드베이스의 상수/설정 모듈(예: `constants/xbrlTags.ts` 또는 `config/xbrl_tags.py`)에 배열로 정의**하고, 서비스 로직은 이 설정을 순회하도록 구현한다.

---

## 7. 분기 매출 태그 폴백 체인 (신규 보강)

### 7.1 us-gaap 택소노미 — 회계기준 변경(ASC 606) 폴백 체인

2018년 전후로 미국 회계기준(ASC 606, 고객과의 계약에서 생기는 수익)이 바뀌면서 매출 태그가 여러 차례 교체되었다. **하나의 태그만으로는 전체 기간(2009~현재) 데이터를 얻을 수 없으므로 반드시 폴백 체인이 필요**하다.

| 우선순위 | 태그 | 적용 시기(실측) | 비고 |
|---|---|---|---|
| 1 | `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax` | **현재 표준.** ASC 606 도입 이후(대략 FY2018~2019 신고분부터) 현재(2026 Q2)까지 사용 중 | 판매세 등 정부에 대신 징수하는 세금을 매출에서 제외하는 회계정책을 쓰는 기업 |
| 2 | `us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax` | 위와 동일 시기, 세금 포함 정책을 쓰는 기업 | 1번과 상호 배타적(같은 filing에서 둘 다 안 씀) — [XBRL US DQC 규칙](https://xbrl.us/data-rule/dqc_0067/)에서도 "상호 배타적 원소"로 명시 |
| 3 | `us-gaap:Revenues` | ASC 606 전환기(과도기, 보통 회사의 최초 606 적용 회계연도 1개년 10-K에서만 짧게 사용) 또는 금융업 등 특정 업종 | Apple 실측: FY2018 10-K(2016~2018 3개년 비교표시)에서만 11건 등장 후 이후 사라짐. **일부 기업(예: Alibaba, 20-F)은 지금도 계속 `Revenues` 사용 중** — 획일적 "과거용" 취급 금지 |
| 4 | `us-gaap:SalesRevenueNet` | ASC 606 이전(레거시), 대략 ~2018년 상반기까지 | Apple 실측: 2009 FY~2018 Q3까지 185건. 이후 완전히 사용 중단 |
| 5 | `us-gaap:SalesRevenueGoodsNet` / `us-gaap:SalesRevenueServicesNet` | `SalesRevenueNet`과 같은 시기, 제품/서비스 매출을 구분 보고하는 기업 | 두 값의 합이 총매출에 해당하는 경우가 있음(회사마다 다름 — 실호출 검증 필요) |

**실호출 검증 예시 (Apple, us-gaap, 10-K/10-Q 기준 실측)**

| 태그 | 데이터 존재 구간(fy/fp) | 건수 |
|---|---|---|
| `SalesRevenueNet` | FY2009 ~ FY2018 Q3 (2007-09-29 ~ 2018-06-30) | 185 |
| `Revenues` | FY2018 (2016-09-24 ~ 2018-09-29, 비교연도 포함) | 11 |
| `RevenueFromContractWithCustomerExcludingAssessedTax` | FY2019 ~ FY2026 Q2 (2017-09-30 ~ 2026-03-28) | 113 |

→ **하나의 기업이라도 시계열 전체를 채우려면 위 3개 태그를 이어 붙여야 한다.** 특정 회계연도에 태그가 전환된 시점(주로 최초 10-K 연차보고서 시점)에서는 같은 회계기간이 신·구 태그 양쪽에 겹쳐 나타날 수 있으므로, 병합 시 `(fy, fp, start, end)` 기준 중복 제거가 필요하다.

### 7.2 ifrs-full 택소노미 — 20-F(IFRS 회계기준) 기업용

| 우선순위 | 태그 | 비고 |
|---|---|---|
| 1 | `ifrs-full:Revenue` | IFRS를 회계기준으로 채택한 20-F 제출 기업(예: TSMC) 대상. 실측: TSMC(CIK 1046179) 정상 응답, 값 존재 |
| 2 | (해당 없음, us-gaap 폴백) | **일부 20-F 기업은 IFRS가 아니라 US-GAAP을 회계기준으로 선택**해 20-F를 제출한다 (외국 민간 발행인은 US-GAAP 또는 IFRS 중 선택 가능). 이 경우 `ifrs-full:Revenue`는 404이고, 대신 7.1절의 `us-gaap` 폴백 체인을 그대로 적용해야 한다. 실측: Alibaba(CIK 1577552, 20-F 제출)는 `ifrs-full:Revenue`, `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax` 모두 404이며, **`us-gaap:Revenues` 태그로 연 1회(FY) 데이터만 정상 존재** |

**⚠️ 20-F 기업의 근본적 한계: 분기(Quarterly) 데이터 자체가 SEC EDGAR에 구조화된 형태로 없다**

- 20-F는 **연 1회(연차보고서)** 만 제출되며, 미국 국내기업의 10-Q(분기보고서)에 해당하는 의무 제출서류가 없다. 외국 민간 발행인(FPI)은 자국 규정에 따라 분기/반기 실적을 **6-K(수시보고서)** 로 furnish(제출이 아닌 참고 통보) 하는데, **6-K는 XBRL 구조화 태깅이 의무가 아니다.**
- 실측(Alibaba, submissions API): 최근 조회 가능한 6-K 335건 중 **XBRL 구조화 데이터(`isXBRL: 1`)가 있는 건은 단 10건.** 즉 6-K 대부분은 PDF/HTML 형태의 비정형 보도자료이며 API로 분기 매출을 자동 추출할 수 없다.
- **결론**: IFRS/20-F 기반 해외 상장기업(ADR)은 이 프로젝트의 "분기 매출 합산" 지표에서 **구조적으로 연간 데이터만 확보 가능**하다고 가정하고 설계해야 한다. 분기 단위가 반드시 필요하다면 EDGAR 외 별도 데이터 소스가 필요하며, 이는 Open Questions로 남긴다.

---

## 8. Q4 도출(연간 − Q1 − Q2 − Q3) 및 회계연도 처리 주의사항 (신규 보강)

### 8.1 Q4는 애초에 별도로 존재하지 않는다 (실측 확인)

- `companyconcept` 응답의 `fp`(fiscal period) 필드는 **`FY`, `Q1`, `Q2`, `Q3`만 존재하며 `Q4`는 단 한 번도 나타나지 않는다** (Apple 매출 태그 113건 전수 확인). 이는 10-K가 연간 총계만 보고하고 별도 4분기 수치를 태깅하지 않기 때문 — **Q4는 반드시 "연간 FY값 − Q1 − Q2 − Q3"로 파생 계산해야 한다.**
- 커뮤니티에서도 동일한 결론이 확인된다 — 8-K의 Item 2.02(실적발표)/Exhibit 99.1(보도자료)에서 선행 지표를 얻으려는 시도가 있으나 "구조가 일관되지 않아 표준화가 어렵다"는 것이 중론이다([edgartools Discussion #368](https://github.com/dgunning/edgartools/discussions/368)). 즉 **정식 Q4 확정치는 10-K 제출 시점(회계연도 종료 후 통상 2~3개월 뒤)에야 얻을 수 있다** — Q1~Q3 대비 필연적으로 최대 수개월 지연되는 구조적 한계로 인지하고 배치/알림 설계에 반영할 것.

### 8.2 회계연도(fiscal) vs 역년(calendar) 분기 라벨링 불일치 (실측 확인)

Apple은 회계연도가 9월 말 마감이라 **"fp: Q1"(회계 1분기, 10~12월)이 실제로는 전(前) 역년의 4분기에 해당**한다:

```json
{
  "start": "2025-09-28",
  "end": "2025-12-27",
  "val": 143756000000,
  "fy": 2026,
  "fp": "Q1",
  "form": "10-Q",
  "frame": "CY2025Q4"
}
```

- 위 예시에서 `fp: "Q1"`(Apple의 **회계** 1분기)이지만 SEC가 자동 산정하는 `frame` 필드는 `"CY2025Q4"`(**역년** 2025년 4분기)이다.
- **이 프로젝트의 DB가 역년 기준 분기(1~3월=Q1, 4~6월=Q2, …)로 설계되어 있다면, `fp` 라벨을 그대로 신뢰하지 말고 반드시 `start`/`end` 날짜(보고 기간의 실제 개시/종료일)를 기준으로 역년 분기를 재계산해야 한다.** `fp`는 "그 회사의 회계상 몇 번째 분기인가"만 알려줄 뿐, 달력상 분기와 무관하다.
- 회계연도 종료월이 다른 기업(Apple: 9월, Microsoft: 6월, Walmart: 1월 등)이 매우 흔하므로, 전 종목을 다루는 이 프로젝트는 **`fiscalYearEnd`(submissions API, 4.1절) 또는 개별 fact의 `start`/`end`로 역년 매핑을 정규화하는 공통 유틸**이 필수다.

### 8.3 동일 (fy, fp) 튜플에 서로 다른 기간의 값이 공존할 수 있음 (실측 확인)

같은 (fy=2026, fp=Q1) 조합 안에, "이번 분기 값"과 "다음 분기 보고서에 비교표시로 재수록된 지난 분기 값"이 **서로 다른 accession number로 함께 존재**한다:

| accn | start | end | fy | fp | frame |
|---|---|---|---|---|---|
| `0000320193-25-000008` | 2024-09-29 | 2024-12-28 | 2025 | Q1 | (없음) |
| `0000320193-26-000006` | 2024-09-29 | 2024-12-28 | 2026 | Q1 | `CY2024Q4` |

→ 두 번째 행은 **1년 뒤 10-Q에 "전년 동기 비교" 목적으로 재수록된 값**이며, `(fy, fp)`만으로 유일하게 식별되지 않는다. **반드시 `(start, end)` 조합으로 기간을 식별**하고, "최초 보고 시점 값"이 필요한지 "최신/재작성된 값"이 필요한지 정책을 정해 `accn` 기준으로 선택해야 한다. (frame 필드가 붙은 쪽이 "가장 최근에 그 기간에 대해 보고된" 값 — 즉 frames API가 실제로 채택하는 값이다.)

### 8.4 frames API의 역년 조립 시 이례적 기간(stub period) 혼입 (실측 확인)

`GET /api/xbrl/frames/us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax/USD/CY2025Q1.json` 실호출 결과(2,541개 기업 데이터 포인트) 중 대부분은 약 91일(Jan~Mar) 구간이었으나, **2개 기업(Bally's Corporation, Bally's Chicago)은 약 51일짜리 비정상 구간(2025-02-08~2025-03-31)** 이 섞여 있었다 — 회계연도 변경, 인수합병(M&A), 신규 상장 등으로 인한 **스텁 기간(stub period)** 사례다.

- 이런 스텁 기간은 "91일 ±30일"이라는 frames API의 자체 필터링 범위(약 61~121일) 안에도 들어올 수 있어 기계적으로 걸러지지 않는다.
- **naive하게 "연간 − Q1 − Q2 − Q3" 뺄셈을 적용하면**, 회계연도 변경 기업이나 스텁 기간이 낀 기업은 음수, 극단치, 또는 실제 4분기 실적과 무관한 값이 나올 수 있다. 구현 시 **기간 길이(=`end`-`start`) 검증 로직(정상 분기: 75~100일, 정상 연간: 340~390일 정도의 합리적 범위)** 을 두고, 범위를 벗어나면 자동 채택 대신 예외 플래그를 세우는 것을 권장한다.

### 8.5 Q4 도출 실무 체크리스트

```
1. 동일 태그(7장 폴백 체인 적용 후 확정된 태그)로 (fy, start, end) 유일성 기준 중복 제거
2. FY 총계 - (그 회계연도에 속하는 Q1+Q2+Q3 합계) = Q4 파생값
   - "그 회계연도에 속하는" 판단은 각 분기 값의 fy 필드가 FY 값의 fy와 동일한지로 매칭
   - fp 라벨이 아니라 반드시 start/end 기간이 서로 겹치지 않고 연속(contiguous)인지 검증
3. 기간 길이 이상치(스텁 기간) 검출 시 자동 계산 대신 수동 검토 큐로 분리
4. 20-F/IFRS 기업(7.2절)은 애초에 Q1~Q3 개별 값이 없으므로 이 파생 로직 자체를 적용하지 않고 "연간만 제공" 처리
5. 역년(calendar) 분기 표시가 필요하면 fp가 아닌 end 날짜 기준으로 재라벨링(8.2절)
```

---

## 9. 이 프로젝트에서의 연동 방식 (필수 준수)

- **백엔드 경유 필수**: `data.sec.gov`는 CORS 미지원 → 프론트엔드에서 직접 호출 금지. 반드시 백엔드에서 프록시.
- **User-Agent 상수화**: 하드코딩 금지. User-Agent 문자열(서비스명+연락 이메일)은 환경변수/설정으로 관리.

```env
# .env (커밋 금지 — .gitignore 포함)
SEC_EDGAR_USER_AGENT="InvestInBest support@investinbest.example.com"
```

- **레이트 리미팅**: 초당 10건 이하로 제한하는 스로틀러를 클라이언트 계층에 구현 (안전 마진으로 초당 5~8건 권장, 3.2절 참고).
- **gzip 요청**: `Accept-Encoding: gzip, deflate` 헤더로 대역폭 절약(companyfacts는 특히 큼).
- **CIK 정규화 유틸**: 티커/숫자 CIK → `CIK{10자리 zero-pad}` 변환 함수를 공통 유틸로 둔다.
- **XBRL 태그 우선순위 목록의 설정화**: 6장(상장주식수)·7장(매출) 폴백 체인은 하드코딩 금지 원칙에 따라 별도 상수/설정 모듈에 배열로 정의하고, 서비스 로직에서 순회하도록 구현.
- **재시도/백오프**: 429·403·5xx 응답 시 지수 백오프 재시도. 단, 근본 원인이 User-Agent 미선언/레이트 초과인 경우 재시도 전 헤더·빈도부터 점검. companyconcept의 **404는 재시도 대상이 아니라 "그 태그로는 데이터 없음"이라는 정상 분기 신호**이므로 폴백 체인의 다음 태그로 즉시 전환한다.
- **캐싱**: 갱신 지연이 실시간(<1분)이므로 짧은 TTL 캐시로 반복 호출을 줄인다. **전 종목 일일 배치는 5.4절의 방식 A(벌크 ZIP)를 기본으로 사용**하고, 개별 종목 즉시 갱신에는 방식 B(개별 API 호출)를 보조적으로 사용한다.

### 요청 헤더 예시 (Python)

```python
import os
import requests

HEADERS = {
    "User-Agent": os.environ["SEC_EDGAR_USER_AGENT"],  # "회사명 이메일"
    "Accept-Encoding": "gzip, deflate",
    "Host": "data.sec.gov",
}

def get_submissions(cik: int) -> dict:
    cik10 = f"CIK{cik:010d}"
    url = f"https://data.sec.gov/submissions/{cik10}.json"
    resp = requests.get(url, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    return resp.json()
```

---

## 10. 제약·주의사항 요약

- **인증 불필요**하지만 **User-Agent 선언은 필수** — 미선언 시 `Undeclared Automated Tool` 차단.
- **초당 10요청** 하드 리밋. 초과 시 IP 단위로 일시 차단(공식 문서는 "brief period"로만 명시, 정확한 차단 시간은 미공개 — 3.2절).
- **CORS 미지원** — 서버 사이드에서만 호출.
- SEC는 **스크립트 다운로드 개발/디버깅에 대한 기술 지원을 제공하지 않는다.** 문의/건의는 webmaster@sec.gov.
- XBRL API가 집계하는 것은 **비커스텀 택소노미 + 전체 entity 단위(비차원) fact** 뿐 → **다중 클래스 주식 발행 기업의 발행주식수는 이 제약으로 인해 404이거나 데이터가 없을 수 있다(6장, 실측 확인).**
- frame 데이터는 역년 기준으로 조립되어, 실제 회사별 보고 기간과 어긋날 수 있고 스텁 기간이 섞여 들어올 수 있다(8.4절, 실측 확인).
- **Q4는 원천 데이터에 존재하지 않으며 항상 연간−Q1−Q2−Q3로 파생해야 한다(8.1절, 실측 확인)**, 이로 인해 확정 Q4 수치는 10-K 제출 시점까지 지연된다.
- **20-F(외국 민간 발행인) 기업은 구조적으로 EDGAR를 통한 분기 매출 확보가 불가능에 가깝다** — 6-K 대부분이 XBRL 미태깅(7.2절, 실측: 335건 중 10건만 XBRL).
- 벌크 ZIP은 매일 갱신되지만 신규 제출이 없는 날은 내용이 그대로일 수 있다(5.2절).

---

## 11. Open Questions (실호출 검증 필요 / 추가 확인 필요 항목)

1. **다중 클래스 주식 기업의 클래스별 원본 수치 확보 범위**: 6.4절에서 확인했듯 Alphabet/Meta/Berkshire 등 다중 클래스 기업은 `companyconcept`/`companyfacts`로 발행주식수를 안정적으로 얻을 수 없다. 이런 기업들(전체 상장 종목 중 몇 %인지는 미확인)에 대해 (a) `us-gaap:CommonStockSharesOutstanding` 합산치를 그대로 신뢰할지, (b) `WeightedAverageNumberOfSharesOutstandingBasic`을 프록시로 쓸지, (c) 개별 filing의 R-file을 직접 파싱하는 별도 파이프라인을 구축할지는 제품 정책 결정이 필요하다. → 메인 루프에서 확인 필요.
2. **레이트리밋 차단 지속 시간의 정확한 값**: 공식 문서는 "brief period"로만 명시하고 블로그는 "약 10분"이라 언급하나 공식 확인 불가. 재시도 백오프 설계 시 보수적으로(예: 최소 5~10분) 잡을지 여부는 실제 차단을 겪어보며 조정 필요 — 실호출 검증 필요.
3. **20-F 기업의 분기 데이터 완전 부재를 프로덕트 정책으로 수용할지 여부**: "분기 매출 합산 지표"가 모든 상장 종목(20-F 기업 포함)에 대해 요구되는지, 아니면 20-F 기업은 연간 지표만 제공하는 것으로 스코프를 좁힐지는 제품 결정이 필요하다. → 메인 루프에서 확인 필요.
4. **벌크 ZIP 파일 크기 추정치 불일치**: 이 문서의 실측치(companyfacts ~1.29GiB, submissions ~1.44GiB, 2026-07-05 기준)와 커뮤니티 도구(edgartools)의 추정치(~2GB, ~5GB)가 차이가 난다. 배치 인프라(디스크/네트워크) 용량 설계 시 여유를 두고, 구현 착수 시점에 다시 HEAD 요청으로 재확인 권장.
5. **us-gaap:CommonStockSharesOutstanding이 "클래스 합산 총계"인지 회사마다 보장되는지**: Alphabet 사례로는 합산치로 추정되나(6.3절), 전수 검증은 하지 않았다. 다중 클래스 기업을 폴백 체인 2단계에 태울 때 종목별 표본 검증이 필요하다.
6. **Q4 파생값의 이례치(스텁 기간, 회계연도 변경) 자동 검출 임계값**: 8.4절에서 제안한 "정상 분기 75~100일/정상 연간 340~390일" 임계값은 이 문서 조사 과정에서의 관찰치 기반 제안이며, 전체 상장 종목 대상 통계적 검증은 하지 않았다. 실제 배치 파이프라인 구현 후 이상치 비율을 모니터링해 임계값을 튜닝할 필요가 있다.
