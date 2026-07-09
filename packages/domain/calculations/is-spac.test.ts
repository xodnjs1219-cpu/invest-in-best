import { describe, it, expect } from "vitest";
import { isSpacName } from "./is-spac";

describe("isSpacName", () => {
  it("사용자가 예시로 든 스팩 상호를 스팩으로 판정한다", () => {
    expect(isSpacName("삼성스팩10호")).toBe(true);
    expect(isSpacName("삼성머스트기업인수목적5호")).toBe(true);
  });

  it("전형적 한국 스팩 명명을 판정한다", () => {
    expect(isSpacName("DB금융스팩10호")).toBe(true);
    expect(isSpacName("IBKS제7호스팩")).toBe(true);
    expect(isSpacName("KB제25호스팩")).toBe(true);
    expect(isSpacName("하나금융21호기업인수목적")).toBe(true);
  });

  it("공백 변형을 무시하고 판정한다", () => {
    expect(isSpacName("삼성 스팩 10호")).toBe(true);
    expect(isSpacName("하나금융 기업 인수 목적")).toBe(true);
  });

  it("영문 SPAC 상호를 판정한다", () => {
    expect(isSpacName("A SPAC II ACQUISITION CORP")).toBe(true);
    expect(isSpacName("A SPAC III ACQUISITION CORP")).toBe(true);
    expect(isSpacName("A 스팩 애퀴지션 2")).toBe(true); // 토스 한글명도 '스팩' 포함
  });

  it("일반 종목은 스팩이 아니다", () => {
    expect(isSpacName("삼성전자")).toBe(false);
    expect(isSpacName("SK하이닉스")).toBe(false);
    expect(isSpacName("NAVER")).toBe(false);
    expect(isSpacName("Apple Inc.")).toBe(false);
    // 'Acquisition'만 있고 SPAC 없는 정상 운영사는 스팩 아님(오탐 방지)
    expect(isSpacName("Liberty Acquisition Holdings")).toBe(false);
  });

  it("SPAC 부분 문자열을 포함한 정상 우주·항공 기업을 오판하지 않는다(단어 경계)", () => {
    expect(isSpacName("SPACE HOLDINGS")).toBe(false);
    expect(isSpacName("Virgin Galactic SPACE")).toBe(false);
    expect(isSpacName("SPACEX")).toBe(false);
    expect(isSpacName("Aerospace Corp")).toBe(false);
    expect(isSpacName("SPACE PERSPECTIVE")).toBe(false);
    expect(isSpacName("한화에어로스페이스")).toBe(false);
  });

  it("null/undefined/빈 문자열은 스팩이 아니다", () => {
    expect(isSpacName(null)).toBe(false);
    expect(isSpacName(undefined)).toBe(false);
    expect(isSpacName("")).toBe(false);
  });
});
