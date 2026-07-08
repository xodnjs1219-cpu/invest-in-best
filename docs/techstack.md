# techstack.md — invest-in-best 기술스택 (Source of Truth)

> 이 문서는 프로젝트의 기술스택 SOT다. `docs/techstack.md`가 존재하면 `CLAUDE.md`의 Stack Profile A/B보다 **이 문서가 우선**한다.
> AI 코딩 에이전트는 구현 시 이 문서에 명시된 스택·버전·디렉토리 구조·명령어를 **그대로** 따른다. 여기 없는 세부 결정은 아래 "설계 원칙"(계층 분리, 외부연동 어댑터 격리, 최소 인프라)에 따라 유추한다.
> **미확정 항목은 문서 끝 "Open Questions"에 있으며, 메인 루프 사용자 승인 전까지 확정이 아니다.**

## 설계 원칙 (모든 결정의 기준)

1. AI가 익숙하고 인기 있는 기술을 쓴다 (풍부한 학습 데이터 → 정확한 코드 생성).
2. 신뢰할 수 있는 기업이 활발히 유지보수하는 기술만 쓴다.
3. 하위호환이 잘 보장되는, breaking change가 잦지 않은 버전을 쓴다.
4. **가장 쉬운 인프라를 지향한다.** 오버엔지니어링 금지 — 지금 필요한 것만 만든다.
5. Presentation ↔ Business Logic ↔ Persistence ↔ 외부연동을 계층으로 분리하고, 모듈은 하나의 책임만 갖는다 (`CLAUDE.md` Must 규칙).

---

## 1. 확정 스택

| 레이어 | 기술 | 버전 | 선정 근거 |
|---|---|---|---|
| 런타임 | Node.js | **24 LTS** (Krypton, `>=24.0.0`) | 현재 활성 LTS, 웹/워커/공유 패키지 전체 단일 런타임 |
| 언어 | TypeScript | **6.0.3** | 웹 프론트/백엔드/배치 워커 전체를 하나의 언어로 통일 → 도메인 로직(지표 계산 등) 중복 구현 제거 |
| 웹 프레임워크 | Next.js (App Router) | **16.2.10** | Vercel이 제작·유지보수, SSR로 공식 밸류체인 페이지 SEO 확보, 배포가 git push 수준으로 단순 |
| UI 라이브러리 | React | **19.2.7** | Next.js 기반 요구, 최대 생태계·최다 AI 학습 데이터 |
| 웹 API 레이어 | Hono | **4.12.27** | Next.js catch-all Route Handler에 마운트하는 경량 라우터. 본 저장소에 이미 `hono-backend-guide.md` 컨벤션이 마련되어 있어 재사용(§4 참고) |
| 스타일 | Tailwind CSS | **4.3.2** | 표준 유틸리티 CSS, `CLAUDE.md` 지정 |
| UI 컴포넌트 | shadcn-ui (CLI) | **4.13.0** | 코드 소유권 유지형 컴포넌트, `CLAUDE.md` 지정 |
| 마인드맵 캔버스 | `@xyflow/react` (React Flow) | **12.11.1** | 노드-엣지 그래프 + 그룹(Sub Flow)을 네이티브 지원하는 React 선언형 표준 라이브러리. 체인당 노드 100개 규모에 적합 |
| 주가 캔들차트 | `lightweight-charts` | **5.2.0** | TradingView 제작·유지보수. 일봉 캔들스틱 전용 표준, 성능 최적화 내장 |
| 대시보드 차트 | `recharts` | **3.9.2** | 분기 재무 막대그래프 등 범용 카테고리형 차트. 캔들스틱 외 모든 차트는 이것으로 통일 |
| 서버 상태 캐싱 | `@tanstack/react-query` | **5.101.2** | 검색·대시보드·편집 캔버스의 서버 데이터 캐싱/재검증 표준 |
| 폼 검증 | `react-hook-form` + `zod` | **7.81.0** / **4.4.3** | 회원가입·편집 폼 검증 표준 조합 |
| DB + Auth | **Supabase** (Postgres 16 + Auth) | `@supabase/supabase-js` **2.110.0**, `@supabase/ssr` **0.12.0** | 이미 프로비저닝됨(project_ref=`plvsbserqcdwaowblzhd`, MCP 연동 완료). 이메일 인증·Google OAuth 내장이라 별도 인증 스택 불필요 |
| 날짜/시간대 | `date-fns` + `date-fns-tz` | **4.4.0** / **3.2.0** | KRX/US 장 운영시간·서머타임(DST) 계산에 필수 |
| 배치 스케줄러 | `node-cron` | **4.5.0** | 상시 실행 워커 프로세스 내 cron 등록. 서버리스 실행시간 제한 없음 |
| ZIP 스트리밍 | `yauzl` | **3.4.0** | SEC EDGAR 벌크 ZIP(1GB+)에서 필요한 CIK 엔트리만 스트리밍 추출 |
| XML 파싱 | `fast-xml-parser` | **5.9.3** | OpenDART `corpCode.xml`(전체 매핑) 파싱. zero-dep, 활발히 유지보수되는 고채택 라이브러리(UC-027 구현 시 추가) |
| LLM (공시 분석) | **미정 (어댑터로 추상화)** — 후보: Anthropic Claude / OpenAI | `@anthropic-ai/sdk` **0.110.0** / `openai` **6.45.0** | 사용자 결정: LLM 기능 구현 직전에 확정. 워커의 LLM 호출은 어댑터 인터페이스 뒤에 격리하고, SDK 설치도 확정 후에 진행 |
| 단위/통합 테스트 | Vitest | **4.1.9** | ESM/TS 네이티브, 빠른 실행 |
| E2E 테스트 | `@playwright/test` | **1.61.1** | Microsoft 유지보수, 크로스브라우저 표준 |
| 린트 | ESLint | **10.6.0** | `next lint` 통합, 최대 채택률 |
| 포맷 | Prettier | **3.9.4** | 표준 포맷터 |
| 패키지 매니저 | **npm** (workspaces) | - | `CLAUDE.md` 지정 (JS/TS 스택은 npm 사용) |
| 배포 — 웹 | Vercel | - | Next.js 제작사, 최소 설정 배포 |
| 배포 — 배치 워커 | **미정 (MVP는 로컬 실행)** | - | 사용자 결정: 개발·MVP 동안 로컬에서 `npm run dev:worker`로 실행하고, 상시 호스팅(Railway 등)은 출시 시점에 결정. Supabase Edge Functions는 무거운 잡(SEC 벌크 1.29GiB, 전 종목 백필)의 실행시간·메모리 제한으로 기각(§2) |

버전 확인: 2026-07-05 npm registry 기준 각 패키지 `latest` dist-tag 실측(context7 MCP 교차 확인). 구현 시점에 재확인 후 `^` 범위로 고정할 것.

---

## 2. 기각된 대안

| 후보 | 기각 사유 |
|---|---|
| Django REST Framework + React (`CLAUDE.md` Profile A) | 배치가 핵심 워크로드인 프로젝트에서 Python을 쓰면 지표 계산·스냅샷 복원·태그 폴백 로직을 웹과 워커 양쪽에 **두 언어로 중복 구현**해야 함. TS 단일 언어 + 공유 패키지가 유지비 낮음 |
| Vercel Cron/서버리스 함수만으로 전체 배치 처리 (워커 없이) | 서버리스 실행시간 제한(수분~15분)으로 "최초 전 종목 백필" 같은 장시간 잡은 체크포인트+재호출 체이닝이 필요해 오히려 더 복잡해짐. 상시 워커 1개가 더 단순 |
| Supabase Edge Functions + pg_cron으로 배치 스케줄링 | Deno 실행시간 제한(무료 150s/유료 400s)이 시간별 폴링·대량 백필에 부적합 |
| Drizzle ORM / Prisma | 마이그레이션은 이미 손으로 쓴 SQL(Supabase MCP로 적용)이 SOT. ORM 스키마를 또 관리하면 스키마 드리프트 위험만 늘어남. Supabase JS 클라이언트 + SQL 뷰/함수(RPC)로 충분 |
| `postgres`(postgres.js) 직접 연결 | 위와 같은 이유 + Supabase 클라이언트 하나로 웹/워커 데이터 접근을 통일하는 편이 더 단순 |
| Cytoscape.js / 순수 D3.js (마인드맵) | React 선언형 패턴과 결이 달라 그룹·편집 상호작용을 전부 직접 구현해야 함. React Flow는 그룹(Sub Flow)을 기본 제공 |
| Redux / Zustand | 이 규모에서 서버 상태는 TanStack Query, 캔버스/폼 로컬 상태는 Context+`useReducer`(`spec_to_plan` 컨벤션)로 충분. 별도 전역 상태 라이브러리는 불필요한 추상화 |
| `bottleneck` 등 범용 레이트리밋 라이브러리 | 토스 API는 응답 헤더(`X-RateLimit-*`) 기반 동적 조절이 필요해 범용 라이브러리를 써도 결국 커스텀 로직 필요. 60줄 내외 자체 토큰버킷으로 대체(§8) |
| NextAuth(Auth.js) | Supabase 프로젝트가 이미 있고 이메일 인증·Google OAuth를 기본 제공 → 별도 인증 스택은 중복 인프라 |
| Turborepo | 패키지 3~4개 규모 MVP에서 빌드 캐싱 이득이 미미. 빌드 시간이 실제 병목이 되면 재검토 |
| 네이버/카카오 소셜 로그인 실제 구현 | PRD Non-Goal. 인터페이스만 확장 가능하게 열어둔다(§10) |

---

## 3. 라이브러리 목록 (기능별)

**웹 — 프레젠테이션**: `react`, `next`, `tailwindcss`, `shadcn-ui`(CLI로 개별 추가), `@xyflow/react`, `lightweight-charts`, `recharts`, `@tanstack/react-query`, `react-hook-form`, `zod`

**웹 — 백엔드(Hono)**: `hono`, `zod`(요청/응답 스키마), `@supabase/supabase-js`, `@supabase/ssr`

**공유 (`packages/domain`)**: `zod`, `date-fns`, `date-fns-tz` — 순수 계산 함수·상수·공유 타입만 포함, 프레임워크 의존성 없음

**배치 워커**: `@supabase/supabase-js`, `node-cron`, `yauzl`, `date-fns`, `date-fns-tz`, `zod`(외부 API 응답 검증), `@anthropic-ai/sdk` 또는 `openai`(§10 확정 후 하나만)

**테스트/도구**: `vitest`, `@playwright/test`, `eslint` + `eslint-config-next`, `prettier`, `typescript`, `tsx`(워커 dev 실행기)

---

## 4. Codebase Structure

모노레포(npm workspaces): `apps/web`(Next.js+Hono), `apps/worker`(배치), `packages/domain`(순수 로직 공유).

웹 앱의 기능 모듈(`features/*/backend`)은 본 저장소의 `.claude/skills/spec_to_plan/references/hono-backend-guide.md` 컨벤션(`schema.ts`/`service.ts`/`route.ts`/`error.ts` + Hono 싱글턴 앱 + `HandlerResult` 패턴)을 그대로 따르되, `CLAUDE.md`의 전역 Must 규칙(비즈니스 로직-퍼시스턴스 분리)을 만족시키기 위해 **`repository.ts`를 추가**한다. `service.ts`는 `repository.ts`가 노출하는 인터페이스에만 의존하고 Supabase 쿼리 문법을 직접 알지 못한다.

```
invest-in-best/
├── apps/
│   ├── web/                                     # Next.js 16 + Hono
│   │   ├── src/
│   │   │   ├── app/                             # ── Presentation: 라우팅/레이아웃만
│   │   │   │   ├── (public)/                    #   비로그인 허용 (메인/뷰/기업상세/약관)
│   │   │   │   ├── (protected)/                 #   로그인 필수 (생성/편집/계정)
│   │   │   │   ├── admin/                        #   role=admin
│   │   │   │   ├── auth/                         #   로그인/가입/재설정
│   │   │   │   └── api/[[...hono]]/route.ts      #   Hono 진입점 (단일 Route Handler)
│   │   │   ├── backend/
│   │   │   │   ├── hono/app.ts                   # Hono 싱글턴 앱, 미들웨어 체인, 라우터 등록
│   │   │   │   ├── http/response.ts              # success()/failure()/respond() 헬퍼
│   │   │   │   └── middleware/                   # errorBoundary, withAppContext, withSupabase(role 검증 포함)
│   │   │   ├── features/                         # 기능별 수직 슬라이스 (1 폴더 = 1 책임)
│   │   │   │   └── <feature>/                    # 예: valuechains, companies, admin-llm-proposals ...
│   │   │   │       ├── backend/
│   │   │   │       │   ├── schema.ts             # Zod: Request/Row/Response 분리 정의
│   │   │   │       │   ├── repository.ts         # ★ Supabase 접근 캡슐화 (Persistence)
│   │   │   │       │   ├── service.ts            # ★ 순수 비즈니스 로직 (repository 인터페이스에만 의존)
│   │   │   │       │   ├── error.ts              # 기능별 에러 코드
│   │   │   │       │   └── route.ts              # HTTP 파싱/검증만 (Presentation의 서버측 계약)
│   │   │   │       ├── components/               # Presenter 컴포넌트 (로직 없음)
│   │   │   │       └── hooks/                    # useXxx — TanStack Query 등, 로직-표시 분리 지점
│   │   │   ├── components/ui/                    # shadcn-ui 프리미티브
│   │   │   ├── components/mindmap/                # React Flow 캔버스(뷰/편집 공용 프레젠테이션)
│   │   │   ├── components/charts/                 # lightweight-charts/recharts 래퍼
│   │   │   └── lib/                               # supabase 클라이언트 팩토리, fetch 유틸(인프라성 코드)
│   │   └── package.json
│   │
│   └── worker/                                    # 배치/스케줄러 — 상시 실행 Node 프로세스 (Railway 배포)
│       ├── src/
│       │   ├── scheduler.ts                       # 진입점: node-cron 등록 (Caller/오케스트레이터)
│       │   ├── jobs/                               # 배치 Job = 파일 1개당 책임 1개
│       │   │   ├── collect-quotes.job.ts           #   시세 1시간 1회(개장 중)
│       │   │   ├── collect-financials.job.ts       #   재무/공시/기업정보 1일 1회
│       │   │   ├── collect-fx-market-hours.job.ts  #   환율/장운영시간 1일 1회
│       │   │   ├── aggregate-daily-metrics.job.ts  #   일별 체인 지표 사전 집계
│       │   │   ├── analyze-disclosures.job.ts      #   LLM 공시 분석 → 변경안 생성
│       │   │   └── backfill-all.job.ts             #   최초 전 종목 백필 (수동 1회 트리거, 체크포인트 재개형)
│       │   ├── adapters/                           # 외부연동 = Contract(인터페이스) + Client(구현) 분리
│       │   │   ├── opendart/{contract.ts,client.ts}
│       │   │   ├── sec-edgar/{contract.ts,client.ts}
│       │   │   ├── tossinvest/{contract.ts,client.ts}
│       │   │   └── llm/{contract.ts,client.ts}     #   공급자 교체 가능하도록 인터페이스 뒤에 격리
│       │   ├── repositories/                       # web과 동일 원칙: Supabase 접근 캡슐화
│       │   └── runtime/
│       │       ├── rate-limiter.ts                 #   API별 토큰버킷 (응답 헤더 기반 동적 조절)
│       │       ├── retry.ts                        #   지수 백오프 재시도(3회, userflow 상수)
│       │       └── batch-log.ts                    #   batch_runs 테이블 기록 (023 배치 모니터링 조회용)
│       └── package.json
│
├── packages/
│   └── domain/                                     # ── 순수 비즈니스 로직 (프레임워크·DB 독립, web+worker 공유)
│       ├── calculations/                           #   시가총액·매출합계·Q4파생·커버리지 계산 (순수 함수)
│       ├── constants/                               #   MAX_NODES_PER_CHAIN=100, MAX_CHAINS_PER_USER=50 등
│       └── types/                                   #   도메인 엔티티 타입, Supabase 생성 타입 재노출
│
├── supabase/
│   └── migrations/                                  # 원본 SQL 마이그레이션(SOT) — Supabase MCP로 적용
│
├── package.json                                     # npm workspaces 루트
└── tsconfig.base.json
```

**계층 분리 매핑** (`CLAUDE.md` Must 규칙 → 디렉토리):

| Must 규칙 | 적용 위치 |
|---|---|
| Presentation ↔ Business Logic 분리 | `app/`, `components/`(프레젠테이션만) ↔ `features/*/backend/service.ts`(로직) |
| Business Logic ↔ Persistence 분리 | `service.ts`(순수 로직, repository 인터페이스에만 의존) ↔ `repository.ts`(Supabase 쿼리) |
| Internal Logic ↔ 외부연동 Contract/Caller 분리 | `adapters/<provider>/contract.ts`(계약) ↔ `client.ts`(구현) ↔ `jobs/*.job.ts`(호출자) |
| 1 모듈 = 1 책임 | `features/<feature>/`, `jobs/<job>.job.ts`, `adapters/<provider>/` 각각 단일 책임 단위 |

---

## 5. 패키지 매니저 & 워크스페이스

```json
// package.json (루트)
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=24.0.0" }
}
```

패키지 매니저는 **npm**만 사용한다(yarn/pnpm 금지, `CLAUDE.md` 지정). 워크스페이스 참조는 `"@iib/domain": "*"` 형태로 `apps/*/package.json`에 선언한다.

---

## 6. 빌드/린트/테스트/개발 명령어

루트 `package.json` scripts (env_setupper·implementer가 그대로 사용):

```json
{
  "scripts": {
    "dev:web": "npm run dev -w apps/web",
    "dev:worker": "npm run dev -w apps/worker",
    "build": "npm run build --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "test:e2e": "npm run test:e2e -w apps/web",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

실행:

```bash
npm install                    # 전체 워크스페이스 설치
npm run dev:web                 # http://localhost:3000
npm run dev:worker               # 워커 로컬 실행 (tsx watch)
npm run build                    # 전체 빌드
npm run lint                     # 전체 린트 (next lint + eslint)
npm run typecheck                # 전체 tsc --noEmit
npm run test                     # 전체 단위/통합 테스트 (vitest run)
npm run test:e2e                  # e2e (playwright test)
npm run format                    # prettier --write
npm run format:check              # CI용 포맷 검사
npm run backfill -w apps/worker    # 최초 전 종목 백필 수동 1회 실행
```

`apps/web/package.json`: `dev`=`next dev`, `build`=`next build`, `start`=`next start`, `lint`=`next lint`, `typecheck`=`tsc --noEmit`, `test`=`vitest run`, `test:e2e`=`playwright test`.
`apps/worker/package.json`: `dev`=`tsx watch src/scheduler.ts`, `build`=`tsc -p tsconfig.json`, `start`=`node dist/scheduler.js`, `lint`=`eslint .`, `typecheck`=`tsc --noEmit`, `test`=`vitest run`, `backfill`=`tsx src/jobs/backfill-all.job.ts`.

---

## 7. 데이터베이스 & 마이그레이션

- **DB**: Supabase Postgres (프로비저닝 완료, `project_ref=plvsbserqcdwaowblzhd`). **RLS는 전체 비활성화**(`CLAUDE.md` 지정) — 인가는 Hono 미들웨어(`withAppContext`)에서 서버 측 `role` 검증으로 처리한다.
- **마이그레이션**: `supabase/migrations/NNNN_description.sql` 원본 SQL이 SOT. `CREATE TABLE IF NOT EXISTS`, 멱등성, `updated_at` 트리거 등 저장소 공통 SQL 가이드라인을 따른다. **로컬 Supabase 실행 금지** — `mcp__supabase__apply_migration`(또는 대시보드)으로 적용한다.
- **ORM 없음**: 애플리케이션 데이터 접근은 전부 `@supabase/supabase-js`(서비스 롤 키)로 한다.
  - 단순 CRUD: `client.from(table)...`
  - 복잡한 조인/집계(스냅샷 시점 복원, 체인 지표 롤업, 커버리지 계산): **Postgres 함수/뷰로 정의**하고 `client.rpc(fn, params)`로 호출한다. SQL 로직은 마이그레이션에 포함해 SOT를 유지한다.
- **타입 동기화**: 마이그레이션 적용 후 `mcp__supabase__generate_typescript_types`로 `packages/domain/types/database.ts`를 재생성한다. 각 기능의 `schema.ts`(Zod)는 이 생성 타입을 참고해 수동 정의한다(런타임 검증 목적, 자동 생성 아님).
- **대량 백필**: `supabase-js` 배열 insert를 1,000~5,000행 단위 청크로 반복 호출한다. 극단적 성능이 필요해지면 `repository.ts` 뒤에서 드라이버만 교체 가능(계층 분리 덕분에 서비스 로직 변경 불필요).
- **인증**: Supabase Auth — 이메일+비밀번호(내장 인증 메일), Google OAuth(네이티브 provider). `profiles` 테이블(FK `auth.users(id)`)에 `role`(user/admin) 저장, 가입 시 `ADMIN_SEED_EMAILS` 일치 여부로 자동 승격.

---

## 8. 배치 스케줄링 설계

- **실행 환경**: `apps/worker`를 Railway에 상시 프로세스로 배포(1개 서비스). Vercel Edge/서버리스가 아닌 이유는 §2 참고.
- **스케줄러**: `node-cron`으로 `scheduler.ts`에 모두 등록.

| Job | 주기 | 비고 |
|---|---|---|
| `collect-quotes` | 매시 정각 | 실행 전 당일 장 운영시간 캐시로 개장 여부 확인, 개장 시장만 수집 |
| `collect-financials` | 1일 1회 | OpenDART 다중회사 조회(100사 묶음)·전체 매핑 우선, SEC 벌크 ZIP |
| `collect-fx-market-hours` | 1일 1회 | 환율 + 익일 장 운영시간 캐시 갱신 |
| `aggregate-daily-metrics` | 1일 1회 (수집 후) | 가치총액/매출합계 사전 집계 |
| `analyze-disclosures` | 1일 1회 (수집 후) | 신규 공시 → LLM → 검토 큐 적재 |
| `backfill-all` | 수동 1회 | `npm run backfill`로 트리거. `batch_checkpoints` 테이블에 진행 상태 저장 → 중단 후 재개 가능 |

- **레이트리밋**: `runtime/rate-limiter.ts`에 API별 토큰버킷을 자체 구현(외부 라이브러리 미사용, §2). OpenDART(20,000건/일 + 분당 1,000회 상한), 토스(그룹별 TPS, 응답 헤더 `X-RateLimit-Remaining` 반영), SEC EDGAR(초당 10건, 안전마진 5~8건) 각각 설정값으로 주입.
- **재시도**: `runtime/retry.ts` — 지수 백오프 3회(userflow 상수). SEC의 `companyconcept` 404는 재시도 대상이 아닌 정상 폴백 신호로 처리(다음 태그로 즉시 전환).
- **모니터링**: 모든 Job은 `runtime/batch-log.ts`를 통해 `batch_runs` 테이블에 시작/종료/상태/처리건수/에러를 기록한다. 어드민 배치 모니터링 화면(웹)은 이 테이블을 직접 조회한다(워커-웹 간 RPC 불필요, DB로 완전히 디커플).
- **외부연동 격리**: 각 어댑터는 `contract.ts`(인터페이스)만 `jobs/*.job.ts`에 노출한다. 데이터 소스 교체(예: 토스증권 이용약관 이슈로 대체 소스 전환, §10)가 필요해도 잡 로직은 변경되지 않는다.

---

## 9. 환경 변수 목록

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # 서버/워커 전용, 클라이언트 노출 절대 금지
DATABASE_URL=                          # Supabase Postgres 접속 문자열 (직접 SQL 실행이 필요한 스크립트용)

# 인증
ADMIN_SEED_EMAILS=                     # 콤마 구분, 최초 가입 시 role=admin 자동 승격

# 외부 연동 (배치 전용, 프론트엔드 노출 금지)
OPENDART_API_KEY=
SEC_EDGAR_USER_AGENT=                  # "서비스명 연락이메일" 형식
TOSSINVEST_CLIENT_ID=
TOSSINVEST_CLIENT_SECRET=

# LLM (§10 확정 후 하나만 사용)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

NODE_ENV=
```

기존 `.env`의 `toss_api`/`toss_secret`는 `TOSSINVEST_CLIENT_ID`/`TOSSINVEST_CLIENT_SECRET`로, `DB_PASSWORD`는 `DATABASE_URL` 접속 문자열 내부로 흡수 정리한다(env_setupper 단계에서 반영). `.env.example`에는 키 이름만 남기고 값은 비운다.

---

## 10. 확정된 결정 사항 (2026-07-05 게이트)

1. **LLM 공급자**: 미정으로 유보 (사용자 결정). 어댑터 인터페이스로 추상화하고 LLM 기능 구현 직전에 확정한다. 후보: Anthropic Claude / OpenAI. 확정 후 `docs/external/`에 연동 스펙 문서 추가.
2. **토스증권 이용약관**: "토스 전제 유지 + 키 발급 시 약관 원문 수동 확인"으로 결정(Phase 2.5 게이트). 시세 수집은 어댑터 패턴(§4, §8)으로 격리하여 소스 교체가 필요해져도 잡 로직 변경을 최소화한다.
3. **배치 워커 호스팅**: 미정으로 유보 (사용자 결정). MVP는 로컬 실행, 상시 호스팅은 출시 시점에 결정. Supabase Edge Functions는 무거운 잡의 실행시간·메모리 제한으로 기각.
4. **네이버·카카오 소셜 로그인**: MVP Non-Goal. 인터페이스만 열어두고 실제 구현 시점에 재조사 (카카오는 Supabase Auth 커스텀 OIDC로 가능 추정, 네이버 미검증).
5. **모바일**: 반응형 웹만 지원 (요구사항에 네이티브 앱 없음). `packages/domain` 분리로 향후 확장에는 유리.
