/**
 * UC-008 검색 오류 코드 → 사용자 문구 순수 매핑.
 * `securitiesSearchErrorCodes`(backend/error.ts)와 문자열 리터럴로 대응한다(FE는 타입만이 아닌 코드 문자열을 받는다 — apiFetch의 ApiError.code).
 */
const SEARCH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_QUERY: "검색어를 확인해 주세요.",
  TOO_MANY_REQUESTS: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
};

const DEFAULT_MESSAGE = "일시적인 오류가 발생했습니다. 다시 시도해주세요.";

export function getSearchErrorMessage(code?: string): string {
  if (!code) {
    return DEFAULT_MESSAGE;
  }
  return SEARCH_ERROR_MESSAGES[code] ?? DEFAULT_MESSAGE;
}
