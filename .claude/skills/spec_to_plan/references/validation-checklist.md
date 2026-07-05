# Validation Checklist

각 Phase의 산출물을 승인하기 전에 아래 체크리스트로 검증한다.
모든 항목이 충족되어야 다음 Phase로 진행할 수 있다.

---

## Phase 1: Database Schema (`/docs/database.md`, 마이그레이션 파일)

**데이터 범위**
- [ ] 유저플로우에 명시적으로 등장한 데이터만 포함되었는가 (추측성 필드 없음)
- [ ] 외부 서비스 연동 데이터 요구사항(`/docs/external/*.md`)이 반영되었는가
- [ ] MVP에 불필요한 테이블/컬럼이 없는가

**문서 구성**
- [ ] 데이터플로우 다이어그램이 스키마보다 먼저 제시되었는가
- [ ] 테이블 간 관계(FK)가 명확히 문서화되었는가

**마이그레이션 (Supabase/PostgreSQL 스택인 경우 — `.ruler/supabase.md` 준수)**
- [ ] 파일명에 번호 접두사가 있는가 (예: `0001_create_users_table.sql`)
- [ ] 멱등성이 보장되는가 (`CREATE TABLE IF NOT EXISTS` 등)
- [ ] 모든 테이블에 `updated_at` 컬럼과 갱신 트리거가 있는가
- [ ] RLS가 비활성화되었는가 (모든 테이블)
- [ ] 식별자가 snake_case인가
- [ ] 컬럼 타입이 명시적으로 지정되었는가

## Phase 2: Use Cases (`/docs/usecases/00N/spec.md`)

**필수 섹션 (6종)**
- [ ] Primary Actor
- [ ] Precondition (사용자 관점만)
- [ ] Trigger
- [ ] Main Scenario (번호 매긴 단계)
- [ ] Edge Cases (에러 처리 포함)
- [ ] Business Rules

**Business Rules 세부**
- [ ] API Specification: 엔드포인트, Request/Response 스키마, 에러 코드
- [ ] Database Operations: 사용 테이블과 연산(INSERT/SELECT/UPDATE/DELETE)
- [ ] 외부 연동이 있으면 External Service Integration 항목 존재

**Sequence Diagram**
- [ ] PlantUML 표준 문법 (비표준 구분선/마킹 없음)
- [ ] BE 계층이 techstack의 아키텍처 계층대로 세분화되었는가
- [ ] 외부 서비스가 있으면 별도 participant로 표시되었는가
- [ ] 검증/변환/에러 흐름이 포함되었는가
- [ ] 구현 코드가 포함되지 않았는가 (스펙 문서는 구현 무관)

## Phase 3: State Management (`/docs/pages/[page]/requirement.md`, `state_management.md`)

**공통**
- [ ] 관리 상태와 파생/표시 전용 데이터가 분리되었는가
- [ ] 상태 전환 테이블(변경 조건 + UI 반영)이 있는가
- [ ] 상태가 최소한인가 (오버엔지니어링 없음)

**Level별 산출 범위**
- [ ] Level 1 (6-10점): requirement.md + 상태 정의/전환 테이블만
- [ ] Level 2 (11-15점): + Flux 패턴 (Action/Reducer/View), Context 없음
- [ ] Level 3 (16+점): + Context 설계 (노출 인터페이스 포함)

**Flux/Context (Level 2+)**
- [ ] Action 이름이 명확하고 일관적인가
- [ ] Reducer 로직이 단순하고 테스트 가능한가
- [ ] (Level 3) Context 인터페이스에 노출 변수/함수가 정의되었는가

## Phase 4: Implementation Plan (`plan.md`)

**형식 (`prompt/6. plan/plan.md` 템플릿 준수)**
- [ ] 개요: 모듈 이름/위치/설명 목록
- [ ] Diagram: mermaid로 모듈 간 관계 시각화
- [ ] Implementation Plan: 모듈별 구체적 계획

**내용**
- [ ] 모듈 위치가 techstack.md의 Codebase Structure(없으면 AGENTS.md)를 준수하는가
- [ ] shared/공통 모듈이 식별되었는가 (DRY)
- [ ] 각 모듈이 단일 책임을 가지는가
- [ ] Presentation 모듈마다 QA Sheet가 있는가
- [ ] Business Logic 모듈마다 Unit Test 시나리오가 있는가
- [ ] 백엔드 모듈이 계층별로 설계되었는가 (스택의 계층 구조 준수)
- [ ] 외부 연동 모듈에 에러 처리/재시도/타임아웃/환경변수 관리가 포함되었는가
- [ ] 개발자가 이 계획만으로 즉시 구현을 시작할 수 있는가
