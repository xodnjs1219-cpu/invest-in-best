import type { ApiError } from "@/lib/http/api-client";
import { FIELD_ERROR_MESSAGES, TOAST_MESSAGES } from "@/features/admin-relation-types/constants";

/**
 * ApiError → 사용자 안내 문구 순수 매핑 함수(M10). 오류 코드별로 안내 문구를 분기한다.
 * 409 → 중복 안내(필드 오류로도 함께 표시됨, M12 QA-5), 404 → 목록 새로고침 유도(E6, 호출측이
 * invalidate 병행), 500·네트워크 → 재시도 유도(E11), 미지 코드 → 기본 재시도 문구.
 */
export const relationTypeErrorMessage = (error: ApiError): string => {
  switch (error.code) {
    case "RELATION_TYPE_NAME_DUPLICATE":
      return FIELD_ERROR_MESSAGES.nameDuplicate;
    case "RELATION_TYPE_NOT_FOUND":
      return TOAST_MESSAGES.notFoundRetry;
    case "VALIDATION_ERROR":
      return FIELD_ERROR_MESSAGES.nameRequired;
    default:
      return TOAST_MESSAGES.retryGuidance;
  }
};
