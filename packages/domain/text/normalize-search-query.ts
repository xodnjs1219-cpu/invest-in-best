/**
 * 검색어 정규화 (UC-008 spec §Business Rules — 입력 정규화).
 * FE(useDebouncedQueryCommit)와 BE(securities service)가 동일 함수를 공유한다(DRY).
 *
 * - Unicode NFKC 정규화: 전각 영숫자·전각 공백(U+3000) 등을 반각 대응 문자로 변환.
 * - trim(): 앞뒤 공백 제거(NFKC 변환 후 수행하므로 U+3000도 표준 공백으로 trim됨).
 * - 대소문자는 변환하지 않는다 — 대소문자 무시 매칭은 서버 `ILIKE`의 책임이다.
 */
export function normalizeSearchQuery(raw: string): string {
  return raw.normalize("NFKC").trim();
}
