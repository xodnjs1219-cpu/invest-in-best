# 구현 검증 보고서 (Implementation Report)

> idea_to_product 파이프라인 Phase 11(검증) 산출물. 작성일: 2026-07-08.

## 1. 요약

**밸류체인 투자 분석 서비스(invest-in-best)의 31개 유스케이스 전체 구현이 완료되었으며, 전체 검증을 통과했다.**

- **구현 유스케이스**: 31/31 (UC-001~031)
- **페이지**: 5개 상태관리 페이지(main-explore, chain-view, company-detail, chain-editor, admin-llm-queue) 전부 통합 완료
- **전체 테스트**: **2,553개 통과** (apps/web 1,749 / apps/worker 445 / packages/domain 359)
- **정적 검증**: typecheck / lint / build **전부 클린**
- **DB 마이그레이션**: 0001~0025 원격 Supabase 전부 적용(25개 파일, 23테이블 + RPC/뷰 다수)

## 2. 아키텍처 개요

npm workspaces 모노레포 (techstack.md 기준):

| 워크스페이스 | 역할 | 소스 파일 수 |
|---|---|---|
| `apps/web` | Next.js 16 + React 19 + Hono 백엔드 (route→service→repository 계층) | 301 |
| `apps/worker` | node-cron 배치 워커 (scheduler→job→adapter/repository 계층) | 51 |
| `packages/domain` | 프레임워크 독립 순수 로직·상수·타입 (FE/BE 공유 SOT) | 43 |

- **인증/DB**: Supabase Auth(이메일+Google OAuth) + Postgres. RLS 전면 비활성, 인가는 Hono 미들웨어 서버측 role 검증(의도된 설계).
- **외부 연동**: 토스증권 Open API(시세·환율·캘린더), OpenDART(국내 재무/공시), SEC EDGAR(미국 재무/공시), Anthropic Claude(`claude-sonnet-5`, LLM 공시 분석). 전부 adapter contract/client로 격리.

## 3. 유스케이스별 구현 현황

### 인증·계정 (UC-001~006)
| UC | 기능 | 핵심 산출물 |
|---|---|---|
| 001 | 이메일 회원가입 | Hono 공통 골격, signup API, 이메일 인증 콜백, 계정 열거 방지 통일 응답 |
| 002 | 로그인 | 반쪽 로그인 방지, 세션 쿠키 |
| 003 | Google OAuth | 이메일 검증 병합, 어드민 승격(A-1) |
| 004 | 비밀번호 재설정 | 전 세션 폐기, 계정 열거 방지 |
| 005 | 로그아웃 | 멱등 처리 |
| 006 | 회원 탈퇴 | 유일 어드민 차단, FK CASCADE 원자 삭제 |

### 조회·탐색 (UC-007~012, 020)
| UC | 기능 | 핵심 산출물 |
|---|---|---|
| 007 | 메인/탐색 페이지 | explore reducer, 검색 통합, 체인 카드 목록, 면책 푸터 |
| 008 | 통합 종목 검색 | search_securities RPC(트라이그램·정확>접두>부분 정렬) |
| 009 | 밸류체인 뷰 | chain-view 인프라, 마인드맵 프레젠터, C5 딥링크 배선 |
| 010 | 대시보드 패널 | 일별 가치총액·분기 매출 차트, 커버리지 배지 |
| 011 | 노드 클릭 | 기업상세 라우팅, 자유주체 정보 패널, 선택 노드 시각 강조 |
| 012 | 타임라인/스냅샷 복원 | fn_chain_snapshot_at, ?at= URL 동기화, 복원 인디케이터 |
| 020 | 기업 상세 | 캔들차트, 재무, 공시, 편입체인, fn_security_belonging_chains |

### 편집 (UC-013~019, 021)
| UC | 기능 | 핵심 산출물 |
|---|---|---|
| 013 | 빈 캔버스 생성 | editor Flux 코어, quota 게이트, (protected) 로그인 가드 |
| 014 | 공식 체인 복제 | clone_value_chain RPC(단일 트랜잭션 재매핑) |
| 015 | 노드 추가/삭제 | 상장기업/자유주체 노드, 동일종목 중복방지, 연쇄삭제 |
| 016 | 엣지/관계 편집 | 엣지 검증(자기참조·중복·무향정규화), 최신구성 API, 저장 재검증 계약 |
| 017 | 노드 그루핑 | 그룹 생성/해제, 빈 그룹 정리(pruneEmptyGroups) |
| 018 | 밸류체인 저장(SOT) | save_user_chain RPC(낙관적 잠금·advisory lock) |
| 019 | 사용자 체인 삭제 | DELETE 204, TOCTOU 방어 |
| 021 | 공식 체인 CRUD | save_official_chain RPC, admin-valuechains, 이름 전역 유일 |

### 어드민 (UC-022~024)
| UC | 기능 | 핵심 산출물 |
|---|---|---|
| 022 | LLM 검토 승인/거부 | withAdminAuth 가드, approve/reject RPC, 검토 큐 화면 |
| 023 | 배치 모니터링 | batch_runs_summary 뷰(error_log 제외), 조회 전용 |
| 024 | 관계종류 마스터 | CRUD, is_active 비활성화(물리 삭제 금지) |

### 배치 워커 (UC-026~031)
| UC | 잡 | 스케줄 | 핵심 산출물 |
|---|---|---|---|
| 026 | collect_quotes | 매시 정각 | 토스 어댑터, 멱등 시세 적재, 일별 잠정 집계, 종가 확정 |
| 027 | collect_financials | 19:00 KST | OpenDART·SEC 어댑터, 재무 정규화, fn_upsert_quarterly_financials |
| 028 | collect_fx_market_hours | 08:30 KST | 환율·장운영시간 적재 |
| 029 | aggregate_daily_metrics | (cron) | carry-forward 리졸버, chain_daily/quarterly_metrics 집계 |
| 030 | analyze_disclosures | collect_financials 후 연쇄 | Anthropic Claude 어댑터, tool_choice 강제 구조화 출력 |
| 031 | backfill_all | 수동(`npm run backfill`) | 4단계 백필, 종목 시드, UC-029 후속 집계 연결 |

### 정책 (UC-025)
- UC-025: 약관/정책 3종 페이지(/legal/terms·privacy·disclaimer), not-found, 면책 푸터.

## 4. Phase 11 검증에서 발견·보완한 갭

검증 에이전트(페이지 5개 + 전체 유스케이스 크로스커팅)가 발견한 **실제 구현 갭 4건을 전부 보완**했다:

| # | 위치 | 갭 | 보완 커밋 |
|---|---|---|---|
| 1 | UC-018/021 저장 | `pruneEmptyGroups`가 도메인에 구현·테스트됐으나 저장 서비스 미배선 → 빈 그룹이 스냅샷에 저장됨 | `8bdb532` |
| 2 | UC-011 chain-view | 선택 노드가 `sr-only`로만 표시, React Flow `selected` 미반영 → 시각 강조 없음 | `8bdb532` |
| 3 | UC-012 chain-view | 시점 복원 중(`isRestoring`) 캔버스 인디케이터 미구현 | `8bdb532` |
| 4 | UC-031→UC-029 | 백필 완료 후 집계 후속 트리거(`runFollowUpAggregation`)가 no-op 미배선 | `4e1e2a2` |

추가로 minor 2건(admin-llm-queue의 `lib/dto.ts` 레이어 경계, 상세 패널 메타 필드)도 정리(`052b540`).

## 5. 검증 결과

### 자동 검증 (전부 통과)
- `npm run typecheck` (web/worker/domain): **0 에러**
- `npm run lint` (web/worker/domain): **0 에러, 0 경고**
- `npm run test`: **2,553 테스트 통과** (227+45+32 = 304 파일)
- `npm run build`: web(24 라우트)·worker 성공
- `npm run test:e2e`: home 스모크(Playwright)

### 크로스커팅 정합성 (검증 에이전트 확인)
- **API 엔드포인트**: 11개 feature 라우터 전부 `app.ts`에 등록, spec 명세와 대조 일치
- **배치 잡**: 5개 cron + analyze_disclosures 연쇄 트리거 + backfill 수동 CLI 전부 배선
- **RPC**: clone/save_user/save_official/search/snapshot_at/timeline/belonging_chains/list_cards 등 전부 배선
- **결정사항 준수**: A-1(어드민 승격), A-2(비밀번호 정책 오류 코드), C-2(비소유자 404), D-4(복제 접미어), F-1(관계종류 비활성화만), G-2(푸터), UC-006(유일 어드민 차단) 등 검증 완료
- **원격 DB**: 마이그레이션 0001~0025 전부 적용, RLS 비활성은 설계 의도(advisor 경고는 예상됨)

## 6. 남은 이슈 및 권장 후속 조치

기능 차단 이슈는 **없음**. 아래는 배포 전/후 처리 권장 사항이다.

### 인프라 설정 (배포 전 필수)
1. **Supabase 대시보드**: 이메일 인증 활성화, Google OAuth provider 설정, 비밀번호 재설정 이메일 템플릿, Site/Redirect URL에 `/auth/callback`·`/auth/oauth/google/callback` 등록
2. **환경변수**: `apps/web/.env`(루트 `.env` 심볼릭 링크로 처리됨), 실 API 키(`ANTHROPIC_API_KEY` 등) 프로덕션 주입
3. **워커 호스팅**: MVP는 로컬 `npm run dev:worker`. 프로덕션 배포 시 `dist` 번들링 또는 상시 호스팅 결정 필요(techstack §10 유보 사항)

### 데이터·검증 (배포 후)
4. **초기 데이터**: 관계종류 시드(공급/고객/경쟁 등), UC-031 백필로 전 종목 시세·재무·공시 적재(실 API 스모크로 종목 10,976건 시드 검증 완료)
5. **실 데이터 기반 재검증**: 배치가 실제 데이터를 채운 뒤 대시보드·기업상세·검색의 대량 매칭·페이지네이션 시나리오 재확인
6. **E2E 정식화**: 현재 수동 검증한 시나리오(노드 클릭 라우팅, 타임라인 복원, 최신 복귀)를 Playwright 정식 스펙으로 이관 권장

### 외부 연동 확인
7. **토스 API 필드명**: `market-calendar`/`exchange-rate` 응답의 일부 DTO 필드명은 openapi.json 실호출 검증 전 추정치(dto.ts 주석에 명시) — 키 발급 후 실호출로 확정 필요
8. **LLM 연동 문서**: `docs/external/anthropic-claude.md` 정식 연동 스펙(모델 버전 고정·과금·레이트리밋) 작성 권장

### 코드 품질 (선택)
9. shadcn-ui 미설치로 순수 HTML+Tailwind 구현 — 추후 shadcn 도입 시 폼/다이얼로그 컴포넌트 교체 여지
10. 문서-코드 경로 명칭 편차(마이그레이션 번호, `lib/formatting` vs `lib/format`, `(public)` 라우트 그룹 등) — 기능 무관, 문서 정합성 정리 권장

## 7. 구현 통계

- 소스 파일: web 301 + worker 51 + domain 43 = **395개**
- 테스트 파일: **304개**, 테스트 케이스 **2,553개**
- DB 마이그레이션: **25개** (23테이블 + RPC/뷰)
- 커밋: 기획(Phase 0~8) + 환경설정(Phase 9) + 구현 8개 Wave(Phase 10) + 검증 보완(Phase 11)

---

**결론**: 파이프라인 Phase 0~11 전 과정을 완주했다. 31개 유스케이스·5개 페이지가 spec/plan 계약대로 구현·통합되었고, 검증에서 발견된 갭을 전부 보완해 전체 2,553 테스트가 통과하는 클린 상태다. 남은 항목은 인프라 설정과 실 데이터 기반 재검증으로, 코드 구현 범위 밖의 배포 준비 작업이다.
