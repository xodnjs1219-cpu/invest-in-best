# Pipeline State

> idea_to_product 스킬이 자동 관리하는 파일입니다. 직접 수정하지 마세요.

- current_phase: 1
- autonomous_mode: false
- updated: 2026-07-05

| Phase | 이름 | 상태 | 산출물 | 승인일 |
|---|---|---|---|---|
| 0 | 요구사항 정제 | approved | docs/requirement.md | 2026-07-05 |
| 1 | PRD | in_progress | docs/prd.md | |
| 2 | 유저플로우 | pending | docs/userflow.md | |
| 2.5 | 외부연동 조사 | pending | docs/external/ | |
| 3 | 기술스택 | pending | docs/techstack.md | |
| 4 | 데이터베이스 | pending | docs/database.md | |
| 5 | 유스케이스 | pending | docs/usecases/ | |
| 6 | 페이지 복잡도 분석 | pending | (state 기록) | |
| 7 | 상태관리 | pending | docs/pages/ | |
| 8 | 구현계획 | pending | plan.md | |
| 9 | 환경설정 | pending | 프로젝트 스캐폴드 | |
| 10 | 구현 | pending | 소스코드 | |
| 11 | 검증 | pending | implementation-report.md | |

(상태: pending / in_progress / awaiting_approval / approved / skipped / failed)

## Decisions

- techstack: (미정 — Phase 3에서 결정)
- external_services: [OpenDART(키 보유), SEC EDGAR(인증 불필요), 토스증권 Open API(키 발급 예정), LLM(공급자 미정)]
- pages_with_state: []
- implementation_order: []
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
