import { describe, expect, it } from "vitest";
import { validateChainNameFormat } from "./editorValidation";

describe("validateChainNameFormat", () => {
  it("정상 이름 → null", () => {
    expect(validateChainNameFormat("반도체 밸류체인")).toBeNull();
  });

  it("앞뒤 공백 포함 이름(trim 후 비어있지 않음) → null", () => {
    expect(validateChainNameFormat("  이름  ")).toBeNull();
  });

  it("빈 문자열 → NAME_REQUIRED", () => {
    expect(validateChainNameFormat("")).toBe("NAME_REQUIRED");
  });

  it("공백만 → NAME_REQUIRED", () => {
    expect(validateChainNameFormat("   ")).toBe("NAME_REQUIRED");
  });

  it("탭/개행 등 화이트스페이스만 → NAME_REQUIRED", () => {
    expect(validateChainNameFormat("\t\n  \t")).toBe("NAME_REQUIRED");
  });
});
