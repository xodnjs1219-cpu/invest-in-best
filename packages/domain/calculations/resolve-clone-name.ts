import { CLONE_NAME_SUFFIX_START } from "../constants/limits";

/**
 * 복제본 이름 결정 (UC-014 spec Main 8·Edge 3·BR-5, plan 모듈 2).
 * 동일 사용자 내 이름 충돌 시 자동 접미어 " (n)"을 부여한다(D-4).
 * 순수 함수 — 입력만으로 결과 결정, 부수효과 없음. 비교는 대소문자 구분 완전 일치
 * (DB `uq_value_chains_owner_name`가 exact text 비교이므로 동일 기준).
 */
export function resolveCloneName(baseName: string, existingNames: readonly string[]): string {
  const existingSet = new Set(existingNames);

  if (!existingSet.has(baseName)) {
    return baseName;
  }

  let suffix = CLONE_NAME_SUFFIX_START;
  let candidate = `${baseName} (${suffix})`;
  while (existingSet.has(candidate)) {
    suffix += 1;
    candidate = `${baseName} (${suffix})`;
  }
  return candidate;
}
