# Prompt Templates

This document contains the exact prompts to use for each phase of the spec-based web development workflow.

**IMPORTANT**: After completing each phase, use the corresponding **Review Prompt** to present the output to the user and request feedback. Do not proceed to the next phase without explicit user approval.

## Table of Contents

1. [Phase 1: Database Schema](#phase-1-database-schema)
   - [Review Prompt](#phase-1-review-prompt)
2. [Phase 2: Use Cases](#phase-2-use-cases)
   - [Review Prompt](#phase-2-review-prompt)
3. [Phase 2.5: Page Complexity Analysis](#phase-25-page-complexity-analysis)
4. [Phase 3: State Management](#phase-3-state-management)
   - [Review Prompt](#phase-3-review-prompt)
5. [Phase 4: Implementation Plans](#phase-4-implementation-plans)
   - [Review Prompt](#phase-4-review-prompt)

---

## Phase 1: Database Schema

**🤖 Use Agent**: Launch `database_writer` agent with Task tool

```
Task(
  subagent_type="database_writer",
  description="Generate database schema",
  prompt="/docs/prd.md, /docs/userflow.md를 기반으로 데이터베이스 스키마를 설계하고 /docs/database.md와 migration SQL을 생성해주세요."
)
```

**Fallback (if not using agent):**
```
/docs/prd.md, /docs/userflow.md를 기반으로, 이를 구현하기위한 최소 스펙의 데이터베이스 스키마 구상하고,
데이터베이스 관점의 데이터플로우 작성하라.
/docs/database.md 경로에 생성하라.

- 반드시 유저플로우에 명시적으로 포함된 데이터만 포함한다.
- 먼저 간략한 데이터플로우를 응답하고, 이후 구체적인 데이터베이스 스키마를 응답하라.
- PostgreSQL을 사용한다.

또, 이를 데이터베이스에 반영하기위한 migration sql을 `/supabase/migrations` 경로에 생성하라.
```

### Phase 1: Review Prompt

After generating the database schema, use this prompt to request user review:

```
✅ **Phase 1 완료: Database Schema**

다음 파일들이 생성되었습니다:
- `/docs/database.md` - {간략한 설명}
- `/supabase/migrations/{파일명}.sql` - {간략한 설명}

**생성된 스키마 요약:**
- 총 {N}개 테이블 설계
- 주요 관계: {관계 목록}
- 인덱스: {인덱스 개수}개

**주요 설계 결정사항:**
{중요한 설계 결정 1-2가지}

**검토 요청사항:**
1. 데이터 플로우 다이어그램이 요구사항을 정확히 반영하나요?
2. 누락된 엔티티나 관계가 있나요?
3. MVP를 위해 더 단순화할 수 있는 부분이 있나요?

👉 `/docs/database.md`와 `/supabase/migrations/*.sql`을 확인해주세요.

**수정이 필요하신가요?**
- "승인" 또는 "다음 단계 진행" → 커밋 제안 후 Phase 2로 이동
- 수정 사항 명시 → 문서 업데이트 후 재검토

---

**승인 후 Git 커밋 제안:**

다음 커밋을 생성할까요?

```
docs(database): add database schema and migration

- Create database schema documentation
- Add PostgreSQL migration file
- Define {N} tables with relationships
```

이 커밋을 생성할까요?
- "네" 또는 "커밋" → 커밋 생성 후 Phase 2 진행
- "아니오" 또는 "건너뛰기" → 커밋 없이 Phase 2 진행
```

---

## Phase 2: Use Cases

Replace `{N}` with the feature number from userflow.md.

**🤖 Use Agent**: Launch `usecase-writer` agent with Task tool

```
Task(
  subagent_type="usecase-writer",
  description="Write use case for feature {N}",
  prompt="/docs/userflow.md의 {N}번 기능에 대한 상세 유스케이스를 작성하고 /docs/00{N}/spec.md에 저장해주세요. Hono Backend Guide를 참고하여 API 명세도 포함해주세요."
)
```

**Fallback (if not using agent):**
```
`/docs/userflow.md`의 {N}번 기능에 대한 상세 유스케이스를 작성하고, `/docs/00N/spec.md` 경로에 저장하세요.
간결하게, 검토하기 쉽게 작성하세요. 다음 내용을 포함하세요.

- Primary Actor
- Precondition (사용자 관점에서만)
- Trigger
- Main Scenario
- Edge Cases: 발생할 수 있는 오류 및 처리를 간략하게 언급
- Business Rules
  - API Specification (Hono 프로젝트인 경우)
  - Database Operations

PlantUML 문법을 사용한 Sequence Diagram도 작성하세요.
User / FE / Hono Router / Service / Database로 나누면 됩니다.
구분선 같은 마킹없이 PlantUML 표준 문법을 따르도록 작성하세요.
```

### Phase 2: Review Prompt

After generating the use case, use this prompt to request user review:

```
✅ **Phase 2 완료: Use Case #{N}**

다음 파일이 생성되었습니다:
- `/docs/00{N}/spec.md` - {기능 간략 설명}

**Use Case 요약:**
- 기능: {기능명}
- Primary Actor: {액터}
- Main Scenario: {N}단계
- Edge Cases: {M}개
- API Endpoints: {엔드포인트 목록} (해당되는 경우)

**주요 비즈니스 규칙:**
{핵심 규칙 1-2가지}

**Sequence Diagram 시각화:**
👉 PlantUML 다이어그램을 확인하려면 https://www.plantuml.com/plantuml/ 에서 렌더링해보세요.

**검토 요청사항:**
1. Main Scenario가 완전하고 정확한가요?
2. 누락된 Edge Case나 에러 시나리오가 있나요?
3. Business Rules가 요구사항과 일치하나요?
4. (Hono 프로젝트) API 명세가 명확한가요?

👉 `/docs/00{N}/spec.md`를 확인해주세요.

**수정이 필요하신가요?**
- "승인" 또는 "다음 진행" → 커밋 제안 후 다음 Use Case 또는 Phase 2.5로 이동
- 수정 사항 명시 → 문서 업데이트 후 재검토

---

**승인 후 Git 커밋 제안:**

다음 커밋을 생성할까요?

```
docs(usecase): add use case specification for feature {N}

- Document main scenario with {X} steps
- Add {Y} edge cases for error handling
- Include API specification (endpoints, schemas, error codes)
- Create sequence diagram for user flow
```

이 커밋을 생성할까요?
- "네" 또는 "커밋" → 커밋 생성 후 다음 진행
- "아니오" 또는 "건너뛰기" → 커밋 없이 다음 진행
```

---

## Phase 2.5: Page Complexity Analysis

**Trigger**: After all Use Cases (Phase 2) are completed and approved

```
모든 Use Case 문서(`/docs/00N/spec.md`)를 분석하여 상태 관리가 필요한 페이지를 식별하고 복잡도를 평가하세요.

**분석 프로세스:**

1. **페이지 추출**
   - 모든 Use Case 문서에서 언급된 페이지 목록 작성
   - 각 페이지와 관련된 Use Case 번호 매핑

2. **복잡도 점수 계산**
   각 페이지마다 다음 4가지 차원에서 점수 계산:

   a) **상태 복잡도** (1-5+점)
      - 서버 데이터, 폼 상태, UI 상태, 필터, 페이지네이션 등
      - 각 데이터 종류당 1점

   b) **상호작용 복잡도** (1-5+점)
      - CRUD 작업, 필터링, 정렬, 검증 등
      - 각 액션당 0.5점

   c) **컴포넌트 계층 복잡도** (1-4+점)
      - 예상되는 컴포넌트 깊이
      - 상태를 공유하는 형제 컴포넌트 수

   d) **데이터 흐름 복잡도** (1-5+점)
      - API, localStorage, URL params 등 데이터 소스
      - 필터링, 정렬, 집계 등 데이터 변환

3. **레벨 결정**
   총점에 따라:
   - 0-5점: Low (상태 관리 불필요)
   - 6-10점: Medium → **Level 1** (기본 상태 정의만)
   - 11-15점: High → **Level 2** (Flux 패턴)
   - 16+점: Very High → **Level 3** (Context + useReducer)

4. **결과 제시**
   분석 결과를 표와 함께 제시하고, 다음 단계 선택을 요청하세요.

**상세 가이드**: references/page-complexity-analysis.md 참조
```

### Phase 2.5: Analysis Result Presentation

After analyzing all pages, present results with this format:

```
📊 **페이지 복잡도 분석 완료**

모든 Use Case({N}개)를 분석한 결과, 다음 페이지들이 식별되었습니다:

## 분석 결과

| 페이지 | 복잡도 점수 | 레벨 | 상태 관리 필요 수준 |
|--------|-------------|------|---------------------|
| {페이지1} | {점수} | {레벨} | {Level} ({설명}) |
| {페이지2} | {점수} | {레벨} | {Level} ({설명}) |
| ... | ... | ... | ... |

## 상세 분석

### 1. {가장 복잡한 페이지} ({점수}점, {레벨})

**복잡도 구성:**
- 상태 복잡도: {N}점 ({이유})
- 상호작용 복잡도: {N}점 ({이유})
- 컴포넌트 계층: {N}점 ({이유})
- 데이터 흐름: {N}점 ({이유})

**제안 수준: Level {N}**
- ✅/❌ Requirement.md
- ✅/❌ State Management.md
  - 상태 정의
  - Flux 패턴 (Level 2+)
  - Context 설계 (Level 3)

**이유:**
{왜 이 레벨이 필요한지 구체적 설명}

---

### 2. {두 번째 페이지} ({점수}점, {레벨})
[... 같은 형식 ...]

---

[나머지 페이지들 간략히...]

## 권장 작업 순서

복잡도가 높고 핵심적인 페이지부터 작업하는 것을 권장합니다:

1. **{페이지1}** ({점수}점) - Level {N}
2. **{페이지2}** ({점수}점) - Level {N}
3. **{페이지3}** ({점수}점) - Level {N}
4. **(선택) {페이지4}** ({점수}점) - Level {N}

{Low 레벨 페이지들}은 상태 관리 문서를 작성하지 않습니다.

## 다음 단계 선택

**어떻게 진행하시겠습니까?**

옵션:
1. "{가장 복잡한 페이지}부터 시작" → 해당 페이지 Level {N} 작업 진행
2. "순서대로 모두 진행" → 1번부터 순차 작업
3. "[특정 페이지명] 먼저" → 지정한 페이지부터 작업
4. "분석만 확인, 나중에 결정" → Phase 3 건너뛰고 Phase 4로 이동

**참고**: 각 Level의 작업 범위:
- **Level 1**: requirement.md만 (상태 정의 + 전환 테이블)
- **Level 2**: requirement.md + state_management.md 부분 (Flux 패턴)
- **Level 3**: requirement.md + state_management.md 전체 (Flux + Context)

👉 선택해주시면 해당 작업을 시작하겠습니다.
```

**Important:**
- Wait for explicit user decision
- Do not assume user wants all pages
- Respect if user wants to skip Phase 3

---

## Phase 3: State Management

Replace `[pagename]` with the actual page name and `{N}` with complexity level (1, 2, or 3).

**🤖 Use Agent**: Launch `status_management_writer` agent with Task tool

```
Task(
  subagent_type="status_management_writer",
  description="Design state management for [pagename]",
  prompt="[pagename] 페이지에 대한 상태 관리 문서를 작성해주세요. Level {N} 수준으로 작성하며, requirement.md와 state_management.md를 생성해주세요."
)
```

**Fallback (if not using agent):**
```
'/docs/prd.md'와 '/docs/userflow.md'와 '/docs/usecases/**'를 참고하여

[pagename]에 대한 자세한 요구사항을 작성합니다.

할 수 있는 행동과, 그에 따라 데이터가 변화하는 흐름을 명확히 설명하는 것이 중요합니다.

데이터베이스를 사용한다면 반드시 언급해야합니다.

이 내용을 `/docs/pages/[pagename]/requirement.md` 경로에 저장해주세요.

`/docs/pages/[pagename]/requirement.md`를 참고하여 요구사항에 대한 상태를 정의하라.

먼저 관리해야할 상태 데이터 목록을 나열하고,
화면상에 보여지는 데이터지만 상태가 아닌 것도 나열하라.

그리고 각 상태가 변경되는 조건과, 변경 시 화면이 어떻게 달라지는지 표로 정리하라.

설계된 상태관리 내용에 Flux 패턴을 적용하여 개선하라.
먼저 관리해야할 상태 데이터 목록을 나열하고,
화면상에 보여지는 데이터지만 상태가 아닌 것도 나열하라.

이후에는 구체적인 Flux 설계를 서술하라.
사용자가 수행할 수 있는 Action을 정의하고,
이에 대한 Store, View 단계를 이해하기 쉽게 구체적으로 정리하라.

코드를 작성한다면 최신 업계표준을 준수하여 useReducer를 사용하라.

설계된 상태관리 설계를 Context + useReducer로 관리할 것이다. 자세한 설계 진행하라.

Context가 데이터를 불러오고 관리하는 흐름을 시각화하고,
하위 컴포넌트들에 노출할 변수 및 함수를 나열하라.

구체적인 구현 대신 인터페이스 및 상태 설계에 집중하라.

완성된 결과를 /docs/pages/[pagename]/state_management.md 파일로 생성하라
```

### Phase 3: Review Prompt

After generating the state management documents, use this prompt to request user review:

```
✅ **Phase 3 완료: State Management for [pagename]**

다음 파일들이 생성되었습니다:
- `/docs/pages/[pagename]/requirement.md` - {간략한 설명}
- `/docs/pages/[pagename]/state_management.md` - {간략한 설명}

**상태 관리 요약:**
- 관리 상태: {N}개 ({상태 목록})
- Derived 데이터: {M}개
- Actions: {K}개 ({주요 액션 목록})
- 데이터 소스: {API, Local Storage 등}

**주요 설계 결정사항:**
{중요한 결정 1-2가지, 예: "재고 상태는 서버에서만 관리하고 낙관적 업데이트 사용"}

**Flux 패턴 적용:**
- Action → Reducer → State → View 흐름 설계 완료
- Context가 노출하는 인터페이스 정의 완료

**검토 요청사항:**
1. 상태 구조가 페이지의 요구사항을 적절히 반영하나요?
2. Actions가 모든 사용자 상호작용을 포괄하나요?
3. Context 인터페이스가 다른 개발자가 사용하기에 명확한가요?
4. 더 단순화하거나 확장해야 할 상태 관리 로직이 있나요?

👉 `/docs/pages/[pagename]/requirement.md` 및 `state_management.md`를 확인해주세요.

**수정이 필요하신가요?**
- "승인" 또는 "다음 진행" → 커밋 제안 후 다음 페이지 또는 Phase 4로 이동
- 수정 사항 명시 → 문서 업데이트 후 재검토

---

**승인 후 Git 커밋 제안:**

다음 커밋을 생성할까요?

```
docs(state): add state management design for [pagename] page

- Create page requirements documentation
- Define {N} state variables and {M} derived data
- Design Flux pattern with {K} actions
- Implement Context API interface (Level {X})
```

이 커밋을 생성할까요?
- "네" 또는 "커밋" → 커밋 생성 후 다음 진행
- "아니오" 또는 "건너뛰기" → 커밋 없이 다음 진행
```

---

## Phase 4: Implementation Plans

### Feature-Based Plan

Replace `00N` with the actual usecase number.

**🤖 Use Agent**: Launch `caseplan-writer` agent with Task tool

```
Task(
  subagent_type="caseplan-writer",
  description="Create implementation plan for use case {N}",
  prompt="/docs/usecases/00{N}/spec.md의 유스케이스를 구현하기 위한 상세한 계획을 작성하고 /docs/usecases/00{N}/plan.md에 저장해주세요. Hono Backend Guide를 참고하여 backend 모듈도 포함해주세요."
)
```

**Fallback (if not using agent):**
```
@docs/usecases/00N/spec.md 참조

위 유스케이스 문서의 기능을 구현하기위한 최소한의 모듈화 설계 진행하세요.

반드시 다음 순서를 따라야한다.

1. 유스케이스 문서 내용을 통해 자세한 요구사항을 파악한다.
2. 코드베이스에서 관련 파일들을 탐색하여 이미 구현된 기능, convention, guideline 등을 파악한다.
3. 구현해야할 모듈 및 작업위치를 설계한다. AGENTS.md의 코드베이스 구조를 반드시 지킨다. shared로 분리가능한 공통 모듈 및 제네릭을 고려한다.
   완성된 설계를 다음과 같이 구성하여 유스케이스 문서와 같은 경로에 `plan.md`로 저장한다.

- 개요: 모듈 이름, 위치, 간략한 설명을 포함한 목록
- Diagram: mermaid 문법을 사용하여 모듈간 관계를 시각화
- Implementation Plan: 각 모듈의 구체적인 구현 계획. presentation의 경우 qa sheet를, business logic의 경우 unit test를 포함.
```

### Page-Based Plan

Replace `[pageName]` with the actual page name.

**🤖 Use Agent**: Launch `pageplan-writer` agent with Task tool

```
Task(
  subagent_type="pageplan-writer",
  description="Create implementation plan for [pageName]",
  prompt="[pageName] 페이지의 구현 계획을 작성해주세요. 관련된 모든 use case와 state management 문서를 참고하여 /docs/pages/[pageName]/plan.md에 저장해주세요."
)
```

**Fallback (if not using agent):**
```
구현할 페이지: [pageName]

해당 페이지의 기능을 구현하기위한 최소한의 모듈화 설계 진행하세요.

반드시 다음 순서를 따라야한다.

1. `/docs` 경로 하위에 직접 포함된 모든 md 파일을 읽는다.
2. `/docs/usecases` 경로 하위에 포함된, 해당 페이지와 관련된 모든 기능의 spec.md 문서를 읽는다.
   1. 만약 `/docs/pages/[pageName]`에 `state_management.md` 가 존재한다면 참조하라
3. 문서들의 내용을 통해 자세한 요구사항을 파악한다.
4. 코드베이스에서 관련 파일들을 탐색하여 이미 구현된 기능, convention, guideline 등을 파악한다.
5. 구현해야할 모듈 및 작업위치를 설계한다. AGENTS.md의 코드베이스 구조를 반드시 지킨다. shared로 분리가능한 공통 모듈 및 제네릭을 고려한다.
   완성된 설계를 다음과 같이 구성하여 `/docs/pages/[pageName]` 경로에 `plan.md`로 저장한다.

- 개요: 모듈 이름, 위치, 간략한 설명을 포함한 목록
- Diagram: mermaid 문법을 사용하여 모듈간 관계를 시각화
- Implementation Plan: 각 모듈의 구체적인 구현 계획. presentation의 경우 qa sheet를, business logic의 경우 unit test를 포함.
```

### Phase 4: Review Prompt

After generating the implementation plan, use this prompt to request user review:

```
✅ **Phase 4 완료: Implementation Plan**

다음 파일이 생성되었습니다:
- `/docs/usecases/00N/plan.md` 또는 `/docs/pages/[pagename]/plan.md`

**구현 계획 요약:**
- 총 모듈 수: {N}개
  - Frontend: {F}개
  - Backend: {B}개 (Hono 프로젝트인 경우)
  - Shared: {S}개
- 구현 예상 순서: {의존성 기반 순서}

**모듈 구성:**
{주요 모듈 3-5개 나열}

**주요 아키텍처 결정:**
{중요한 결정 1-2가지, 예: "UserCard 컴포넌트를 shared로 분리하여 재사용"}

**Mermaid 다이어그램 시각화:**
👉 다이어그램을 확인하려면 https://mermaid.live/ 에서 렌더링해보세요.

**구현 준비 상태:**
- 모든 모듈의 책임이 명확함
- QA sheets 작성 완료
- Unit test 시나리오 정의 완료
- (Hono 프로젝트) Backend 모듈 구조 정의 완료

**검토 요청사항:**
1. 모듈 구조가 명확하고 논리적인가요?
2. 분할하거나 병합해야 할 모듈이 있나요?
3. QA sheets와 unit tests가 충분한 가이드를 제공하나요?
4. (Hono 프로젝트) Backend 모듈이 올바르게 설계되었나요?
5. 개발자가 이 문서만으로 즉시 코딩을 시작할 수 있나요?

👉 생성된 `plan.md` 파일을 확인해주세요.

**추가 검증:**
- [Validation Checklist](references/validation-checklist.md)를 사용하여 모든 항목이 완료되었는지 확인할 수 있습니다.

**수정이 필요하신가요?**
- "승인" 또는 "구현 시작" → 커밋 제안 후 실제 코드 구현 단계로 진행
- 수정 사항 명시 → 계획 업데이트 후 재검토

---

**승인 후 Git 커밋 제안:**

다음 커밋을 생성할까요?

```
docs(plan): add implementation plan for [feature/page]

- Define {N} modules with clear responsibilities
- Create module dependency diagram
- Add QA sheets for UI components
- Include unit test scenarios for business logic
- Design backend modules (route, service, schema, error)
```

이 커밋을 생성할까요?
- "네" 또는 "커밋" → 커밋 생성 후 구현 시작 가능
- "아니오" 또는 "건너뛰기" → 커밋 없이 구현 시작 가능

**🎉 모든 Phase가 완료되었습니다! 실제 구현을 시작할 수 있습니다!**
```

---

## Usage Tips

### For Generating Documents
1. **Copy the exact prompt** - These prompts are designed to work as-is
2. **Replace placeholders** - Make sure to replace `{N}`, `[pagename]`, etc. with actual values
3. **Sequential execution** - Always complete earlier phases before moving to later ones

### For Review Process
4. **Always use Review Prompts** - After completing each phase, use the corresponding Review Prompt
5. **Wait for approval** - Do not proceed to the next phase without explicit user approval
6. **Be prepared to iterate** - Users may request multiple rounds of revisions
7. **Summarize changes** - When updating documents, clearly explain what was modified
8. **Suggest validation** - Remind users about the validation checklist when appropriate

### User Approval Signals
These phrases indicate user approval to proceed:
- "승인", "Approve", "OK", "확인"
- "다음 단계 진행", "다음 진행", "Next", "Proceed"
- "구현 시작", "Start implementation"
- "LGTM" (Looks Good To Me)

These phrases require revision:
- Specific change requests
- Questions about the document
- "수정", "Modify", "Change", "Update"
- "다시", "Redo", "Revise"
