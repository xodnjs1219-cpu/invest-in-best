import { describe, expect, it } from "vitest";
import { formatKrwCompact, formatKrwCompactOrNull } from "@/lib/formatting/number";

describe("formatKrwCompact", () => {
  it("조 단위 값을 '조' 단위로 축약한다", () => {
    // 1,234,567,890,123.67 -> 1조 2345억원대
    expect(formatKrwCompact("1234567890123.67")).toBe("1조 2,345억원");
  });

  it("억 단위 값을 '억' 단위로 축약한다", () => {
    expect(formatKrwCompact("123456789012")).toBe("1,234억원");
  });

  it("'0'은 '0원'으로 표시한다(미표시 처리와 구분되는 값 표기)", () => {
    expect(formatKrwCompact("0")).toBe("0원");
  });

  it("억 미만의 작은 값은 원 단위 그대로 콤마 표기한다", () => {
    expect(formatKrwCompact("123456")).toBe("123,456원");
  });

  it("소수부가 있는 문자열 입력도 정상 처리한다(정밀도 보존을 위한 문자열 계약)", () => {
    expect(formatKrwCompact("999999999999.99")).toBe("9,999억원");
  });

  it("음수 입력도 부호를 보존한다(방어적)", () => {
    expect(formatKrwCompact("-123456789012")).toBe("-1,234억원");
  });
});

describe("formatKrwCompactOrNull", () => {
  it("null → nullLabel 그대로 반환(0과 구분)", () => {
    expect(formatKrwCompactOrNull(null, "미산출")).toBe("미산출");
  });

  it("0 → '0원'(미산출 라벨 아님)", () => {
    expect(formatKrwCompactOrNull(0, "미산출")).toBe("0원");
  });

  it("number 입력을 조/억 단위로 축약한다", () => {
    expect(formatKrwCompactOrNull(1_234_567_890_123, "미산출")).toBe("1조 2,345억원");
  });

  it("string 입력도 처리한다(정밀도 보존 경로)", () => {
    expect(formatKrwCompactOrNull("123456789012", "미제공")).toBe("1,234억원");
  });
});
