---
name: idea_to_product
description: 사용자가 만들고 싶은 서비스/앱의 초기 아이디어나 원시 요구사항을 제시하면 사용 ("~만들고 싶어", "~앱/서비스 만들어줘", 기능 나열 줄글 등). 요구사항 정제(질문 반복)부터 PRD → 유저플로우 → 외부연동 → 기술스택 → DB → 유스케이스 → 상태관리 → 구현계획 → 환경설정 → 구현 → 검증까지 전체 개발 파이프라인을 오케스트레이션한다. Use when the user gives raw product requirements or an app idea and wants it refined and built end-to-end.
---

# Idea to Product — 엔드투엔드 개발 파이프라인

원시 요구사항을 질문을 통해 정제·확정하고, 기획 문서 → 환경설정 → 구현 → 검증까지 서브에이전트들을 오케스트레이션하여 완주하는 마스터 스킬.

## 핵심 원칙

1. **이 스킬은 메인 루프에서 실행된다.** 모든 사용자 상호작용(AskUserQuestion, 승인 게이트)은 메인 루프에서만 수행한다. **서브에이전트는 사용자에게 질문할 수 없다.** 서브에이전트가 "Open Questions" 목록을 반환하면, 메인 루프가 AskUserQuestion으로 대행 질문한 뒤 답변을 포함해 에이전트를 재실행한다.
2. **하이브리드 진행**: Phase 0~8은 각각 사용자 승인 게이트로 끝난다. Phase 8 최종 승인 이후 Phase 9~11은 **중단 없이 자동으로** 진행한다 (게이트 없음, 자동 커밋).
3. **재개 가능**: 스킬 시작 시 항상 `docs/pipeline_state.md`를 먼저 확인한다. 존재하면 [재개 프로토콜](#재개-프로토콜)을 따르고, 없으면 생성 후 Phase 0부터 시작한다.
4. **언어와 커밋**: 모든 산출 문서는 한국어로 작성한다. 커밋은 `.ruler/conventionalcommit.md` 형식(타입 + 한국어 설명)을 따른다.
5. **스택 SOT**: `docs/techstack.md`가 생성된 이후에는 이 문서가 모든 스택 결정의 유일한 기준이다.
6. Phase별 상세 Task 프롬프트는 [references/phase-prompts.md](references/phase-prompts.md)를 참고한다.

## Phase 구성

| Phase | 이름 | 실행 주체 | 입력 | 산출물 | 게이트 |
|---|---|---|---|---|---|
| 0 | 요구사항 정제 | **메인 루프** | 사용자 원시 요구사항 | `docs/requirement.md` | ✅ |
| 1 | PRD | `prd_writer` | requirement.md | `docs/prd.md` | ✅ |
| 2 | 유저플로우 | `userflow_writer` | requirement.md, prd.md | `docs/userflow.md` | ✅ |
| 2.5 | 외부연동 조사 (조건부) | `external_researcher` (서비스별 1회) | 감지된 외부 서비스 | `docs/external/[service].md` | ✅ |
| 3 | 기술스택 | `techstack_selector` | requirement.md, external/* | `docs/techstack.md` | ✅ **필수** |
| 4 | 데이터베이스 | `database_writer` | prd, userflow, external/*, techstack | `docs/database.md` + 마이그레이션 | ✅ |
| 5 | 유스케이스 | `usecase_writer` (기능별) | userflow, database, external/* | `docs/usecases/00N/spec.md` | ✅ 일괄 |
| 6 | 페이지 복잡도 분석 | **메인 루프** | 모든 spec.md | 분석표 → state 기록 | ✅ 선택 |
| 7 | 상태관리 (조건부) | `status_management_writer` (페이지별) | 선택된 페이지 + Level | `docs/pages/[page]/requirement.md`, `state_management.md` | ✅ |
| 8 | 구현계획 | `caseplan_writer` / `pageplan_writer` | spec.md, state_management.md | `plan.md` | ✅ **최종 (자율 모드 동의)** |
| 9 | 환경설정 | `env_setupper` | techstack.md, requirement.md | 프로젝트 스캐폴드 + 테스트 환경 | ❌ 자동 |
| 10 | 구현 | `implementer` (plan별 반복) | 각 plan.md | 소스코드 + 테스트 | ❌ 자동 |
| 11 | 검증 | `implement_checker` + `plan_checker` + 메인 루프 | 전체 산출물 | `implementation-report.md` (루트) | 최종 보고 |

## 공통 게이트 프로토콜

각 Phase(0~8) 종료 시:

1. **요약 제시**: 생성/수정된 파일, 핵심 결정사항, 검토 포인트를 간결하게 보여준다.
2. **승인 질문**: AskUserQuestion으로 선택지를 제시한다 — `승인 / 수정 요청 / 이 단계 건너뛰기 / 파이프라인 중단`.
   - **승인** → `docs/pipeline_state.md` 갱신 → 커밋 제안("이 커밋을 생성할까요?") → 다음 Phase.
   - **수정 요청** → 피드백 반영(필요 시 에이전트 재실행) 후 게이트 반복.
   - **건너뛰기** → state에 `skipped` 기록 후 다음 Phase.
   - **중단** → state 저장 후 종료 (이후 재개 가능).
3. **커밋**: 사용자가 승인한 경우에만 생성하며, `docs/pipeline_state.md`를 항상 함께 포함한다.

Phase별 커밋 메시지:

| Phase | 커밋 메시지 |
|---|---|
| 0 | `docs(requirement): 요구사항 정의서 작성` |
| 1 | `docs(prd): PRD 문서 작성` |
| 2 | `docs(userflow): 유저플로우 문서 작성` |
| 2.5 | `docs(external): [서비스명] 연동 문서 작성` |
| 3 | `docs(techstack): 기술스택 문서 작성` |
| 4 | `docs(database): 데이터베이스 스키마 및 마이그레이션 작성` |
| 5 | `docs(usecase): 유스케이스 명세 작성` |
| 7 | `docs(state): [페이지명] 상태관리 설계 작성` |
| 8 | `docs(plan): 구현 계획 작성` |
| 9 | `chore(env): 개발 및 테스트 환경 구성` (자동) |
| 10 | `feat([scope]): [기능명] 구현` (유닛별 자동) |
| 11 | `docs(report): 구현 검증 보고서 작성` (자동) |

---

## Phase 0: 요구사항 정제 (메인 루프)

`prompt/0. requirment/requirment.md`의 출력 형식을 기준으로 한다 (`# Requirements: 서비스명` — 개요 / 페이지 구성 / 데이터 / 기능 / 연동).

1. **초안 구성**: 사용자의 원시 요구사항을 위 5개 섹션 골격에 배치한다.
2. **누락/모호점 식별**: 다음 관점에서 빈 곳을 찾는다.
   - 대상 사용자와 핵심 목표
   - 페이지 구성과 페이지 간 이동
   - 인증/회원 여부, 데이터 보존·삭제 정책
   - 외부 연동(SDK/API/Webhook) 여부
   - 플랫폼(웹/모바일/반응형), MVP 범위에서 제외할 항목
   - 각 기능의 엣지케이스가 상상 가능한 수준으로 구체적인지
3. **질문 루프**: AskUserQuestion으로 **한 라운드에 2~4개씩** 질문한다. 선택지를 제공하되 자유 입력(기타)도 허용된다. 답변을 초안에 반영하고, 실질적인 모호함이 남아있으면 반복한다. 사용자가 "이대로 진행"을 선택하면 즉시 종료한다.
4. **확정**: 정리된 최종본을 제시하고 게이트를 수행한다. 승인 시 `docs/requirement.md` 저장, `docs/pipeline_state.md` 생성/갱신, 커밋 제안.

## Phase 1: PRD

`prd_writer` 에이전트를 실행한다. 완료 후 Open Questions가 있으면 대행 질문 → 재실행. 게이트에서 제품 개요/페이지 목록/사용자 여정/IA를 요약 제시한다.

## Phase 2: 유저플로우

`userflow_writer` 에이전트를 실행한다. 게이트에서 기능 목록(번호 포함)과 각 플로우의 입력/처리/출력 요약을 제시한다. 이 기능 번호가 Phase 5 유스케이스 번호(00N)의 기준이 된다.

## Phase 2.5: 외부연동 조사 (조건부)

requirement/prd/userflow에서 외부 SDK/API/Webhook 언급을 스캔한다.
- **없으면**: state에 `skipped` 기록 후 Phase 3으로 건너뛴다.
- **있으면**: 서비스별로 `external_researcher`를 실행한다 (독립적이면 병렬). 게이트에서 서비스별 연동 수단/인증 방식/핵심 제약을 요약 제시한다.

## Phase 3: 기술스택 (필수 게이트)

`techstack_selector` 에이전트를 실행한다. 게이트에서 다음을 제시한다.
- 제안 스택 + 버전, 선정 근거, 기각된 대안과 이유
- Codebase Structure 요약
- 사용자가 다른 스택을 원하면 조건을 반영해 에이전트를 재실행한다.

승인 후 **선택 제안**: "`.ruler/AGENTS.md`에 이 스택의 프로필 섹션을 추가하고 `npx @intellectronica/ruler apply`로 재생성할까요? (적용은 다음 세션부터 반영)" — 거절해도 파이프라인은 계속된다 (`docs/techstack.md`가 SOT이므로 필수 아님).

## Phase 4~8: 기획 문서 (spec_to_plan 단계 준용)

각 Phase는 `spec_to_plan` 스킬과 동일한 요령으로 진행하되, 게이트는 이 스킬의 공통 프로토콜을 따른다.

- **Phase 4**: `database_writer` 실행. 검증 기준: [validation-checklist](../spec_to_plan/references/validation-checklist.md) Phase 1 항목.
- **Phase 5**: userflow의 기능마다 `usecase_writer`를 실행한다 (독립 기능은 병렬 실행). 전체 완료 후 **일괄 게이트**: 유스케이스 목록 + 각각의 핵심 요약을 제시하고, 사용자는 개별 유스케이스 단위로 수정을 요청할 수 있다.
- **Phase 6**: 에이전트 없이 메인 루프가 직접 수행한다. [page-complexity-analysis](../spec_to_plan/references/page-complexity-analysis.md)의 4차원 점수 루브릭(상태/상호작용/계층/데이터흐름)으로 모든 페이지를 채점하고, spec_to_plan Phase 2.5의 출력 형식(분석표 + 페이지별 상세 + 권장 순서)으로 제시한다. 사용자가 작업할 페이지와 Level을 선택하면 state의 `## Decisions`에 기록한다. 전부 Level 0이면 Phase 7을 건너뛴다.
- **Phase 7**: 선택된 페이지마다 `status_management_writer`를 Level과 함께 실행한다.
- **Phase 8**: 기능 기반은 `caseplan_writer`, 페이지 기반은 `pageplan_writer`를 실행한다. **게이트 제시 전에** 각 plan에 대해 `plan_checker`를 실행해 누락을 선검증하고 결과를 함께 제시한다.

**Phase 8 최종 게이트 문구에 반드시 포함**:
> "이 계획을 승인하면 **환경설정 → 구현 → 검증이 중단 없이 자동으로 진행**되며, 각 단계 완료 시 **자동으로 커밋**됩니다. 진행할까요?"

승인 시 state에 `autonomous_mode: true`를 기록한다.

---

## Phase 9~11: 자율 구간 (게이트 없음)

이 구간에서는 사용자에게 질문하지 않는다. 문제가 생기면 스스로 해결을 시도하고, 해결 불가 항목은 `failed`로 기록한 뒤 계속 진행한다.

### Phase 9: 환경설정

1. `env_setupper` 에이전트를 실행한다.
2. 완료 후 메인 루프가 `docs/techstack.md`의 빌드/린트/테스트 명령을 직접 실행해 통과를 재확인한다.
3. 자동 커밋: `chore(env): 개발 및 테스트 환경 구성`.

### Phase 10: 구현

1. **구현 순서 결정**: 유스케이스 spec/plan을 읽고 선행관계를 파악해 의존성 순서로 정렬한다 (`prompt/etc/next_task.md`의 요령). 유스케이스 plan 먼저, 페이지 plan은 관련 유스케이스 완료 후. 순서를 state의 `## Decisions`에 기록한다.
2. **유닛별 실행**: 각 plan.md에 대해 `implementer` 에이전트를 실행한다 (TDD, `.ruler/tdd.md` 준수).
3. **유닛별 검증**: 완료 후 메인 루프가 테스트/린트/빌드를 실행한다.
   - 실패 시: 에러 출력을 첨부해 `implementer`를 재실행한다. **최대 3회** 시도 후에도 실패하면 state에 `failed`로 기록하고 다음 유닛으로 넘어간다 (파이프라인을 멈추지 않는다).
4. **유닛별 자동 커밋**: `feat([scope]): [기능명] 구현`.

### Phase 11: 검증

1. `implement_checker`(전체)와 유스케이스/페이지별 `plan_checker`를 병렬 실행한다.
2. 메인 루프가 전체 빌드 + 린트 + 테스트 스위트를 실행한다.
3. 결과를 종합해 루트에 `implementation-report.md`를 작성한다: 완료/실패 유닛, 테스트 결과, 검증 리포트 요약, 남은 이슈와 권장 후속 조치.
4. 자동 커밋: `docs(report): 구현 검증 보고서 작성`.
5. **최종 보고**: 사용자에게 전체 결과(성공/실패/이슈)를 요약 보고하고 파이프라인을 종료한다. state의 모든 Phase를 완료 처리한다.

---

## 재개 프로토콜

1. `docs/pipeline_state.md`를 읽는다.
2. 상태표의 각 산출물이 실제로 존재하는지 교차 검증한다. 파일이 없으면 해당 Phase를 `pending`으로 강등한다.
3. "Phase N부터 재개합니다"를 공지하고 해당 Phase를 시작한다.
4. `autonomous_mode: true`면 게이트 없이 자율 구간을 이어서 진행한다.

## pipeline_state.md 템플릿

```markdown
# Pipeline State

> idea_to_product 스킬이 자동 관리하는 파일입니다. 직접 수정하지 마세요.

- current_phase: 0
- autonomous_mode: false
- updated: YYYY-MM-DD

| Phase | 이름 | 상태 | 산출물 | 승인일 |
|---|---|---|---|---|
| 0 | 요구사항 정제 | in_progress | docs/requirement.md | |
| 1 | PRD | pending | docs/prd.md | |
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

- techstack:
- external_services: []
- pages_with_state: []
- implementation_order: []

## Log

- YYYY-MM-DD: 파이프라인 시작
```

## 참고 문서

- Phase별 Task 프롬프트 템플릿: [references/phase-prompts.md](references/phase-prompts.md)
- 요구사항 형식: `prompt/0. requirment/requirment.md`
- 페이지 복잡도 루브릭: `.claude/skills/spec_to_plan/references/page-complexity-analysis.md`
- 산출물 검증 체크리스트: `.claude/skills/spec_to_plan/references/validation-checklist.md`
- Hono 백엔드 가이드 (techstack이 Hono+Supabase인 경우만): `.claude/skills/spec_to_plan/references/hono-backend-guide.md`
- 기획 단계만 단독으로 수행하려면 `spec_to_plan` 스킬을 사용한다.
