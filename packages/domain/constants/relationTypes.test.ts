import { describe, expect, it } from "vitest";
import { RELATION_TYPE_NAME_MAX_LENGTH, relationTypeNameSchema } from "./relationTypes";

describe("relationTypeNameSchema (UC-024 M1, spec BR-5/R-7)", () => {
  it("'공급'과 같은 일반 이름을 통과시킨다", () => {
    const result = relationTypeNameSchema.safeParse("공급");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("공급");
    }
  });

  it("앞뒤 공백을 trim한 값으로 변환한다(R-7 정규화)", () => {
    const result = relationTypeNameSchema.safeParse("  공급  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("공급");
    }
  });

  it("빈 문자열은 실패한다(E7)", () => {
    expect(relationTypeNameSchema.safeParse("").success).toBe(false);
  });

  it("공백만 있는 문자열은 trim 후 빈 값이라 실패한다(E7)", () => {
    expect(relationTypeNameSchema.safeParse("   ").success).toBe(false);
  });

  it(`정확히 ${RELATION_TYPE_NAME_MAX_LENGTH}자는 통과한다(경계값)`, () => {
    const name = "가".repeat(RELATION_TYPE_NAME_MAX_LENGTH);
    expect(relationTypeNameSchema.safeParse(name).success).toBe(true);
  });

  it(`${RELATION_TYPE_NAME_MAX_LENGTH + 1}자는 실패한다(경계값 초과)`, () => {
    const name = "가".repeat(RELATION_TYPE_NAME_MAX_LENGTH + 1);
    expect(relationTypeNameSchema.safeParse(name).success).toBe(false);
  });
});
