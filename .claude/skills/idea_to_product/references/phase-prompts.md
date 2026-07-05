# Phase별 Task 프롬프트 템플릿

idea_to_product 파이프라인에서 서브에이전트를 실행할 때 사용하는 프롬프트 모음.
`{ }` 부분을 실제 값으로 치환해 사용한다.

---

## Phase 1: PRD

```
Task(
  subagent_type="prd_writer",
  description="PRD 문서 작성",
  prompt="docs/requirement.md의 확정된 요구사항을 기반으로 PRD를 작성하고 docs/prd.md에 저장해주세요. 모호한 사항은 Open Questions 목록으로 반환해주세요."
)
```

재실행(Open Questions 답변 반영):

```
Task(
  subagent_type="prd_writer",
  description="PRD 문서 보완",
  prompt="docs/prd.md를 다음 답변을 반영해 보완해주세요.\n\n{질문: 답변 목록}"
)
```

## Phase 2: 유저플로우

```
Task(
  subagent_type="userflow_writer",
  description="유저플로우 문서 작성",
  prompt="docs/requirement.md와 docs/prd.md를 기반으로 모든 기능의 유저플로우를 작성하고 docs/userflow.md에 저장해주세요. 각 기능에 번호를 부여하고, 모호한 사항은 Open Questions 목록으로 반환해주세요."
)
```

## Phase 2.5: 외부연동 조사 (서비스별)

```
Task(
  subagent_type="external_researcher",
  description="{서비스명} 연동 조사",
  prompt="{서비스명} 연동 스펙을 조사해 docs/external/{서비스명}.md를 작성해주세요. 프로젝트 맥락: {requirement.md의 연동 관련 내용 요약}. 오늘 날짜는 {YYYY년 M월 D일}입니다."
)
```

## Phase 3: 기술스택

```
Task(
  subagent_type="techstack_selector",
  description="기술스택 선정",
  prompt="docs/requirement.md와 docs/external/ 문서들을 기반으로 기술스택을 선정하고 docs/techstack.md 초안을 작성해주세요. Codebase Structure와 빌드/린트/테스트 명령어를 반드시 포함해주세요."
)
```

재실행(사용자가 다른 스택 요청 시):

```
Task(
  subagent_type="techstack_selector",
  description="기술스택 재선정",
  prompt="docs/techstack.md를 다음 조건을 반영해 다시 작성해주세요: {사용자 요청 조건}. 조건과 충돌하는 판단 기준이 있다면 문서의 선정 근거에 트레이드오프를 명시해주세요."
)
```

## Phase 4: 데이터베이스

```
Task(
  subagent_type="database_writer",
  description="데이터베이스 스키마 설계",
  prompt="docs/prd.md, docs/userflow.md, docs/techstack.md, 그리고 docs/external/ 디렉토리의 모든 파일을 참조하여 데이터베이스 스키마를 설계하고 docs/database.md와 migration을 생성해주세요."
)
```

## Phase 5: 유스케이스 (기능별, 독립 기능은 병렬)

```
Task(
  subagent_type="usecase_writer",
  description="기능 {N} 유스케이스 작성",
  prompt="docs/userflow.md의 {N}번 기능에 대한 상세 유스케이스를 작성하고 docs/usecases/00{N}/spec.md에 저장해주세요. API 명세를 포함해주세요."
)
```

## Phase 7: 상태관리 (선택된 페이지별)

```
Task(
  subagent_type="status_management_writer",
  description="{페이지명} 상태관리 설계",
  prompt="{페이지명} 페이지에 대한 상태 관리 문서를 작성해주세요. Level {N} 수준으로 작성하며, docs/pages/{페이지명}/requirement.md와 state_management.md를 생성해주세요."
)
```

## Phase 8: 구현계획

기능 기반:

```
Task(
  subagent_type="caseplan_writer",
  description="유스케이스 {N} 구현계획 작성",
  prompt="docs/usecases/00{N}/spec.md의 유스케이스를 구현하기 위한 상세한 계획을 작성하고 docs/usecases/00{N}/plan.md에 저장해주세요."
)
```

페이지 기반:

```
Task(
  subagent_type="pageplan_writer",
  description="{페이지명} 구현계획 작성",
  prompt="{페이지명} 페이지의 구현 계획을 작성해주세요. 관련된 모든 use case와 state management 문서를 참고하여 docs/pages/{페이지명}/plan.md에 저장해주세요."
)
```

게이트 전 선검증:

```
Task(
  subagent_type="plan_checker",
  description="구현계획 {N} 선검증",
  prompt="docs/usecases/00{N}/spec.md와 docs/usecases/00{N}/plan.md를 읽고, plan이 spec의 모든 요구사항을 커버하는지 문서 수준에서 점검해주세요. (아직 구현 전이므로 코드베이스 점검은 생략하고 문서 간 정합성만 확인)"
)
```

## Phase 9: 환경설정

```
Task(
  subagent_type="env_setupper",
  description="개발/테스트 환경 구축",
  prompt="docs/techstack.md와 docs/requirement.md를 기반으로 프로젝트 개발/테스트 환경을 구축해주세요. 모든 빌드/린트/테스트 명령이 통과해야 합니다."
)
```

## Phase 10: 구현 (유닛별)

```
Task(
  subagent_type="implementer",
  description="{기능명/페이지명} 구현",
  prompt="docs/prd.md, docs/userflow.md, docs/database.md, docs/techstack.md, {spec.md 경로}, {plan.md 경로} 문서들을 기반으로 '{기능명/페이지명}'을 구현해주세요. .ruler/tdd.md의 TDD 사이클을 준수해주세요."
)
```

재시도(검증 실패 시, 최대 3회):

```
Task(
  subagent_type="implementer",
  description="{기능명/페이지명} 구현 수정 ({M}차 재시도)",
  prompt="'{기능명/페이지명}' 구현이 다음 검증에서 실패했습니다. 원인을 파악하고 수정해주세요.\n\n실행 명령: {명령어}\n에러 출력:\n{에러 로그}"
)
```

## Phase 11: 검증 (병렬)

```
Task(
  subagent_type="implement_checker",
  description="전체 구현 점검",
  prompt="docs/usecases/ 하위의 모든 기능에 대해 정상 구현 여부를 확인하고 루트에 implement-check-report.md를 생성해주세요."
)
```

```
Task(
  subagent_type="plan_checker",
  description="유스케이스 {N} 구현 검증",
  prompt="docs/usecases/00{N}/의 spec.md와 plan.md를 기준으로 코드베이스의 구현 완성도를 점검하고 같은 경로에 plan-check-report.md를 생성해주세요."
)
```
