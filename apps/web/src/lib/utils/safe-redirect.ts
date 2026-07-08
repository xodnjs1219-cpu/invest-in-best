/**
 * 내부 경로 리다이렉트 가드 — 오픈 리다이렉트 방지 (UC-001/002/003 공유).
 * 허용: `/`로 시작하는 상대 경로. 차단: `//`, 백슬래시, 스킴 포함(`http:`, `javascript:` 등).
 */
export const sanitizeReturnTo = (raw: string | null | undefined, fallback = "/"): string => {
  if (!raw) {
    return fallback;
  }
  if (!raw.startsWith("/")) {
    return fallback;
  }
  if (raw.startsWith("//")) {
    return fallback;
  }
  if (raw.includes("\\")) {
    return fallback;
  }
  return raw;
};
