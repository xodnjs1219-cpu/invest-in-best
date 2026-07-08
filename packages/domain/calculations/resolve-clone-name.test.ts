import { describe, expect, it } from "vitest";
import { resolveCloneName } from "./resolve-clone-name";

/**
 * UC-014 plan 모듈 2 — 복제 이름 결정 순수 함수 테스트.
 * 동일 사용자 내 이름 충돌 시 자동 접미어 " (n)" 부여(D-4, spec Edge 3·BR-5).
 */
describe("resolveCloneName", () => {
  it("충돌 없음: 기존 이름 목록이 비어 있으면 원본 이름을 그대로 반환한다", () => {
    expect(resolveCloneName("반도체", [])).toBe("반도체");
  });

  it("1회 충돌: 동일 이름이 이미 존재하면 접미어 (2)를 부여한다", () => {
    expect(resolveCloneName("반도체", ["반도체"])).toBe("반도체 (2)");
  });

  it("연쇄 충돌: (2)·(3)까지 존재하면 다음 번호 (4)를 부여한다", () => {
    expect(resolveCloneName("반도체", ["반도체", "반도체 (2)", "반도체 (3)"])).toBe("반도체 (4)");
  });

  it("중간 빈 번호: 최소 미사용 번호를 사용한다", () => {
    expect(resolveCloneName("반도체", ["반도체", "반도체 (3)"])).toBe("반도체 (2)");
  });

  it("대소문자 구분: 완전 일치가 아니면 충돌로 보지 않는다", () => {
    expect(resolveCloneName("Chain", ["chain"])).toBe("Chain");
  });

  it("원본 이름에 이미 접미어 유사 문자열이 포함되어도 baseName을 파싱하지 않고 그대로 접미어를 부가한다", () => {
    expect(resolveCloneName("반도체 (2)", ["반도체 (2)"])).toBe("반도체 (2) (2)");
  });

  it("입력 배열을 변이하지 않는다", () => {
    const existingNames = ["반도체"];
    resolveCloneName("반도체", existingNames);
    expect(existingNames).toEqual(["반도체"]);
  });
});
