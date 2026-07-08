import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http/api-client";
import { classifySaveError, normalizeSaveErrorToIssues } from "./saveIssues";

describe("normalizeSaveErrorToIssues", () => {
  it("422 INVALID_EDGE + 호출측 판별 targets(clientEdgeIds=[e1,e2]) → ServerIssue 1건, targets에 e1·e2", () => {
    const error = new ApiError("VALUECHAINS.INVALID_EDGE", 422, "엣지 오류");
    const issues = normalizeSaveErrorToIssues(error, { clientEdgeIds: ["e1", "e2"] });
    expect(issues).not.toBeNull();
    expect(issues![0]?.targets.clientEdgeIds).toEqual(["e1", "e2"]);
  });

  it("409 DUPLICATE_NAME → targets.field='name'", () => {
    const error = new ApiError("VALUECHAINS.DUPLICATE_NAME", 409, "이름 중복");
    const issues = normalizeSaveErrorToIssues(error, {});
    expect(issues).not.toBeNull();
    expect(issues![0]?.targets.field).toBe("name");
  });

  it("422 SECURITY_NOT_FOUND + clientNodeIds → 노드 targets", () => {
    const error = new ApiError("VALUECHAINS.SECURITY_NOT_FOUND", 422, "종목 없음");
    const issues = normalizeSaveErrorToIssues(error, { clientNodeIds: ["n1"] });
    expect(issues![0]?.targets.clientNodeIds).toEqual(["n1"]);
  });

  it("409 SAVE_CONFLICT → null", () => {
    const error = new ApiError("VALUECHAINS.SAVE_CONFLICT", 409, "충돌");
    expect(normalizeSaveErrorToIssues(error, {})).toBeNull();
  });

  it("401 → null", () => {
    const error = new ApiError("AUTH_REQUIRED", 401, "인증 필요");
    expect(normalizeSaveErrorToIssues(error, {})).toBeNull();
  });

  it("500 → null", () => {
    const error = new ApiError("VALUECHAINS.SAVE_FAILED", 500, "저장 실패");
    expect(normalizeSaveErrorToIssues(error, {})).toBeNull();
  });

  it("details 누락(방어) → 빈 targets의 이슈 1건(throw 없음)", () => {
    const error = new ApiError("VALUECHAINS.INVALID_GROUP", 422, "그룹 오류");
    expect(() => normalizeSaveErrorToIssues(error, {})).not.toThrow();
    const issues = normalizeSaveErrorToIssues(error, {});
    expect(issues).toHaveLength(1);
  });
});

describe("classifySaveError", () => {
  it("409 SAVE_CONFLICT → 'conflict'", () => {
    expect(classifySaveError(new ApiError("VALUECHAINS.SAVE_CONFLICT", 409, "충돌"))).toBe("conflict");
  });

  it("401 → 'auth'", () => {
    expect(classifySaveError(new ApiError("AUTH_REQUIRED", 401, "인증"))).toBe("auth");
  });

  it("status 0(네트워크) → 'network'", () => {
    expect(classifySaveError(new ApiError("NETWORK_ERROR", 0, "네트워크"))).toBe("network");
  });

  it("500 → 'network'", () => {
    expect(classifySaveError(new ApiError("VALUECHAINS.SAVE_FAILED", 500, "실패"))).toBe("network");
  });

  it("422 계열 → 'rejected'", () => {
    expect(classifySaveError(new ApiError("VALUECHAINS.INVALID_EDGE", 422, "오류"))).toBe("rejected");
  });

  it("409 DUPLICATE_NAME → 'rejected'", () => {
    expect(classifySaveError(new ApiError("VALUECHAINS.DUPLICATE_NAME", 409, "중복"))).toBe("rejected");
  });
});
