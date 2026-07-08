/**
 * chain-editor 검증 순수 함수 (UC-013 plan 모듈 4, state_management.md §4.3).
 * FE 즉시 검증과 서버(UC-018) 최종 검증이 이 파일의 함수를 공유한다(검증 이중화, 구현 단일화).
 * 본 파일은 UC-013 분량(`validateChainNameFormat`)만 구현한다.
 *
 * 확장 지점(후속 plan이 이 파일에 추가):
 * - UC-015: validateListedNodeAdd, validateFreeSubjectAdd
 * - UC-016: validateEdgeCandidate
 * - UC-017: validateGroupCreate
 * - UC-018: collectClientIssues(저장 전 사전 검증 일괄 실행)
 */

/** 이름 형식 검증 — trim 후 빈 문자열이면 NAME_REQUIRED (spec E3: 진입 단계는 공백/형식만, 중복은 UC-018 서버 검증). */
export function validateChainNameFormat(name: string): "NAME_REQUIRED" | null {
  return name.trim().length === 0 ? "NAME_REQUIRED" : null;
}
