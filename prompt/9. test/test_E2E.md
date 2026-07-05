# 1. ai 스튜디오에 작성 (docs\test\test_E2E.md에 저장)

## 제공해야하는 소스
  1. docs\prd.md
  2. docs\requirment.md
  3. repomix-output.xml
  4. docs\test\test_plan.md

## 프롬프트

````bash
제공된 코드베이스와 테스트환경을 바탕으로 현재 프로젝트의 상태를 파악하고 E2E(End-to-End) 테스트 구현 계획을 작성하라

아래의 요구사항을 충족하라
1.  TDD 방법론 적용(제공된 TDD rule 참고)
2.  E2E 테스트 중심: 사용자 시나리오 기반의 종단 간 테스트를 계획할 것.
3.  테스트 커버리지: 전체 코드의 70% 이상을 목표로 계획을 수립할 것.
4.  해당 내용을 다각도로 피드백하기위한 AI 페르소나를 작성하세요. 평가할 AI의 역할 및 임무를 자세하게 작성해야합니다.
-----------------------------
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
  2. docs\test\test_E2E.md
  3. .ruler\tdd.md
  4. repomix-output.xml
  5. docs\requirment.md, docs\prd.md

## 프롬프트
```bash
(페르소나)

--------------------------------------------------

제공된 구현 계획을 참조하여 E2E 테스트 계획을 리뷰하고, 다음 기준을 바탕으로 간결하게 개선점을 제공해

1. 필수 시나리오 중심으로 구성되어 있는지,
2. 케이스 간 독립성과 환경 격리가 잘 되어 있는지,
3. 테스트 범위가 과도하게 넓거나 비효율적인 부분이 있는지,
4. UI 또는 외부 변경에 과도하게 의존하는 케이스가 포함됐는지,
5. 자동화 도구·병렬 실행 등 실행 효율성을 충분히 고려했는지,
6. TDD 방법론을 따랐는지(제공된 tdd룰 참조)

한눈에 보기 쉽도록 불필요한 점, 필수 개선점을 구분해서 작성해

----------------------------------------------------
(구현계획)

```

# 3. 최종 구현 계획 작성 (docs\test\test_E2E.md 업데이트)

## 프롬프트
```bash
개선점을 적용해서 최종 구현 계획을 작성하라
아래의 형식을 따라라

---------------------------------------------------

## E2E 테스트 구현 계획 (TDD 기반)

## 1. 개요
- 본 테스트 계획의 목적과 범위
- TDD 방법론을 적용한 E2E 테스트의 접근 방식 요약

## 2. 테스트 범위
- 코드베이스를 기반으로 테스트할 주요 기능 및 사용자 시나리오 명시
- 테스트에서 제외할 범위 명시

## 3. 테스트 전략
- **TDD 워크플로우:** 테스트 케이스 작성, 실패 확인, 코드 구현, 테스트 통과, 리팩토링의 구체적인 절차
- **테스트 환경:** 코드베이스에 명시된 테스트 환경 및 도구 활용 방안
- **데이터 관리:** 테스트 데이터 준비 및 관리 방안

## 4. 주요 테스트 케이스
- 제공된 requirment.md의 요구사항을 기반으로 도출된 핵심 E2E 테스트 케이스 목록
- (예시)
    - **Test Case 1: 신규 사용자 가입 및 로그인 플로우**
      - **시나리오:** 사용자가 회원가입 페이지에 접속하여 정보를 입력하고, 가입을 완료한 뒤 해당 정보로 로그인하여 메인 페이지에 접근한다.
      - **기대 결과:** 사용자 계정이 성공적으로 생성되고, 로그인 후 정상적으로 메인 페이지로 이동한다.
      - **전제 조건:** 테스트용 이메일 계정 준비

## 5. 테스트 커버리지 목표 (70% 이상)
- **측정 방법:** 사용할 테스트 커버리지 측정 도구 및 기준(예: 라인 커버리지, 브랜치 커버리지)
- **목표 달성 전략:** 주요 기능 및 예외 케이스를 중심으로 커버리지를 높일 수 있는 구체적인 테스트 작성 계획

## 6. 일정 및 리소스
- 각 테스트 케이스 구현 및 실행에 대한 예상 일정
- 투입될 리소스 및 역할 분담 계획

## 7. 리스크 및 완화 방안
- 테스트 과정에서 발생할 수 있는 잠재적 리스크(예: 환경 불안정성, 요구사항 변경)
- 각 리스크에 대한 사전 대응 및 완화 전략
```

# 4. 구현

## 프롬프트(레거시 프로젝트를 리팩토링할때)

```bash
docs\test\test_E2E.md 를 참조
현재 프로젝트가 모든 테스트를 통과할 때까지 테스트 코드를 작성하라
- 모두 구현할때까지 멈추지말고 진행하라
- type, lint, build에러가 없음을 보장하라
```