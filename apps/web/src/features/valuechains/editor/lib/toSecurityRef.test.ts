import { describe, expect, it } from "vitest";
import { toSecurityRef } from "./toSecurityRef";
import type { SecuritySearchItem } from "@/features/securities/lib/dto";

describe("toSecurityRef", () => {
  it("SecuritySearchItem을 SecurityRef로 매핑한다(표시 불필요 필드 제외)", () => {
    const item: SecuritySearchItem = {
      id: "s1",
      ticker: "005930",
      name: "삼성전자",
      englishName: "Samsung Electronics",
      market: "KRX",
      listingStatus: "listed",
    };

    expect(toSecurityRef(item)).toEqual({
      securityId: "s1",
      ticker: "005930",
      name: "삼성전자",
      market: "KRX",
    });
  });
});
