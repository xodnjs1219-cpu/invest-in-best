# 1. ai 스튜디오에 작성 (docs\test\test_unit.md에 저장)

## 제공해야하는 소스
  1. docs\userflow.md
  2. docs\test\test_plan.md
  3. repomix-output.xml

## 프롬프트
````bash

제공된 코드베이스와 테스트환경을 바탕으로 현재 프로젝트의 상태를 파악하고 단위(Unit) 테스트 구현 계획을 작성하라

아래의 요구사항을 충족하라

1. TDD 방법론 적용(제공된 TDD룰 적용)
2. 단위 테스트 중심: 개별 컴포넌트, 함수, 모듈 중심의 단위 테스트를 계획할 것.
3. 테스트 커버리지: 전체 코드의 70% 이상을 목표로 계획을 수립할 것.
4. 해당 내용을 다각도로 피드백하기위한 AI 페르소나를 작성하세요. 평가할 AI의 역할 및 임무를 자세하게 작성해야합니다.
------------------------------------------------------------------
TDD 룰

# TDD Process Guidelines

## ⚠️ MANDATORY: Follow these rules for EVERY implementation and modification

**This document defines the REQUIRED process for all code changes. No exceptions without explicit team approval.**

## Core Cycle: Red → Green → Refactor

### 1. RED Phase
- Write a failing test FIRST
- Test the simplest scenario
- Verify test fails for the right reason
- One test at a time

### 2. GREEN Phase  
- Write MINIMAL code to pass
- "Fake it till you make it" is OK
- No premature optimization
- YAGNI principle

### 3. REFACTOR Phase
- Remove duplication
- Improve naming
- Simplify structure
- Keep tests passing

## Test Quality: FIRST Principles
- **Fast**: Milliseconds, not seconds
- **Independent**: No shared state
- **Repeatable**: Same result every time
- **Self-validating**: Pass/fail, no manual checks
- **Timely**: Written just before code

## Test Structure: AAA Pattern
```
// Arrange
Set up test data and dependencies

// Act
Execute the function/method

// Assert
Verify expected outcome
```

## Implementation Flow
1. **List scenarios** before coding
2. **Pick one scenario** → Write test
3. **Run test** → See it fail (Red)
4. **Implement** → Make it pass (Green)
5. **Refactor** → Clean up (Still Green)
6. **Commit** → Small, frequent commits
7. **Repeat** → Next scenario

## Test Pyramid Strategy
- **Unit Tests** (70%): Fast, isolated, numerous
- **Integration Tests** (20%): Module boundaries
- **Acceptance Tests** (10%): User scenarios

## Outside-In vs Inside-Out
- **Outside-In**: Start with user-facing test → Mock internals → Implement details
- **Inside-Out**: Start with core logic → Build outward → Integrate components

## Common Anti-patterns to Avoid
- Testing implementation details
- Fragile tests tied to internals  
- Missing assertions
- Slow, environment-dependent tests
- Ignored failing tests

## When Tests Fail
1. **Identify**: Regression, flaky test, or spec change?
2. **Isolate**: Narrow down the cause
3. **Fix**: Code bug or test bug
4. **Learn**: Add missing test cases

## Team Practices
- CI/CD integration mandatory
- No merge without tests
- Test code = Production code quality
- Pair programming for complex tests
- Regular test refactoring

## Pragmatic Exceptions
- UI/Graphics: Manual + snapshot tests
- Performance: Benchmark suites
- Exploratory: Spike then test
- Legacy: Test on change

## Remember
- Tests are living documentation
- Test behavior, not implementation
- Small steps, fast feedback
- When in doubt, write a test

````

# 2. 계획 검증

## 제공해야하는 소스
  1. docs\persona 중 적절한 것
  2. docs\test\test_unit.md
  3. .ruler\tdd.md
  4. repomix-output.xml
  5. docs\userflow.md

## 프롬프트
```bash
(페르소나)

--------------------------------------------------

`docs\test\test_Unit.md`를 참조하여 단위 테스트 계획을 리뷰하고, 다음 기준을 바탕으로 간결하게 개선점을 제공해

1. 독립성이 유지되고 있는지,
2. 주요 함수·로직의 핵심 동작 검증에 집중됐는지,
3. 외부 시스템 결합이나 불필요한 복잡성이 포함되어 있는지,
4. 테스트 케이스가 명확하고 단순하게 작성됐는지,
5. 테스트 커버리지 집착 등 불필요한 부분이 없는지,

한눈에 보기 쉽도록 불필요한 점, 필수 개선점을 구분해서 작성해
```

# 3. 최종 구현 계획 작성 (docs\test\test_unit.md 업데이트)

## 프롬프트
```bash
개선점을 적용해서 최종 구현 계획을 작성하라
아래의 형식을 따라라

---------------------------------------------------

## 단위 테스트 구현 계획 (TDD 기반)

## 1. 개요
- 본 테스트 계획의 목적과 범위
- TDD 방법론을 적용한 단위 테스트의 접근 방식 요약

## 2. 테스트 범위
- `docs/userflow.md`,  `docs/usecases/**`를 기반으로 테스트할 주요 모듈, 클래스 및 함수 명시
- 테스트에서 제외할 범위 명시

## 3. 테스트 전략
- **TDD 워크플로우:** 테스트 케이스 작성, 실패 확인, 코드 구현, 테스트 통과, 리팩토링의 구체적인 절차
- **테스트 환경:** `docs/test/test_plan.md`에 명시된 테스트 환경 및 도구(Mocking 라이브러리 포함) 활용 방안
- **데이터 관리:** 테스트 케이스에 필요한 데이터 준비 및 관리 방안

## 4. 주요 테스트 케이스
- `docs/userflow.md`의 기능 명세를 기반으로 도출된 핵심 단위 테스트 케이스 목록
- (예시)
    - **Test Case 1: 이메일 형식 검증 함수 (`isValidEmail`)**
      - **시나리오:** `isValidEmail` 함수에 유효한 이메일, 잘못된 형식의 이메일, null, 빈 문자열 등 다양한 경계값을 입력한다.
      - **기대 결과:** 유효한 형식에는 `true`를, 그 외 모든 경우에는 `false`를 반환한다.
      - **전제 조건:** 없음 (순수 함수)

## 5. 테스트 커버리지 목표 (70% 이상)
- **측정 방법:** 사용할 테스트 커버리지 측정 도구 및 기준(예: 라인 커버리지, 브랜치 커버리지)
- **목표 달성 전략:** 핵심 로직 및 분기문, 예외 케이스를 중심으로 커버리지를 높일 수 있는 구체적인 테스트 작성 계획

## 6. 일정 및 리소스
- 각 테스트 케이스 구현 및 실행에 대한 예상 일정
- 투입될 리소스 및 역할 분담 계획

## 7. 리스크 및 완화 방안
- 테스트 과정에서 발생할 수 있는 잠재적 리스크(예: 복잡한 의존성으로 인한 테스트 작성의 어려움, 리팩토링 시 테스트 코드 유지보수 비용 증가)
- 각 리스크에 대한 사전 대응 및 완화 전략
```

# 4. 구현

## 프롬프트(레거시 프로젝트를 리팩토링할때)

```bash
docs\test\test_unit.md 를 참조
현재 프로젝트가 모든 테스트를 통과할 때까지 테스트 코드를 작성하라
- 모두 구현할때까지 멈추지말고 진행하라
- type, lint, build에러가 없음을 보장하라

```