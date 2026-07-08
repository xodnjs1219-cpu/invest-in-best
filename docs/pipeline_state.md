# Pipeline State

> idea_to_product 스킬이 자동 관리하는 파일입니다. 직접 수정하지 마세요.

- current_phase: 11
- autonomous_mode: true
- updated: 2026-07-08

| Phase | 이름 | 상태 | 산출물 | 승인일 |
|---|---|---|---|---|
| 0 | 요구사항 정제 | approved | docs/requirement.md | 2026-07-05 |
| 1 | PRD | approved | docs/prd.md | 2026-07-05 |
| 2 | 유저플로우 | approved | docs/userflow.md | 2026-07-05 |
| 2.5 | 외부연동 조사 | approved | docs/external/ | 2026-07-05 |
| 3 | 기술스택 | approved | docs/techstack.md | 2026-07-05 |
| 4 | 데이터베이스 | approved | docs/database.md | 2026-07-05 |
| 5 | 유스케이스 | approved | docs/usecases/ | 2026-07-05 |
| 6 | 페이지 복잡도 분석 | approved | (state 기록) | 2026-07-05 |
| 7 | 상태관리 | approved | docs/pages/ | 2026-07-05 |
| 8 | 구현계획 | approved | plan.md | 2026-07-07 |
| 9 | 환경설정 | approved | 프로젝트 스캐폴드 | 2026-07-07 |
| 10 | 구현 | approved | 소스코드 | 2026-07-08 |
| 11 | 검증 | approved | implementation-report.md | 2026-07-08 |

(상태: pending / in_progress / awaiting_approval / approved / skipped / failed)

## Decisions

- techstack: Next.js 16 + React 19 + Hono + Supabase(Postgres+Auth) + apps/worker(node-cron) 모노레포. LLM 공급자·워커 호스팅은 유보. 상세는 docs/techstack.md (SOT)
- external_services: [OpenDART(키 보유), SEC EDGAR(인증 불필요), 토스증권 Open API(키 발급 예정), LLM(공급자 미정)]
- pages_with_state: [chain-editor(L3, 21점), chain-view(L3, 18.5점), main-explore(L2, 13점), company-detail(L2, 14점), admin-llm-queue(L2, 11점)] — 어드민 공식체인 관리는 chain-editor 설계 공유, L1 3개(로그인/계정·어드민배치·관계마스터)와 약관(L0)은 문서 생략
- implementation_order: |
  Wave0(병렬): UC-001, UC-026
  Wave1(준-직렬 002~006, 나머지 병렬): UC-002,003,004,005,006, UC-008, UC-009, UC-022, UC-027, UC-028
  Wave2(병렬): UC-007, UC-010,011,012, UC-023
  Wave3(병렬): UC-013, UC-020, UC-029, UC-025, main-explore, chain-view
  Wave4(병렬): UC-014, UC-015, UC-016, UC-031, company-detail, admin-llm-queue
  Wave5(병렬): UC-017, UC-019, UC-024, UC-030
  Wave6: UC-018
  Wave7: UC-021
  Wave8: chain-editor
  (근거: Explore 에이전트 의존성 분석 — 골격 SOT는 001/026/008/009/022/013/016/018, 마이그레이션 신규분 0013~0026 예상, 함수명 기준 단일 소유로 수렴)
- auth: 이메일 + 소셜(Google 우선, 네이버·카카오 확장 대비)
- markets: KRX + 미국 동시 (MVP)
- user_chain_visibility: 본인만
- llm_pipeline: MVP 포함 (공식 체인 전용, 기존 노드 간 관계 한정, 어드민 승인)
- timeline_feature: MVP 포함 (스냅샷 구성 기준 지표)
- base_currency: KRW (일별 환율 환산)
- market_cap: 자체 계산 (종가 × 상장주식수, 분기 갱신)
- collection_scope: 전 종목 정기 수집 (시세·재무·공시) + 초기 전 종목 백필 (API 한도 내 분산)
- excluded_from_mvp: [소비총액, 서술형 기업 개요, 신규 노드 LLM 제안, 어드민 임명 UI]

## Log

- 2026-07-05: 파이프라인 시작. 원시 요구사항 14개 접수, 3라운드 질문(12개)으로 정제.
- 2026-07-05: 3-크리틱 검증 워크플로우(완전성/실현가능성/일관성) 실행 — 35건 발견, 전부 반영.
- 2026-07-05: 플랜 모드 승인. docs/requirement.md 작성, Phase 0 게이트 대기.
- 2026-07-05: 수정 요청 반영 — 수집 범위를 '편입 종목만'에서 '전 종목 정기 수집'으로 변경.
- 2026-07-05: Phase 0 승인. Phase 1(PRD) 시작.
- 2026-07-05: 노드 그루핑 요구사항 추가 접수 — requirement.md/prd.md 반영.
- 2026-07-05: Phase 1 승인 (PRD Open Questions 10건 확정 반영, 잔여 없음). Phase 2(유저플로우) 시작.
- 2026-07-05: Phase 2 승인 (31개 기능, OQ 21건 확정 — 사용자 체인 타임라인 지원, 이메일 인증 필수 포함). Phase 2.5(외부연동 보강) 시작.
- 2026-07-05: Phase 2.5 승인 — 3종 문서 보강 완료. OpenDART 한도 20,000건/일 확정, 토스 sharesOutstanding 확인(시총 1순위 소스), 토스 약관 리스크는 '토스 전제 유지 + 키 발급 시 약관 수동 확인'으로 결정. Phase 3(기술스택) 시작.
- 2026-07-05: Phase 3 승인 — Next.js+Hono+Supabase+워커 모노레포. Edge Functions 배치 기각 근거 설명 후 '상시 워커 유지, 호스팅 나중에' 결정. LLM 공급자 유보(어댑터 추상화). ruler 반영은 나중에. Phase 4(DB) 시작.
- 2026-07-05: Phase 4 승인 — 마이그레이션 0001~0012 (23테이블), 3-검증자 워크플로우로 major 3·minor 9 발견 후 전부 수정. 적용은 Phase 9에서. Phase 5(유스케이스) 시작.
- 2026-07-05: Phase 5 승인 — spec 31건 전부 체크 통과 (중간에 월 사용 한도 도달로 2회 분할 실행). OQ 53건 → 000_decisions.md로 확정 (환율은 축적 이후만 환산, 국내 공시 1년 소급 포함). Phase 6(복잡도 분석) 시작.
- 2026-07-05: Phase 6 승인 — 9개 페이지 채점, 권장 5개(L3×2+L2×3) 선택. Phase 7(상태관리) 시작.
- 2026-07-05: Phase 7 승인 — 5개 페이지 requirement+state_management 전 건 검증 통과 (한도로 2회 분할 실행). Phase 8(구현계획) 시작.
- 2026-07-07: Phase 8 진행 — plan 36건(유스케이스 31 + 페이지 5) 작성 전부 완료. 선검증 14건 완료: 12건 통과(002~008, 010~014), 2건 major(001: AUTH_PASSWORD_POLICY_VIOLATION 도달 불가 모순, 009: ?at= 딥링크 무한 로딩 C5/C7 모순). 판정 파일: docs/plan-checks/*.json. 남은 작업: 015~031 + 페이지 5건 선검증, 001·009 보완+재검증. 월 사용 한도 반복 도달로 중단 — 한도 상향 후 재개 필요.
- 2026-07-07: Phase 8 선검증 완료 — 36건 전부 plan_checker 통과. major 4건(001, 009, 021, chain-editor) 자동 보완 후 재검증 통과. 잔여 minor는 문서 표기 수준(spec 원문 역반영 권장 등, 구현 비차단). 최종 게이트 대기.
- 2026-07-07: Phase 8 승인 — 자율 모드 전환(autonomous_mode: true). Phase 9(환경설정) 시작. 이후 Phase 9~11 게이트 없이 자동 진행·자동 커밋.
- 2026-07-07: Phase 9 완료 — npm workspaces 모노레포(apps/web, apps/worker, packages/domain) 스캐폴딩, build/lint/typecheck/test/test:e2e/format:check 7개 명령 전부 통과 확인. Next.js 16.2.10에서 `next lint` 제거로 `eslint .` 대체, eslint-plugin-react/ESLint10 비호환은 postinstall 패치로 해결(scripts/patch-eslint-plugin-react.cjs). techstack §7(로컬 Supabase 실행 금지, MCP apply_migration 사용) 확인 — 마이그레이션 0001~0012는 원격에 미적용 상태로 남음(Phase 10 구현 중 필요 시 적용). Phase 10(구현) 시작, Wave0(UC-001, UC-026)부터 진행.
- 2026-07-08: 마이그레이션 0001~0012 원격 Supabase 적용 완료(23테이블). RLS 전면 비활성은 설계 의도(인가는 Hono 미들웨어 서버측 검증) — advisor critical 경고는 예상됨. .env 키 이름 정리(.env.example 표준화), DATABASE_URL/ADMIN_SEED_EMAILS/SEC_EDGAR_USER_AGENT 추가.
- 2026-07-08: Phase 10 Wave0 완료 — UC-001(이메일 회원가입, 커밋 3eaa669)·UC-026(시세 수집 배치, 커밋 7cf1046) 구현. 웹 Hono 골격+워커 공통 골격 최초 정의. 마이그레이션 0013(fn_upsert_provisional_daily_quotes) 적용. 전체 201 테스트(web 90/worker 80/domain 31) 통과. 구현 중 세션한도·크레딧·연결끊김으로 다수 재개. 후속 확인 필요: shadcn-ui 미설치(순수 HTML 폼 대체), Supabase 대시보드 이메일확인·Redirect URL 등록, 워커 프로덕션 배포 시 dist 번들링. 다음: Wave1(UC-002~006, 008, 009, 022, 027, 028).
- 2026-07-08: Phase 10 Wave1 완료 — UC-002~006(인증: 로그인·소셜·재설정·로그아웃·탈퇴), UC-008(검색), UC-009(체인뷰+마인드맵), UC-022(어드민 LLM 검토), UC-027(재무/공시 수집), UC-028(환율/장운영시간 수집). 6개 에이전트 병렬, 공유 파일(app.ts/context.ts/index.ts/providers.tsx) 비파괴 병합 확인. 마이그레이션 0014_fn_search_securities·0014_llm_proposal_review_fns·0015_fn_upsert_quarterly_financials 원격 적용. 전체 992 테스트(web 658/worker 227/domain 107) 통과, typecheck/lint/build 클린. 커밋 a4bbcef. 빌드 시 apps/web/.env → 루트 .env 심볼릭 링크 필요(gitignore됨), web eslint에 argsIgnorePattern 추가. 후속: Google OAuth/비번재설정 Supabase 대시보드 설정, API 실키 통합테스트, 토스 캘린더/환율 DTO 필드명 실호출 재확인. 다음: Wave2(UC-007, 010~012, 023).
- 2026-07-08: .gitignore 버그 수정(커밋 29a598b) — Python 템플릿 잔재 `lib/` 패턴이 apps/web/src/lib/** 전체를 무시해 UC-001·Wave1 커밋에서 공통 인프라 14개 파일(Supabase 클라이언트·api-client·safe-redirect 등) 누락됨. 패턴 제거 후 전량 복구.
- 2026-07-08: Phase 10 Wave2 완료 — UC-007(메인/탐색 페이지), UC-010(대시보드), UC-011(노드클릭), UC-012(타임라인/스냅샷 복원), UC-023(배치 모니터링). 3개 에이전트 병렬(UC-010~012 순차). features/valuechains/backend/* 공유 확장 비파괴 병합 확인. 마이그레이션 원격 순서에 맞춰 로컬 파일명 재번호(0014~0019 정리). fn_list_chain_cards·admin_batch_runs_summary_view·chain_view_dashboard_timeline_fns 적용. 전체 1346 테스트(web 971/worker 227/domain 148) 통과, typecheck/lint/build 클린. UC-012에서 "최신 복귀" URL 경쟁상태 버그 발견·수정(브라우저 런타임 검증). 후속: E2E Playwright 정식화, MetricsRangeSelector 커스텀 범위 UI, 시드 데이터 기반 재검증. 다음: Wave3(UC-013, 020, 025, 029, main-explore, chain-view 페이지).
- 2026-07-08: Phase 10 Wave3 완료 — UC-013(빈 캔버스 체인 생성: editor Flux 코어·quota 게이트·(protected) 로그인 가드), UC-020(기업 상세: 캔들차트·재무·공시·편입체인, lightweight-charts 도입), UC-025(약관/정책 3종 페이지·not-found·푸터), UC-029(일별 지표 집계 배치: carry-forward·chain metrics). 4개 에이전트 병렬. UC-013 에이전트 초기 하위에이전트 위임 오류를 직접 구현으로 교정. 마이그레이션 0020_fn_security_belonging_chains·0021_fn_metric_aggregation_inputs 적용. 전체 1776 테스트(web 1257/worker 281/domain 238) 통과, typecheck/lint/build 클린. 커밋 b05b616. 후속: E2E Playwright, useUnsavedChangesGuard와 router.push 상호작용(UC-018 통합 시), 시드 데이터 기반 재검증. 다음: Wave4(편집 클러스터 UC-014~019, 024, 030 + 페이지 5개).
- 2026-07-08: Phase 10 Wave4-1 완료 — UC-015(노드 추가/삭제), UC-016(엣지/관계/최신구성 API·저장 재검증 계약), UC-024(관계종류 마스터), UC-031(전종목 백필: 4단계 잡·종목시드, 실API로 10,976건 스모크 검증). 마이그레이션 0022_relation_types_admin. editor reducer에 노드/엣지 액션 추가. 전체 2105 테스트 통과. 커밋 2847cac.
- 2026-07-08: Phase 10 Wave4-2 완료 — **31개 유스케이스 전체 구현 완료**. UC-017(그루핑), UC-018(저장 계약 SOT: save_user_chain RPC·낙관적 잠금), UC-021(공식 체인 CRUD·어드민), UC-014(복제), UC-019(삭제), UC-030(LLM 공시 분석: Anthropic Claude claude-sonnet-5 어댑터·tool_choice 강제 구조화 출력). 마이그레이션 0023_clone/0024_save_user/0025_save_official. LLM 공급자 Anthropic Claude 확정(techstack §10). 에이전트가 지정한 구형 모델 ID claude-sonnet-4-5 → claude-sonnet-5로 교정. 전체 2553 테스트(web 1749/worker 445/domain 359) 통과, typecheck/lint/build 클린. 커밋 60a5cb9. 마이그레이션 원격 0001~0025 전부 적용. 다음: 페이지 5개(chain-editor·chain-view·main-explore·company-detail·admin-llm-queue) 통합 검증, Phase 11.
- 2026-07-08: Phase 11(검증) 완료 — **파이프라인 완주**. 6개 검증 에이전트(페이지 5개 통합 + 전체 유스케이스 크로스커팅)로 점검. 발견된 실제 갭 4건 전부 보완: (1) UC-018/021 pruneEmptyGroups 미배선(빈 그룹 저장), (2) UC-011 선택 노드 시각 강조 누락, (3) UC-012 isRestoring 인디케이터 누락 → 커밋 8bdb532; (4) UC-031→UC-029 후속 집계 no-op 미배선 → 커밋 4e1e2a2(assembleAggregateDailyMetricsJob 헬퍼로 scheduler/backfill 공유). minor 2건(admin-llm-queue dto 레이어·상세 메타) 정리 052b540. 크로스커팅 확인: 라우터 11개·배치 잡 6개·RPC 전부 배선, 핵심 결정사항 준수. 최종 전체 2553 테스트 통과, typecheck/lint/build 클린. 보고서: implementation-report.md(루트). Critical/Major 잔여 0건. 남은 것은 인프라 설정(Supabase 대시보드·실 API 키)·실데이터 재검증 등 배포 준비 작업(코드 범위 밖).
