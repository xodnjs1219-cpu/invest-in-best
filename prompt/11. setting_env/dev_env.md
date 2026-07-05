# 1. 기술스택 초안 정하기(ai스튜디오 사용)

```bash
다음 요구사항을 참고해, 적합한 기술스택 추천해주세요.

반드시 판단 기준을 따르세요.
1. AI가 잘 구현할만한, 인기있는 기술이어야합니다.
2. 믿을만한 기업에 의해 활발히 유지보수되고 있어야합니다.
3. Breaking Change가 잦지않은, 하위호환성이 잘 보장되는 기술이어야합니다.

---

requirment.md 내용 복붙
```

# 2. 페르소나로 검증하기(새로운 세션)

```bash
(적절한 페르소나)

----------------------
아래는 요구사항을 본 주니어 개발자가 정한 기술 스택 내용입니다.
최대한 엄격하게 검증해서 개선점을 제안해주세요
---------------------------
(이전에 제안된 기술 스택)
---------------------------
requirment.md
```

# 3. 기술 스택 문서 최종본(docs\techstack.md에 저장)

```bash
네 좋습니다. 당신의 의견을 반영할게요. 마지막으로 주신 의견을 반영한 최종 보고서를 응답해주세요. 해당 보고서는 AI 코딩 에이전트에게 지침으로서 입력될 것입니다. 간결하게, 프롬프트 엔지니어링 기법을 적용해서 작성해주세요.
```

# 4. Codebase Structure 작성(.ruler)

```bash
다음 기술스택을 참고해, layered architecture와 solid principle을 준수한 codebase structure 제안해주세요.
directory structure, top level building blocks를 포함하세요.

---

사용 기술 스택:
docs\techstack.md

반드시 판단 기준을 따르세요.
1. presentation은 반드시 business logic과 분리되어야합니다.
2. pure business logic은 반드시 persistence layer와 분리되어야합니다.
3. internal logic은 반드시 외부연동 contract, caller와 분리되어야합니다.
4. 하나의 모듈은 반드시 하나의 책임을 가져야합니다.

-------------------------------
.ruler\AGENTS.md의 본래 형식에 맞게 작성해 주세요.
context7-mcp를 사용해 작성하세요
```

# 5. 개발환경 세팅

```bash
@docs\requirment.md
@docs\techstack.md

문서를 참고해서 현재 프로젝트에 필요한 라이브러리 설치나 개발환경을 설정해주세요
그리고 예시 Codebase Structure을 생성해주세요.
```