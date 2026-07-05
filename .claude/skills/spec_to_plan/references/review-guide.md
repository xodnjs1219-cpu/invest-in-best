# Review & Approval Guide

This guide explains the review process for spec_to_plan workflow.

---

## Why Review Cycles Matter

### Without Reviews:
❌ Documents may not match user expectations
❌ Errors compound across phases
❌ Implementation starts with incorrect assumptions
❌ Costly rework required

### With Reviews:
✅ Continuous alignment with user intent
✅ Early error detection
✅ Clear approval gates
✅ Confidence before implementation

---

## Review Process Flow

```
Phase 1: Database Schema
    ↓ (generate)
Review & Approval
    ↓ (approve)
Phase 2: Use Cases
    ↓ (generate)
Review & Approval
    ↓ (approve)
Phase 3: State Management
    ↓ (generate)
Review & Approval
    ↓ (approve)
Phase 4: Implementation Plan
    ↓ (generate)
Final Review & Approval
    ↓ (approve)
Implementation
```

**Key Principle**: Never proceed to the next phase without explicit user approval.

---

## Review Checklist by Phase

### Phase 1: Database Schema

**Quick Checks:**
- [ ] Data flow diagram matches mental model
- [ ] All entities from userflow are present
- [ ] No over-engineering (MVP-focused)
- [ ] Relationships are correct (1:1, 1:N, M:N)
- [ ] Migration SQL is syntactically valid

**Approval Questions:**
- Can you visualize how data flows through the system?
- Are there any missing or extra entities?
- Is this simple enough for MVP?

---

### Phase 2: Use Cases

**Quick Checks:**
- [ ] Main Scenario is complete and accurate
- [ ] Edge cases cover common failures
- [ ] Business rules are clear
- [ ] Sequence diagram renders correctly
- [ ] API specification is included (Hono projects)

**Approval Questions:**
- Does the flow match how you imagine the feature working?
- Are there any scenarios we missed?
- Is the API contract clear?

**Common Issues:**
- Main Scenario too long (>10 steps) → Split into multiple use cases
- Vague business rules → Ask for specifics
- Missing error handling → Add edge cases

---

### Phase 3: State Management

**Quick Checks:**
- [ ] State vs. Derived data separation is clear
- [ ] Actions cover all user interactions
- [ ] Reducer logic is understandable
- [ ] Context interface is developer-friendly

**Approval Questions:**
- Does the state structure feel natural?
- Are actions granular enough without being excessive?
- Can another developer use this Context easily?

**Common Issues:**
- Over-engineering state → Simplify to essentials
- Derived data in state → Move to selectors/computed
- Unclear action names → Use verb-object pattern (FETCH_USERS, CREATE_TODO)

---

### Phase 4: Implementation Plan

**Quick Checks:**
- [ ] All modules have clear responsibilities
- [ ] Module structure follows CLAUDE.md guidelines
- [ ] QA sheets are comprehensive
- [ ] Unit tests are actionable
- [ ] Mermaid diagram visualizes dependencies
- [ ] Backend modules designed (Hono projects)

**Approval Questions:**
- Is the module structure logical?
- Can you start coding immediately with this plan?
- Are there any modules that feel too large or too small?

**Common Issues:**
- God modules (too many responsibilities) → Split
- Unclear dependencies → Clarify with diagram
- Missing QA/test scenarios → Add specifics

---

## How to Provide Feedback

### ✅ Good Feedback Examples

**Specific and Actionable:**
```
"In the User table, add an 'email_verified' boolean field
to track verification status."
```

**Clear Request:**
```
"The main scenario is missing a step for password validation.
Please add it between steps 3 and 4."
```

**Reasoning Included:**
```
"Let's split the 'userProfile' state into 'user' and 'preferences'
so we can update preferences without reloading the entire profile."
```

### ❌ Vague Feedback Examples

**Too General:**
```
"This doesn't look right."
→ Better: Specify what doesn't look right and why
```

**Implicit Assumptions:**
```
"Add the usual fields."
→ Better: List the specific fields needed
```

**No Direction:**
```
"I'm not sure about this."
→ Better: Ask specific questions or request alternatives
```

---

## Approval Signals

### Clear Approval
Use these phrases to approve and proceed:
- "승인" / "Approve" / "OK" / "LGTM"
- "다음 단계 진행" / "Next phase" / "Proceed"
- "구현 시작" / "Start implementation"

### Request Revision
Use these patterns:
- "수정: [specific change]"
- "[Question about unclear part]"
- "대신 [alternative] 하면 어떨까요?"

---

## Iterative Refinement

It's normal to go through multiple review cycles:

**Iteration 1**: Initial draft → Major structural feedback
**Iteration 2**: Revised version → Detail-level feedback
**Iteration 3**: Polished version → Final approval

**Tip**: Don't aim for perfection in iteration 1. Get the structure right first, then refine details.

---

## Using Validation Checklists

Before approving, use the [Validation Checklist](validation-checklist.md):

1. Open the checklist for the current phase
2. Go through each item systematically
3. Note any unchecked items
4. Request fixes or approve if all items check out

**Example:**
```
Phase 2 완료 후:

- [x] Primary Actor 명시됨
- [x] Main Scenario 완전함
- [ ] Sequence Diagram alt 블록 누락 ← 수정 필요
- [x] Business Rules 명확함

→ "Sequence Diagram에 alt 블록 추가 후 재검토 부탁드립니다."
```

---

## Common Review Scenarios

### Scenario 1: Everything Looks Good
```
User: "LGTM! 다음 진행해주세요."
Assistant: "감사합니다! Phase 3: State Management를 시작하겠습니다."
```

### Scenario 2: Minor Changes Needed
```
User: "대부분 좋은데, User 테이블에 'created_at' 필드 추가해주세요."
Assistant: "알겠습니다. User 테이블에 created_at 추가하겠습니다."
(파일 수정)
Assistant: "수정 완료했습니다. 다시 확인 부탁드립니다."
```

### Scenario 3: Major Rework Required
```
User: "접근 방식을 완전히 바꿔야 할 것 같아요.
      [새로운 요구사항 설명]"
Assistant: "알겠습니다. 새 요구사항 반영하여 처음부터 다시 작성하겠습니다."
(새로 작성)
Assistant: "새로운 접근으로 다시 작성했습니다. 확인 부탁드립니다."
```

### Scenario 4: Unclear Requirements
```
Assistant: "Review 중 불명확한 부분이 있습니다:
           1. '사용자 권한'이 role 기반인지 permission 기반인지?
           2. 파일 업로드 최대 크기는?
           명확히 해주시면 반영하겠습니다."
User: "Role 기반이고, 최대 10MB입니다."
Assistant: "감사합니다. 반영하여 수정하겠습니다."
```

---

## Best Practices

### For Users:
1. **Be timely**: Review within a reasonable timeframe
2. **Be specific**: Point out exactly what needs changing
3. **Be constructive**: Explain why changes are needed
4. **Ask questions**: If unclear, ask for clarification
5. **Use checklists**: Validate with provided checklists

### For AI Assistant:
1. **Wait patiently**: Don't rush users to approve
2. **Summarize well**: Make reviews easy with clear summaries
3. **Accept feedback gracefully**: Don't defend, just improve
4. **Track changes**: Clearly state what was modified
5. **Suggest improvements**: Proactively point out potential issues

---

## Troubleshooting

### "I don't know what to look for"
→ Use the [Validation Checklist](validation-checklist.md) as a guide

### "Everything seems fine but I'm not confident"
→ Ask specific questions:
- "Does this handle [edge case]?"
- "What happens if [scenario]?"

### "The document is too long to review"
→ Focus on:
1. Overview/Summary first
2. Critical sections (Business Rules, API specs)
3. Diagrams (visual check)
4. Sample module (in Phase 4)

### "I want to compare with similar features"
→ Ask:
- "Can you show me how [similar feature] was designed?"
- "What's different from [reference]?"

---

## Summary

**Review Cycle = Quality Gate**

Each review is an opportunity to:
- Catch misunderstandings early
- Refine design decisions
- Build confidence for implementation

**Never skip reviews to save time** - the time saved will be lost in rework.

**Approval is not forever** - you can always revisit if issues arise during implementation.

---

## Related Resources

- [SKILL.md](../SKILL.md) - Main workflow documentation
- [validation-checklist.md](validation-checklist.md) - Detailed validation criteria
- [prompt-templates.md](prompt-templates.md) - Review prompts for each phase
