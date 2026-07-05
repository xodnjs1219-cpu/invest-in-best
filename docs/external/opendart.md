# OpenDART(전자공시시스템 오픈API) 연동 정리

> 출처: <https://opendart.fss.or.kr/guide/main.do> (개발가이드), <https://opendart.fss.or.kr/intro/main.do> (오픈API 소개), <https://opendart.fss.or.kr/intro/terms.do> (이용약관)
> 정리 기준일: 2026-07-05 (최초 작성) / **보강 조사: 2026-07-05, 개발가이드 상세 페이지를 브라우저로 직접 열람하여 5개 미확인 항목을 1차 출처로 재검증**
> 이 문서는 요약본입니다. 최종 진실의 출처(Source of Truth)는 [OpenDART 개발가이드](https://opendart.fss.or.kr/guide/main.do) 각 API 상세 페이지입니다. 파라미터/응답 필드 등 세부 스펙은 반드시 실제 호출로 최종 검증할 것.
>
> ### 보강 조사 변경 이력 (2026-07-05)
>
> 아래 5개 항목을 OpenDART 공식 개발가이드 상세 페이지(`opendart.fss.or.kr/guide/detail.do`)를 브라우저로 직접 열람해 1차 출처로 확인했다. 모든 상세 페이지는 로그인 없이도 열람 가능했고, `crtfc_key`를 제외한 요청/응답 스펙 표는 페이지에 정적으로 노출되어 있었다.
>
> 1. DS002 "주식의 총수 현황"(`stockTotqySttus`) 엔드포인트·요청 파라미터·응답 필드 전체 확인 → 3.2절
> 2. 공시검색(`list.json`) `corp_code` 생략 시 전체 시장 조회 가능 여부 확인 → 3.1절
> 3. 일일 요청 한도 공식 수치 확인(FAQ + 여러 API 상세 페이지의 상태코드 `020` 설명 문구로 교차 검증) → 4장
> 4. 분기/반기보고서 손익계산서의 3개월치·누적치 필드 구분 확인 → 3.3절
> 5. `fnlttSinglAcntAll` 등 재무제표 API의 `fs_div`(CFS/OFS) 권장 사용법(폴백 패턴) 확인 → 3.3절

## 1. 개요

- **무엇**: 금융감독원(FSS)이 운영하는 전자공시시스템(DART)에 축적된 기업 공시 데이터를, 화면 파싱 없이 **REST API**로 바로 가져올 수 있게 제공하는 서비스
- **Base 서버**: `https://opendart.fss.or.kr`
- **연동 방식**: 현재 **REST API만** 제공 (공식 SDK 없음, Webhook/실시간 스트리밍 없음)
  - 이 프로젝트에서는 SDK/Webhook 조사가 불필요하며, **API 연동 한 가지 수단**만 구현하면 된다.
  - 커뮤니티 제작 라이브러리(Python `OpenDartReader`, `dart-fss`, Kotlin/Java `opendart-reader` 등)는 존재하지만 금융감독원 공식 SDK가 아니므로, 이 프로젝트는 공식 REST 엔드포인트를 직접 호출하는 방식을 기본으로 한다.
- **응답 포맷**: 그룹/API별로 JSON, XML, 또는 파일(ZIP·XBRL) 중 하나. 대부분의 데이터 조회 API는 JSON과 XML을 모두 지원(`list.json` / `list.xml`처럼 확장자만 다름).
- **API 그룹(6종)**:
  - **DS001 공시정보** — 공시검색, 기업개황, 공시서류원본파일, 고유번호
  - **DS002 사업보고서 주요정보(정기보고서 주요정보)** — 증자/배당/최대주주/임원·직원/보수현황 등 30종
  - **DS003 상장기업 재무정보(정기보고서 재무정보)** — 주요계정, 전체 재무제표, XBRL 원본, 주요 재무지표
  - **DS004 지분공시 종합정보** — 대량보유 상황보고, 임원·주요주주 소유보고
  - **DS005 주요사항보고서 주요정보** — 부도발생, 증자/감자, 자기주식, 합병·분할 등 36종
  - **DS006 증권신고서 주요정보** — 지분증권, 채무증권, 증권예탁증권, 합병, 포괄적 교환·이전, 분할

### 공식 문서 소스 (Source of Truth)

| 문서 | 용도 |
|------|------|
| [개발가이드 메인](https://opendart.fss.or.kr/guide/main.do) | 그룹별 API 목록, 각 API 상세(요청/응답 파라미터) |
| [오픈API 소개](https://opendart.fss.or.kr/intro/main.do) | 서비스 개요, 인증키 신청 안내 |
| [이용약관](https://opendart.fss.or.kr/intro/terms.do) | 이용 제한(요청 횟수 허용량 등) 근거 조항 |
| [인증키 신청](https://opendart.fss.or.kr/uss/umt/EgovMberInsertView.do) | crtfc_key 발급 신청 화면 |
| [영문 버전](https://engopendart.fss.or.kr/) | English guide (동일 스펙, 영문 설명) |
| [FAQ 게시판](https://opendart.fss.or.kr/cop/bbs/selectArticleList.do?bbsId=B0000000000000000002) | "오픈API 이용한도는 어떻게 되나요?" 등 운영 정책 Q&A. 일일 한도 공식 근거(4장) |
| 개발가이드 상세 페이지 (`/guide/detail.do?apiGrpCd={그룹}&apiId={ID}`) | 각 API의 정확한 엔드포인트·요청/응답 파라미터 표 — 이 문서의 확인된 스펙 대부분의 1차 출처 |

---

## 2. 인증 (API 인증키 crtfc_key)

- OAuth 같은 토큰 발급 절차 없이, **회원가입 후 발급받는 40자리 고정 인증키(crtfc_key)** 를 모든 요청의 쿼리 파라미터로 붙이는 방식
- 토큰 만료/갱신 개념이 없고, 키 자체가 유효한 동안 계속 사용 가능 (단, 관리자가 개인정보 보유기간 만료 등으로 키를 비활성화할 수 있음 — status `901`)
- 공통 파라미터명: `crtfc_key` (모든 API 공통 필수)

### 발급 절차 (요약 — 상세는 7장 참고)

1. <https://opendart.fss.or.kr> 접속 → 회원가입(이메일 인증)
2. 로그인 후 **오픈API 이용자 등록 > 인증키 신청** 메뉴에서 이용 목적 등 입력 후 신청
3. **마이페이지 > 오픈API 이용현황**에서 발급된 40자리 인증키 확인 및 복사

### 이 프로젝트에서의 관리 방식 (필수 준수)

- **절대 코드에 하드코딩하지 않는다.**
- `.env` 파일에 아래와 같이 저장하고, 서버 런타임에서만 환경변수로 로드한다.

```env
# .env (커밋 금지 — .gitignore에 반드시 포함)
OPENDART_API_KEY=발급받은_40자리_인증키
```

- 백엔드 코드에서는 `os.environ["OPENDART_API_KEY"]` (Python) 또는 해당 스택의 환경변수 로더를 통해서만 참조한다.
- `.env.example`에는 키 이름만 남기고 값은 비워둔다: `OPENDART_API_KEY=`
- 프론트엔드(브라우저)에서 직접 호출 금지 — crtfc_key가 노출되므로, 반드시 백엔드를 경유(프록시)해서 호출한다.

---

## 3. 엔드포인트 전체 목록

모든 엔드포인트는 `https://opendart.fss.or.kr/api/{파일명}` 형태이며, HTTP `GET` 요청, UTF-8 인코딩이다.

### 📄 DS001 — 공시정보 (4개)

| Method | Endpoint | API명 | 응답 포맷 |
|--------|----------|-------|-----------|
| `GET` | `/api/list.json` (`.xml`) | 공시검색 | JSON/XML |
| `GET` | `/api/company.json` (`.xml`) | 기업개황 | JSON/XML |
| `GET` | `/api/document.xml` | 공시서류원본파일 | ZIP 파일 |
| `GET` | `/api/corpCode.xml` | 고유번호 | ZIP 파일(내부 XML) |

#### 3.1 공시검색(`list.json`) — `corp_code` 생략 시 전체 시장 조회 가능 여부 (확인됨)

> 공식 상세 페이지(<https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001>)를 2026-07-05 브라우저로 직접 열람해 요청 인자 표를 전사(轉寫) 확인했다.

**요청 파라미터 전체 (전부 옵션 `N`, `crtfc_key`만 필수):**

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `crtfc_key` | Y | API 인증키(40자리) |
| `corp_code` | **N** | 공시대상회사의 고유번호(8자리). **생략 가능** |
| `bgn_de` | N | 검색시작 접수일자(YYYYMMDD). 기본값은 `end_de`. **"고유번호(corp_code)가 없는 경우 검색기간은 3개월로 제한"** (공식 문구 원문 그대로) |
| `end_de` | N | 검색종료 접수일자(YYYYMMDD). 미지정 시 당일 기준 |
| `last_reprt_at` | N | 최종보고서만 검색 여부(Y/N). 기본값 N(정정보고서 포함 전체) |
| `pblntf_ty` | N | 공시유형 A~J (정기공시/주요사항보고/발행공시/지분공시/기타공시/외부감사관련/펀드공시/자산유동화/거래소공시/공정위공시) |
| `pblntf_detail_ty` | N | 공시상세유형(4자리 코드) |
| `corp_cls` | N | 법인구분: Y(유가), K(코스닥), N(코넥스), E(기타). **"없으면 전체조회, 복수조건 불가"** |
| `sort` | N | 정렬기준: `date`(접수일자, 기본값)/`crp`(회사명)/`rpt`(보고서명) |
| `sort_mth` | N | 정렬방법: `asc`/`desc`(기본값) |
| `page_no` | N | 페이지 번호(기본값 1) |
| `page_count` | N | 페이지당 건수(1~100, 기본값 10, 최대 100) |

**결론 — 이 프로젝트(1일 1회 전 종목 공시 배치 수집)에 그대로 적용 가능:**

- `corp_code`를 생략하면 **전 시장(코스피+코스닥+코넥스+기타) 공시를 날짜 기준으로 일괄 조회**할 수 있다. 다만 이 경우 `bgn_de`~`end_de` 검색 기간이 **3개월로 제한**된다.
- 이 프로젝트는 "1일 1회, 그날의 신규 공시"만 수집하면 되므로 `bgn_de=end_de=오늘 날짜`로 호출하면 3개월 제한에 전혀 걸리지 않는다. 즉 **매일 자정 이후 1회, `corp_code` 없이 `bgn_de`/`end_de`를 당일 날짜로 고정**해 호출하면 전 종목 공시를 회사별로 반복 호출할 필요 없이 한 번에(페이지네이션만 처리하면) 수집할 수 있다.
- `corp_cls`도 생략하면 전체 법인구분을 대상으로 조회되므로(복수 지정은 불가), 상장 전체(코스피/코스닥/코넥스)를 한 번에 받으려면 `corp_cls`도 생략하고 응답의 `corp_cls`/`stock_code` 필드로 사후 필터링하는 편이 호출 횟수 절약에 유리하다.
- 응답 `list[]`에는 `corp_cls`, `corp_name`, `corp_code`, `stock_code`, `report_nm`, `rcept_no`, `flr_nm`, `rcept_dt`, `rm`(비고 — 유/코/채/넥/공/연/정/철 조합) 필드가 내려오며, `stock_code`가 비어있으면 비상장 법인이므로 이 프로젝트에서는 필터링 대상이다.
- 목록성 API이므로 `total_count`/`total_page`(응답 `result` 그룹)로 페이지네이션 완료 여부를 판단해야 한다(하루 전체 공시 건수가 100건을 넘으면 `page_no`를 늘려 반복 호출).

### 📊 DS002 — 사업보고서 주요정보(정기보고서 주요정보) (30개)

> 파라미터는 공통적으로 `crtfc_key`, `corp_code`, `bsns_year`(4자리, 2015년~), `reprt_code`(11011/11012/11013/11014)를 사용한다. 개별 엔드포인트 파일명은 공식 가이드의 API별 상세 페이지에서 최종 확인 필요(그룹 목록 페이지에는 한글명만 노출되고 파일명은 상세 페이지 진입 시 표시됨).

| API명 | 그룹 | 비고 |
|-------|------|------|
| 증자(감자) 현황 | DS002 | |
| 배당에 관한 사항 (`alotMatter.json`) | DS002 | 엔드포인트 확인됨 |
| 자기주식 취득 및 처분 현황 | DS002 | |
| 최대주주 현황 | DS002 | |
| 최대주주 변동현황 | DS002 | |
| 소액주주 현황 | DS002 | |
| 임원 현황 | DS002 | |
| 직원 현황 | DS002 | |
| 이사·감사의 개인별 보수 현황 | DS002 | 사업보고서만 공시(5억원 이상) |
| 이사·감사 전체의 보수현황(주주총회 승인금액) | DS002 | |
| 이사·감사 전체의 보수현황(보수지급금액 - 유형별) | DS002 | |
| 개인별 보수지급 금액(5억이상 상위5인) (`indvdlByPay.json`) | DS002 | 엔드포인트 확인됨 |
| 개인별 보수지급 금액(5억이상 상위5인) (Ver 2.0) | DS002 | |
| 타법인 출자현황 | DS002 | |
| 주식의 총수 현황 (`stockTotqySttus.json`) | DS002 | 엔드포인트·응답필드 확인됨 — **시가총액 계산용 상장주식수 수집에 사용**, 상세는 3.2절 참고 |
| 채무증권 발행실적 | DS002 | |
| 기업어음증권 미상환 잔액 | DS002 | |
| 단기사채 미상환 잔액 | DS002 | |
| 회사채 미상환 잔액 | DS002 | |
| 신종자본증권 미상환 잔액 | DS002 | |
| 조건부 자본증권 미상환 잔액 | DS002 | |
| 공모자금의 사용내역 | DS002 | |
| 사모자금의 사용내역 | DS002 | |
| 회계감사인의 명칭 및 감사의견 | DS002 | |
| 감사용역체결현황 | DS002 | |
| 회계감사인과의 비감사용역 계약체결 현황 | DS002 | |
| 사외이사 및 그 변동현황 | DS002 | |
| 미등기임원 보수현황 | DS002 | |
| 이사·감사 전체의 보수현황(보수지급금액 - 이사·감사 전체) | DS002 | |
| 이사·감사의 개인별 보수현황(5억원 이상) (Ver 2.0) | DS002 | |

#### 3.2 주식의 총수 현황(`stockTotqySttus`) — 상장주식수 수집 전체 스펙 (확인됨)

> 공식 상세 페이지(<https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2020002>)를 2026-07-05 브라우저로 직접 열람해 요청/응답 표를 전사 확인했다. 이 프로젝트의 "시가총액 = 종가 × 상장주식수" 계산에 필요한 핵심 API다.

**엔드포인트**

```
GET https://opendart.fss.or.kr/api/stockTotqySttus.json
GET https://opendart.fss.or.kr/api/stockTotqySttus.xml
```

**요청 파라미터 (4개 전부 필수, 다중회사 조회 미지원 — corp_code 1개당 1회 호출)**

| 파라미터 | 필수 | 타입 | 설명 |
|---------|------|------|------|
| `crtfc_key` | Y | STRING(40) | 인증키 |
| `corp_code` | Y | STRING(8) | 고유번호 |
| `bsns_year` | Y | STRING(4) | 사업연도(2015년 이후) |
| `reprt_code` | Y | STRING(5) | 1분기 11013 / 반기 11012 / 3분기 11014 / 사업보고서 11011 |

**응답 `list[]` 필드 전체**

| 필드 | 설명 | 비고 |
|------|------|------|
| `rcept_no` | 접수번호(14자리) | |
| `corp_cls` | 법인구분 | Y/K/N/E |
| `corp_code` | 고유번호 | |
| `corp_name` | 회사명 | |
| `se` | 구분 | **증권의 종류(보통주/우선주 등)별 행 + "합계" 행이 함께 내려온다** |
| `isu_stock_totqy` | Ⅰ. 발행할 주식의 총수(정관상 수권주식수) | |
| `now_to_isu_stock_totqy` | Ⅱ. 현재까지 발행한 주식의 총수 | |
| `now_to_dcrs_stock_totqy` | Ⅲ. 현재까지 감소한 주식의 총수 | |
| `redc` | Ⅲ-1. 감자 | |
| `profit_incnr` | Ⅲ-2. 이익소각 | |
| `rdmstk_repy` | Ⅲ-3. 상환주식의 상환 | |
| `etc` | Ⅲ-4. 기타 | |
| `istc_totqy` | **Ⅳ. 발행주식의 총수 (Ⅱ-Ⅲ)** | **이 프로젝트에서 "상장주식수"로 사용할 필드** |
| `tesstk_co` | Ⅴ. 자기주식수 | |
| `distb_stock_co` | Ⅵ. 유통주식수 (Ⅳ-Ⅴ) | 자기주식 제외분 — 시가총액 계산에는 사용하지 않음 |
| `stlm_dt` | 결산기준일 | YYYY-MM-DD |

**구현 유의사항**

- 시가총액 = 종가 × 상장주식수 계산 시 사용할 필드는 `distb_stock_co`(유통주식수)가 아니라 **`istc_totqy`(발행주식의 총수)** 다. 국내 시장 관례상 "상장주식수"는 자기주식을 포함한 발행주식총수를 의미하며(KRX/시세 제공업체가 시가총액 산출에 사용하는 값과 동일), `distb_stock_co`는 유통물량 기준 지표(유동성 분석용)로 별도 목적의 필드다.
- 응답 `list`는 회사당 **보통주/우선주 등 종류별 행 + "합계" 행**을 함께 반환하므로, 전체 상장주식수가 필요하면 반드시 `se`가 "합계"인 행의 `istc_totqy`를 사용해야 한다(종류별 행을 그대로 합산하면 이중 집계 위험이 있으므로, 실제 호출 후 `se` 값의 정확한 표기 — "합계" 또는 "총계" 등 — 는 실호출로 최종 확인 필요).
- 다중회사 조회를 지원하는 별도 엔드포인트가 없으므로 종목당 1회 호출해야 한다. 약 2,600개 종목 전수 수집 시 이 API 호출만으로도 하루 한도(4장)의 상당 부분을 소비할 수 있으므로, 상장주식수는 매일 전량 재수집하기보다 **분기보고서 제출 주기(연 4회, `reprt_code` 갱신 시점)에 맞춰 변경분만 갱신**하는 방식을 고려할 것.

### 💰 DS003 — 상장기업 재무정보(정기보고서 재무정보) (7개)

| Method | Endpoint | API명 | 응답 포맷 |
|--------|----------|-------|-----------|
| `GET` | `/api/fnlttSinglAcnt.json` (`.xml`) | 단일회사 주요계정 | JSON/XML — 엔드포인트 확인됨 |
| `GET` | `/api/fnlttMultiAcnt.json` (`.xml`) | 다중회사 주요계정 | JSON/XML — 엔드포인트 확인됨 |
| `GET` | `/api/fnlttSinglAcntAll.json` (`.xml`) | 단일회사 전체 재무제표 | JSON/XML — 엔드포인트 확인됨 (`fs_div` 필수, 권장 사용법·3개월/누적 구분은 3.3절 참고) |
| `GET` | `/api/fnlttXbrl.xml` | 재무제표 원본파일(XBRL) | ZIP 파일 — 엔드포인트 확인됨 |
| `GET` | `/api/xbrlTaxonomy.json` (`.xml`) | XBRL택사노미재무제표양식 | JSON/XML — 엔드포인트 확인됨 (`sj_div` 필수, `corp_code` 불필요) |
| `GET` | `/api/fnlttSinglIndx.json` (`.xml`) | 단일회사 주요 재무지표 | JSON/XML — 엔드포인트 확인됨 (`idx_cl_code` 필수) |
| `GET` | `/api/fnlttCmpnyIndx.json` (`.xml`) | 다중회사 주요 재무지표 | JSON/XML — 엔드포인트 확인됨 (`idx_cl_code` 필수, 2023년 3분기 이후 데이터만 제공) |

> **`xbrlTaxonomy`(XBRL택사노미) 전용 필수 파라미터 `sj_div`** — 재무제표 유형 구분 (예: `BS1`=재무상태표, `IS1`=손익계산서, `CF1`=현금흐름표 등). 이 API는 `corp_code` 없이 재무제표 표준 양식 자체를 조회하는 API임에 유의.
>
> **`fnlttSinglIndx`/`fnlttCmpnyIndx`(재무지표) 전용 필수 파라미터 `idx_cl_code`** — `M210000`(수익성지표), `M220000`(안정성지표), `M230000`(성장성지표), `M240000`(활동성지표).
>
> 재무 데이터는 **2015 사업연도 이후**부터 제공된다. `bsns_year`에 2015 미만 값을 넣으면 데이터가 없다(status `013`).

#### 3.3 `fnlttSinglAcntAll`(단일회사 전체 재무제표) — `fs_div`(연결/별도) 권장 사용법 및 분기 손익계산서 3개월치/누적치 구분 (확인됨)

> 공식 상세 페이지(<https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020>)를 2026-07-05 브라우저로 직접 열람해 요청/응답 표를 전사 확인했다.

**엔드포인트 및 요청 파라미터**

```
GET https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json
GET https://opendart.fss.or.kr/api/fnlttSinglAcntAll.xml
```

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `crtfc_key` | Y | 인증키 |
| `corp_code` | Y | 고유번호 |
| `bsns_year` | Y | 사업연도(4자리, 2015년 이후) |
| `reprt_code` | Y | 1분기 11013 / 반기 11012 / 3분기 11014 / 사업보고서 11011 |
| `fs_div` | Y | **`OFS`: 재무제표(개별/별도), `CFS`: 연결재무제표** (공식 문구 원문: "OFS:재무제표, CFS:연결재무제표") |

**`fs_div`(연결/별도) 권장 사용법 — CFS 우선 조회 후 OFS 폴백**

- 모든 상장사가 연결재무제표(CFS)를 제출하는 것은 아니다(자회사가 없는 회사, 일부 금융업종 등은 개별/별도 재무제표만 제출하는 경우가 있음). 이 경우 `fs_div=CFS`로 호출하면 응답이 비어있거나 status `013`(조회된 데이터가 없습니다)이 반환된다.
- 커뮤니티 구현 사례(예: 국내 정량 투자 분석 오픈소스 "R을 이용한 퀀트 투자 포트폴리오 만들기" 6장 금융 데이터 수집 코드)에서 공통적으로 쓰이는 패턴은 **"CFS로 먼저 요청 → 응답이 비어있으면(013) 동일 파라미터에 `fs_div=OFS`로 재요청"** 폴백 방식이다.
- 이 프로젝트(전 상장사 재무제표 배치 수집)에도 동일 패턴을 권장한다:

```python
def fetch_financial_statements(corp_code: str, bsns_year: str, reprt_code: str) -> list[dict]:
    """연결재무제표(CFS)를 우선 조회하고, 없으면 개별재무제표(OFS)로 대체한다."""
    for fs_div in ("CFS", "OFS"):
        response = requests.get(
            "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json",
            params={
                "crtfc_key": OPENDART_API_KEY,
                "corp_code": corp_code,
                "bsns_year": bsns_year,
                "reprt_code": reprt_code,
                "fs_div": fs_div,
            },
            timeout=30,
        )
        data = response.json()
        if data.get("status") == "000":
            return data["list"]
        if data.get("status") != "013":
            raise RuntimeError(f"OpenDART error {data.get('status')}: {data.get('message')}")
        # status == "013" (조회된 데이터가 없습니다) → 다음 fs_div로 재시도
    return []
```

**분기/반기보고서 손익계산서 — 3개월치 vs 누적치 (확인됨, 둘 다 별도 필드로 제공)**

응답 `list[]`의 금액 필드는 다음과 같이 구성되며, **분기(11013)·반기(11012)·3분기(11014) 보고서의 손익계산서(`sj_div=IS`)·포괄손익계산서(`sj_div=CIS`)에 한해 "3개월"과 "누적" 금액이 별도 필드로 함께 내려온다** (재무상태표 `BS`는 특정 시점 스냅샷이라 이 구분이 적용되지 않음, 공식 문구 원문 인용):

| 필드 | 명칭 | 공식 설명(원문) |
|------|------|------------------|
| `sj_div` | 재무제표구분 | `BS`(재무상태표) / `IS`(손익계산서) / `CIS`(포괄손익계산서) / `CF`(현금흐름표) / `SCE`(자본변동표) |
| `account_id` | 계정ID | XBRL 표준계정ID (표준계정코드 미사용 시 "-표준계정코드 미사용-") |
| `account_nm` | 계정명 | 예: 자본총계 |
| `thstrm_nm` | 당기명 | 예: 제 13 기 |
| `thstrm_amount` | 당기금액 | **"분/반기 보고서이면서 (포괄)손익계산서일 경우 [3개월] 금액"** — 즉 해당 분기 단독 실적 |
| `thstrm_add_amount` | **당기누적금액** | 별도 설명 문구 없음 → 연초부터 해당 보고서 시점까지의 **누적** 금액 |
| `frmtrm_nm` | 전기명 | 예: 제 12 기말 |
| `frmtrm_amount` | 전기금액 | 전기(사업연도) 동일 시점 비교 금액 |
| `frmtrm_q_nm` | 전기명(분/반기) | 예: 제 18 기 반기 |
| `frmtrm_q_amount` | 전기금액(분/반기) | **"분/반기 보고서이면서 (포괄)손익계산서일 경우 [3개월] 금액"** — 전년 동기 3개월 비교치 |
| `frmtrm_add_amount` | 전기누적금액 | 전년 동기 누적 비교치 |
| `bfefrmtrm_nm` / `bfefrmtrm_amount` | 전전기명 / 전전기금액 | 사업보고서(11011)에서만 출력 |
| `ord` | 계정과목 정렬순서 | |
| `currency` | 통화 단위 | |

- **결론**: 11013(1분기)·11014(3분기)의 손익계산서/포괄손익계산서를 수집할 때 "해당 분기만의 실적"이 필요하면 `thstrm_amount`를, "연초 누계 실적"이 필요하면 `thstrm_add_amount`를 사용해야 한다. 두 값을 혼동하면 분기 실적이 실제보다 과대(누적치를 분기치로 오인) 또는 과소 집계될 수 있으므로, 배치 수집 스키마 설계 시 두 필드를 모두 저장하거나 명확히 하나를 선택해 컬럼명에 반영할 것(예: `amount_3m` vs `amount_ytd`).
- 반기보고서(11012)도 동일하게 `thstrm_amount`(반기 중 3개월, 즉 2분기 단독) / `thstrm_add_amount`(상반기 누적)로 구분된다.
- 사업보고서(11011)는 4분기 자체 보고서가 없으므로(연간 실적은 사업보고서의 누적치로 산출), 4분기 단독 실적이 필요하면 "사업보고서 누적치 − 3분기보고서 누적치"로 별도 계산해야 한다(OpenDART가 4분기 단독 수치를 직접 제공하지 않음).

### 🧾 DS004 — 지분공시 종합정보 (2개)

| Method | Endpoint | API명 | 응답 포맷 |
|--------|----------|-------|-----------|
| `GET` | `/api/majorstock.json` (`.xml`) | 대량보유 상황보고 | JSON/XML — 엔드포인트 확인됨 |
| `GET` | `/api/elestock.json` (`.xml`) | 임원ㆍ주요주주 소유보고 | JSON/XML — 파일명 확인 필요 |

### 📰 DS005 — 주요사항보고서 주요정보 (36개)

> 공통 파라미터: `crtfc_key`, `corp_code`, `bgn_de`, `end_de` (검색 기간, YYYYMMDD). 개별 파일명은 부도발생(`dfOcr.json`) 외 다수가 "확인 필요" — 공식 가이드 상세 페이지에서 최종 확인.

| API명 | 비고 |
|-------|------|
| 부도발생 (`dfOcr.json`) | 엔드포인트 확인됨 |
| 영업정지 | |
| 회생절차 개시신청 | |
| 해산사유 발생 | |
| 유상증자 결정 | |
| 무상증자 결정 | |
| 유무상증자 결정 | |
| 감자 결정 | |
| 채권은행 등의 관리절차 개시 | |
| 소송 등의 제기 | |
| 해외 증권시장 주권등 상장 결정 | |
| 해외 증권시장 주권등 상장폐지 결정 | |
| 해외 증권시장 주권등 상장 | |
| 해외 증권시장 주권등 상장폐지 | |
| 전환사채권 발행결정 | |
| 신주인수권부사채권 발행결정 | |
| 교환사채권 발행결정 | |
| 채권은행 등의 관리절차 중단 | |
| 상각형 조건부자본증권 발행결정 | |
| 자산양수도(기타), 풋백옵션 | |
| 타법인 주식 및 출자증권 양도결정 | |
| 유형자산 양도 결정 | |
| 유형자산 양수 결정 | |
| 타법인 주식 및 출자증권 양수결정 | |
| 영업양도 결정 | |
| 영업양수 결정 | |
| 자기주식취득 신탁계약 해지 결정 | |
| 자기주식취득 신탁계약 체결 결정 | |
| 자기주식 처분 결정 | |
| 자기주식 취득 결정 | |
| 주식교환·이전 결정 | |
| 회사분할합병 결정 | |
| 회사분할 결정 | |
| 회사합병 결정 | |
| 주권 관련 사채권 양수 결정 | |
| 주권 관련 사채권 양도 결정 | |

### 📑 DS006 — 증권신고서 주요정보 (6개)

| Method | Endpoint | API명 | 응답 포맷 |
|--------|----------|-------|-----------|
| `GET` | `/api/estkRs.json` (`.xml`) | 지분증권 | JSON/XML |
| `GET` | `/api/bdRs.json` (`.xml`) | 채무증권 | JSON/XML |
| `GET` | `/api/stkdpRs.json` (`.xml`) | 증권예탁증권 | JSON/XML — 엔드포인트 확인됨 |
| `GET` | `/api/mgRs.json` (`.xml`) | 합병 | JSON/XML |
| `GET` | `/api/extrRs.json` (`.xml`) | 주식의포괄적교환·이전 | JSON/XML |
| `GET` | `/api/dvRs.json` (`.xml`) | 분할 | JSON/XML |

> DS006 공통 파라미터는 `crtfc_key`, `corp_code`, `bgn_de`, `end_de`이며, `stkdpRs.json`(증권예탁증권)은 공식 상세 페이지에서 직접 확인했다(응답이 일반사항·증권의종류·인수인정보·자금의사용목적·매출인에관한사항 5개 그룹으로 구성됨도 확인). 나머지 5개(`estkRs`/`bdRs`/`mgRs`/`extrRs`/`dvRs`)는 OpenDART의 API명 축약 명명 규칙(예: 지분증권→Equity Stock→`estk`, 채무증권→Bond→`bd`, 합병→Merger→`mg`, 포괄적교환·이전→Exchange/Transfer→`extr`, 분할→Division→`dv`)에 따른 확인이므로, 실제 구현 직전 공식 상세 페이지에서 최종 재확인을 권장한다.
>
> 참고로 사용자 측 초기 요청 목록에 있던 "파생결합증권"은 공식 DS006 그룹 목록에 존재하지 않으며, 대신 "증권예탁증권"이 이 그룹의 6번째 API로 확인되었다.

---

## 4. Rate Limits

> **일일 요청 한도는 20,000건/일로 공식 확인됨** (2026-07-05, 아래 2개 1차 출처 교차 검증).

### 4.1 공식 확인 근거 (1차 출처 2건 교차 검증)

**출처 A — FAQ "오픈API 이용한도는 어떻게 되나요?"** (<https://opendart.fss.or.kr/cop/bbs/selectArticleList.do?bbsId=B0000000000000000002> → 5번 게시글, 브라우저로 직접 열람해 답변 본문 확인, 등록일 2020-01-18/조회수 19,322로 가장 많이 조회된 FAQ 항목):

> "Open DART 홈페이지 오픈API 서비스의 일일한도는 다음과 같습니다.
> 1. 개인 : 일 20,000건 (서비스별 한도가 아닌 오픈API 83종 전체 서비스 기준)
> 2. 기업(사업자등록증 및 IP 등록)
>    1) 공시검색, 기업개황 2종 : 한도 없음
>    2) 공시검색, 기업개황을 제외한 모든서비스 81종 : 일 20,000건(서비스별 한도가 아닌 81종 서비스 전체 기준)
> * 일일한도를 준수하더라도 서비스의 안정적인 운영을 위하여 과도한 네트워크 접속(분당 1,000회 이상)은 서비스 이용이 제한될 수 있으니 이용에 참고하시기 바랍니다."

**출처 B — 개발가이드 각 API 상세 페이지의 status `020` 설명 문구** (예: <https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001>, `apiGrpCd=DS002&apiId=2020002`, `apiGrpCd=DS003&apiId=2019020` 등 여러 API 상세 페이지에서 동일 문구로 반복 확인, 2026-07-05 기준 현재도 게시 중):

> "- 020 : 요청 제한을 초과하였습니다. 일반적으로는 **20,000건 이상**의 요청에 대하여 이 에러 메시지가 발생되나, 요청 제한이 다르게 설정된 경우에는 이에 준하여 발생됩니다."

두 출처 모두 **20,000건/일**로 일치하며, FAQ는 2020년 작성이지만 2026-07-05 현재도 여러 개발가이드 상세 페이지(현재 시점 기준 최신 페이지)에 동일 수치가 노출되고 있어 최신 유효성도 함께 확인했다. (커뮤니티 자료 중 "10,000건/일"을 언급하는 곳도 있었으나, 공식 출처 2건이 모두 20,000건으로 일치하므로 10,000건 쪽은 오기 또는 과거 정책으로 판단해 채택하지 않는다.)

### 4.2 세부 규칙

- **한도 단위**: 서비스(엔드포인트)별 한도가 아니라, 인증키(계정) 전체 API 합산 기준. 개인 계정은 오픈API 83종 전체 합산 20,000건/일.
- **기업 계정 예외**: 사업자등록증 및 서버 IP를 등록한 기업 계정은 `list.json`(공시검색)·`company.json`(기업개황) 2종에 한해 **한도 없음**, 나머지 81종은 동일하게 20,000건/일. 이 프로젝트처럼 전 종목 배치 수집을 하는 경우 기업 계정 등록을 고려할 가치가 있다(단, 한도 없음이 적용되는 건 공시검색/기업개황 2종뿐이며 재무제표·주식총수 등 나머지 API는 여전히 20,000건/일 한도가 적용된다).
- **분당 요청 주의**: 일일 한도를 지키더라도 **분당 1,000회 이상** 과도한 네트워크 접속은 서비스 제한 사유가 될 수 있다(공식 FAQ 원문). 배치 작업에서 호출 간 짧은 지연(sleep)을 두어 순간적으로 폭주하지 않도록 설계할 것.
- **조회 가능 회사 개수 제한**: 다중회사 조회류 API는 한 번에 최대 100개 법인까지 조회 가능 (초과 시 status `021`).
- **페이지네이션**: `list.json`(공시검색) 등 목록성 API는 `page_no`, `page_count`(기본 10, 최대 100) 파라미터로 페이징 처리.
- **초과 시 처리**: status가 `020`이면 응답 자체는 200 OK로 오되 `status` 필드로 판별해야 함(HTTP 429가 아님). 클라이언트는 `status !== "000"`을 실패로 간주하고, `020` 수신 시 재시도하지 말고 다음 날(또는 익일 00시 리셋)까지 대기하거나 요청 큐를 조절해야 한다.
- **권장 사항**: 이 프로젝트(약 2,600개 상장사 × 분기 재무제표 + 상장주식수 + 공시)는 종목당 여러 번 호출해야 하는 API(재무제표, 주식총수 현황 등)의 호출 횟수가 20,000건/일에 근접할 수 있으므로, 다음을 권장한다.
  - 공시 목록 수집은 3.1절처럼 `corp_code` 생략 + 날짜 기준 일괄 조회로 호출 횟수를 최소화(전 종목 개별 호출 대신 1~수십 회 페이지네이션으로 대체)
  - `corp_code.xml`(전체 매핑)처럼 한 번의 호출로 전체 데이터를 받을 수 있는 API를 우선 활용
  - 상장주식수(3.2절)·재무제표(3.3절)처럼 회사당 1회 호출이 불가피한 API는 분기 제출 주기에 맞춰 변경분만 갱신하는 방식으로 호출 총량을 관리
  - 정확한 잔여 한도는 가입 후 "마이페이지 > 오픈API 이용현황"에서 실시간으로 확인 가능(계정별 소진량이 표시됨)

---

## 5. 에러(status) 응답 표

OpenDART의 모든 응답은 HTTP 200과 함께 JSON/XML 바디에 `status`, `message` 필드를 포함한다 (파일 응답은 실패 시에도 안내 메시지가 포함된 XML/텍스트로 대체 반환될 수 있음). **HTTP 상태 코드가 아니라 응답 바디의 `status` 필드로 성공/실패를 판별**해야 한다.

| status | 의미 |
|--------|------|
| `000` | 정상 |
| `010` | 등록되지 않은 키입니다. |
| `011` | 사용할 수 없는 키입니다. (오픈API에 등록되었으나 일시적으로 사용 중지된 키) |
| `012` | 접근할 수 없는 IP입니다. |
| `013` | 조회된 데이터가 없습니다. |
| `014` | 파일이 존재하지 않습니다. |
| `020` | 요청 제한을 초과하였습니다. (일일 요청 한도 초과 — **20,000건/일**, 4장 참고) |
| `021` | 조회 가능한 회사 개수가 초과하였습니다. (다중회사 조회 API, 최대 100건) |
| `100` | 필드의 부적절한 값입니다. |
| `101` | 부적절한 접근입니다. |
| `800` | 시스템 점검 중입니다. |
| `900` | 정의되지 않은 오류가 발생하였습니다. |
| `901` | 사용자 계정의 개인정보 보유기간이 만료되어 사용할 수 없는 키입니다. |

> 위 표는 OpenDART 공식 개발가이드 API 상세 페이지(기업개황 등)에 명시된 값을 기준으로 정리했으며, 여러 API 상세 페이지에서 반복 확인되어 신뢰도가 높다. 다만 문구는 API마다 미세하게 다를 수 있어(예: "조회된 데이타가 없습니다" 등 표기 차이) 정확한 문구는 각 호출 응답의 `message` 필드로 확인할 것.

---

## 6. 공통 파라미터 표

| 파라미터 | 설명 | 타입 | 사용 API |
|---------|------|------|----------|
| `crtfc_key` | API 인증키 (40자리) | STRING(40) | 전체 API 공통 필수 |
| `corp_code` | 공시대상회사 고유번호 (8자리, `corpCode.xml`로 사전 확보) | STRING(8) | 기업개황, 재무정보, 사업보고서 주요정보 등 대부분 |
| `bsns_year` | 사업연도 (4자리, 2015년 이후 데이터만 제공) | STRING(4) | DS002/DS003 계열 |
| `reprt_code` | 보고서 코드 (아래 표 참고) | STRING(5) | DS002/DS003 계열 |
| `bgn_de` / `end_de` | 검색 시작일/종료일 (YYYYMMDD) | STRING(8) | 공시검색(list), DS005/DS006 계열 |
| `rcept_no` | 접수번호 (14자리, 공시서류 원본 조회 시 사용) | STRING(14) | 공시서류원본파일(document.xml) |
| `pblntf_ty` | 공시유형 (A~J) | STRING(1) | 공시검색(list) |
| `page_no` / `page_count` | 페이지 번호 / 페이지당 건수(최대 100) | NUMBER | 목록성 API(list 등) |

### reprt_code(보고서 코드) 값

| 코드 | 보고서 종류 |
|------|-------------|
| `11011` | 사업보고서 |
| `11012` | 반기보고서 |
| `11013` | 1분기보고서 |
| `11014` | 3분기보고서 |

> 위 4개 값은 OpenDART 공식 개발가이드(단일회사 주요계정, 배당사항 등 다수의 API 상세 페이지)와 `dart-fss` 공식 문서, 커뮤니티 라이브러리(`OpenDartReader`) 양쪽에서 동일하게 확인되어 신뢰도가 높다.

---

## 7. corp_code(고유번호) 획득 가이드 — Step by Step

DART의 거의 모든 API는 증권시장의 6자리 종목코드(예: 삼성전자 `005930`)가 아니라 **DART 자체의 8자리 고유번호(corp_code)** 를 요구한다. 종목코드 ↔ corp_code 매핑 API가 별도로 없으므로, 아래 절차로 **전체 매핑 파일을 최초 1회(또는 주기적으로) 내려받아 로컬 DB/캐시에 저장**해두고 사용해야 한다.

### Step 1. 고유번호 ZIP 다운로드

```
GET https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key={OPENDART_API_KEY}
```

- 응답: ZIP 압축 파일(바이너리), 내부에 `CORPCODE.xml` 1개 포함
- 이 ZIP 하나에 DART에 등록된 전체 법인(상장+비상장 포함 다수)의 매핑 정보가 들어있다 — 법인별로 개별 호출할 필요 없음

### Step 2. 압축 해제

- ZIP을 메모리 또는 임시 디렉터리에 풀어 `CORPCODE.xml` 파일을 얻는다.

### Step 3. XML 파싱

- `CORPCODE.xml`은 `<result><list>...</list><list>...</list></result>` 구조이며, 각 `<list>`는 다음 필드를 가진다.

| 필드 | 설명 |
|------|------|
| `corp_code` | 고유번호 (8자리) |
| `corp_name` | 정식 회사명 |
| `corp_eng_name` | 영문 회사명 |
| `stock_code` | 상장 종목코드 (6자리, 비상장은 공란) |
| `modify_date` | 최종 변경일자 (YYYYMMDD) |

### Step 4. 로컬 저장 및 매핑 테이블 구성

- 파싱한 결과를 DB 테이블(예: `dart_corp_code(corp_code, corp_name, stock_code, modify_date)`)에 upsert
- 이후 서비스 로직에서는 `stock_code`(종목코드) → `corp_code`(고유번호)로 조회 후 각 상세 API를 호출
- `modify_date` 변경 감지를 위해 **주기적으로(예: 1일 1회) 재다운로드하여 갱신**하는 배치 작업을 두는 것을 권장

### Step 5. (선택) 종목코드가 없는 비상장 법인 처리

- `stock_code`가 빈 문자열인 레코드는 비상장 법인이며, 이 프로젝트에서 상장 종목만 다룬다면 `stock_code`가 존재하는 레코드만 필터링해서 사용

---

## 8. 호출 예시

### cURL 예시

```bash
# 1) 공시검색 — 삼성전자(corp_code 00126380) 2026년 상반기 공시 목록 조회
curl -s 'https://opendart.fss.or.kr/api/list.json' \
  --data-urlencode "crtfc_key=${OPENDART_API_KEY}" \
  --data-urlencode "corp_code=00126380" \
  --data-urlencode "bgn_de=20260101" \
  --data-urlencode "end_de=20260705" \
  -G

# 2) 고유번호(corp_code) 전체 매핑 ZIP 다운로드
curl -s -o corpCode.zip \
  "https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${OPENDART_API_KEY}"

# 3) 단일회사 주요계정 — 삼성전자 2025 사업연도 사업보고서 재무 주요계정 조회
curl -s 'https://opendart.fss.or.kr/api/fnlttSinglAcnt.json' \
  --data-urlencode "crtfc_key=${OPENDART_API_KEY}" \
  --data-urlencode "corp_code=00126380" \
  --data-urlencode "bsns_year=2025" \
  --data-urlencode "reprt_code=11011" \
  -G
```

### Python 예시 — corp_code ZIP 다운로드 + 압축 해제 + XML 파싱

```python
import os
import zipfile
import io
import xml.etree.ElementTree as ET
import requests

OPENDART_API_KEY = os.environ["OPENDART_API_KEY"]  # 하드코딩 금지 — 반드시 환경변수에서 로드


def fetch_corp_code_map() -> list[dict]:
    """OpenDART 고유번호(corpCode.xml)를 내려받아 corp_code 매핑 리스트를 반환한다."""
    url = "https://opendart.fss.or.kr/api/corpCode.xml"
    response = requests.get(url, params={"crtfc_key": OPENDART_API_KEY}, timeout=30)
    response.raise_for_status()

    # 1) ZIP 압축 해제 (메모리 상에서 처리)
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        xml_bytes = archive.read("CORPCODE.xml")

    # 2) XML 파싱
    root = ET.fromstring(xml_bytes)
    corp_list = []
    for item in root.iter("list"):
        corp_list.append(
            {
                "corp_code": item.findtext("corp_code"),
                "corp_name": item.findtext("corp_name"),
                "stock_code": (item.findtext("stock_code") or "").strip(),
                "modify_date": item.findtext("modify_date"),
            }
        )
    return corp_list


if __name__ == "__main__":
    corp_codes = fetch_corp_code_map()
    listed_only = [c for c in corp_codes if c["stock_code"]]
    print(f"전체 {len(corp_codes)}건 중 상장 종목 {len(listed_only)}건")
```

---

## 9. 핵심 유의사항 요약

- **연동 수단은 API 하나**: 공식 SDK/Webhook 없음. 인증은 OAuth가 아니라 고정 40자리 `crtfc_key` 쿼리 파라미터 방식.
- **인증키 관리**: `.env`의 `OPENDART_API_KEY`로만 관리하고 코드 하드코딩 금지. 브라우저에서 직접 호출 금지(백엔드 프록시 필수).
- **corp_code 우선 확보**: 대부분의 API가 종목코드가 아닌 8자리 corp_code를 요구하므로, `corpCode.xml`로 전체 매핑을 먼저 받아 로컬에 캐시한 뒤 사용해야 한다.
- **성공/실패 판별은 HTTP 코드가 아니라 응답 바디의 `status` 필드**로 한다 (`000`이 정상, 나머지는 실패).
- **일일 요청 한도 주의**: 공식 FAQ와 개발가이드 상태코드 설명이 일치하는 **20,000건/일**(계정·인증키 전체 API 합산 기준)이 병목이 될 수 있다. 배치성 대량 수집 로직은 호출 횟수를 최소화하도록 설계(예: 전체 매핑 API 우선 활용, `corp_code` 생략 후 날짜 기준 일괄 조회, 필요한 회사/기간만 조회)하고, 정확한 잔여량은 가입 후 마이페이지에서 직접 확인할 것. 분당 1,000회 이상의 과도한 접속도 별도로 서비스 제한 사유가 될 수 있음에 유의.
- **다중회사 조회 제한**: 한 번에 최대 100개 법인(초과 시 status `021`).
- **reprt_code 필수 조합**: DS002/DS003 계열 API는 `bsns_year` + `reprt_code`(11011/11012/11013/11014) 조합이 사실상 필수다.
- **공시검색(list.json) 전 시장 일괄 조회 가능**: `corp_code`는 옵션이며 생략하면 날짜(`bgn_de`~`end_de`) 기준 전 시장 공시를 한 번에 조회할 수 있다. 단 `corp_code` 없이는 검색 기간이 3개월로 제한되므로, 1일 1회 배치라면 `bgn_de=end_de=당일`로 호출하면 된다(3.1절).
- **상장주식수는 `istc_totqy` 필드 사용**: `stockTotqySttus`(주식의 총수 현황) 응답에서 시가총액 계산에 쓸 필드는 `distb_stock_co`(유통주식수)가 아니라 `se="합계"` 행의 `istc_totqy`(발행주식의 총수)다(3.2절).
- **분기 손익계산서는 3개월치/누적치가 별도 필드**: `fnlttSinglAcntAll` 등에서 `thstrm_amount`는 분/반기보고서의 (포괄)손익계산서일 경우 3개월(해당 분기 단독) 금액이고, `thstrm_add_amount`는 연초 누적 금액이다. 용도에 맞는 필드를 명확히 선택해야 한다(3.3절).
- **fs_div는 CFS 우선, 없으면 OFS로 폴백**: 연결재무제표(CFS)가 없는 회사는 status `013`이 반환되므로, 개별재무제표(OFS)로 재요청하는 폴백 로직을 둔다(3.3절).
- **파일 응답 API 존재**: 공시서류원본파일, 고유번호, XBRL 원본은 JSON이 아닌 ZIP 바이너리로 응답하므로 별도 처리 로직 필요.
- **엔드포인트 파일명 미확정 항목**: DS002/DS005/DS006 개별 API 중 일부는 정확한 파일명이 이 문서에서 "확인 필요"로 표기되어 있음 — 실제 구현 시 해당 API의 공식 상세 페이지(`opendart.fss.or.kr/guide/detail.do?apiGrpCd=...&apiId=...`)에서 재확인 후 사용할 것.
