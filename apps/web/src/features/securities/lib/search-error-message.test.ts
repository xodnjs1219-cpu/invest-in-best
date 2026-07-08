import { describe, expect, it } from "vitest";
import { getSearchErrorMessage } from "@/features/securities/lib/search-error-message";

describe("getSearchErrorMessage", () => {
  it("'INVALID_QUERY'는 입력 확인 안내 문구를 반환한다", () => {
    expect(getSearchErrorMessage("INVALID_QUERY")).toMatch(/검색어|입력/);
  });

  it("'TOO_MANY_REQUESTS'는 잠시 후 재시도 문구를 반환한다", () => {
    expect(getSearchErrorMessage("TOO_MANY_REQUESTS")).toMatch(/잠시|재시도/);
  });

  it("'SEARCH_FAILED'는 기본 오류 문구를 반환한다", () => {
    expect(getSearchErrorMessage("SEARCH_FAILED")).toMatch(/오류|다시 시도/);
  });

  it("undefined는 기본 오류 문구를 반환한다", () => {
    expect(getSearchErrorMessage(undefined)).toMatch(/오류|다시 시도/);
  });

  it("미지의 코드는 기본 오류 문구를 반환한다", () => {
    expect(getSearchErrorMessage("SOME_UNKNOWN_CODE")).toMatch(/오류|다시 시도/);
  });
});
