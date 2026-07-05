구현할 페이지: pageName

해당 페이지의 기능을 구현하기위한 최소한의 모듈화 설계 진행하세요.

반드시 다음 순서를 따라야한다.

1. `/docs` 경로 하위에 직접 포함된 모든 md 파일을 읽는다.
2. `/docs/usecases` 경로 하위에 포함된, 해당 페이지와 관련된 모든 기능의 spec.md 문서를 읽는다.
   1. 만약 `/docs/pages/pageName`에 `state_management.md` 가 존재한다면 참조하라
3. 문서들의 내용을 통해 자세한 요구사항을 파악한다.
4. 코드베이스에서 관련 파일들을 탐색하여 이미 구현된 기능, convention, guideline 등을 파악한다.
5. 구현해야할 모듈 및 작업위치를 설계한다. AGENTS.md의 코드베이스 구조를 반드시 지킨다. shared로 분리가능한 공통 모듈 및 제네릭을 고려한다.
   완성된 설계를 다음과 같이 구성하여 `/docs/pages/[pageName]` 경로에 `plan.md`로 저장한다.

- 개요: 모듈 이름, 위치, 간략한 설명을 포함한 목록
- Diagram: mermaid 문법을 사용하여 모듈간 관계를 시각화
- Implementation Plan: 각 모듈의 구체적인 구현 계획. presentation의 경우 qa sheet를, business logic의 경우 unit test를 포함.