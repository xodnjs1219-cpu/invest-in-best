import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http/api-client";
import { relationTypeErrorMessage } from "./relationTypeErrorMessage";

describe("relationTypeErrorMessage (M10)", () => {
  it("409 RELATION_TYPE_NAME_DUPLICATE는 중복 안내 문구를 반환한다", () => {
    const error = new ApiError("RELATION_TYPE_NAME_DUPLICATE", 409, "중복");
    expect(relationTypeErrorMessage(error)).toContain("이미 존재하는");
  });

  it("404 RELATION_TYPE_NOT_FOUND는 새로고침 유도 문구를 반환한다", () => {
    const error = new ApiError("RELATION_TYPE_NOT_FOUND", 404, "없음");
    expect(relationTypeErrorMessage(error)).toContain("새로고침");
  });

  it("500 INTERNAL_ERROR는 재시도 유도 문구를 반환한다", () => {
    const error = new ApiError("INTERNAL_ERROR", 500, "서버 오류");
    expect(relationTypeErrorMessage(error)).toContain("다시 시도");
  });

  it("네트워크 오류(NETWORK_ERROR)는 재시도 유도 문구를 반환한다", () => {
    const error = new ApiError("NETWORK_ERROR", 0, "네트워크 오류");
    expect(relationTypeErrorMessage(error)).toContain("다시 시도");
  });

  it("미지 코드는 기본 문구를 반환한다", () => {
    const error = new ApiError("SOME_UNKNOWN_CODE", 400, "알 수 없음");
    expect(relationTypeErrorMessage(error).length).toBeGreaterThan(0);
  });

  it("VALIDATION_ERROR는 필드 오류 위임 문구를 반환한다", () => {
    const error = new ApiError("VALIDATION_ERROR", 400, "검증 실패");
    expect(relationTypeErrorMessage(error).length).toBeGreaterThan(0);
  });
});
