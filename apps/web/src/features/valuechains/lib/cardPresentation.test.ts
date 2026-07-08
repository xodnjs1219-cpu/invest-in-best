import { describe, expect, it } from "vitest";
import {
  formatFocusLabel,
  formatMetricDisplay,
  formatNodeCount,
} from "@/features/valuechains/lib/cardPresentation";
import type { ChainCardMetric } from "@/features/valuechains/lib/dto";

describe("formatFocusLabel", () => {
  it("industry면 '산업 중심'을 반환한다", () => {
    expect(formatFocusLabel("industry", null)).toBe("산업 중심");
  });

  it("company + 기업명이 있으면 '기업 중심 · {기업명}'을 반환한다", () => {
    expect(formatFocusLabel("company", "삼성전자")).toBe("기업 중심 · 삼성전자");
  });

  it("company + 기업명이 null이면 '기업 중심'만 반환한다(결정 D-1)", () => {
    expect(formatFocusLabel("company", null)).toBe("기업 중심");
  });
});

describe("formatMetricDisplay", () => {
  it("null이면 kind:'unavailable'을 반환한다(0과 구분, 엣지 3)", () => {
    expect(formatMetricDisplay(null)).toEqual({ kind: "unavailable" });
  });

  it("정상 metric은 KRW 축약 문자열 + 커버리지 문자열을 반환한다", () => {
    const metric: ChainCardMetric = {
      metricDate: "2026-07-08",
      totalMarketCapKrw: "123456789012",
      coveredNodeCount: 3,
      totalNodeCount: 5,
      isCarriedForward: false,
    };

    const result = formatMetricDisplay(metric);

    expect(result).toEqual({
      kind: "value",
      text: "1,234억원",
      coverageText: "반영 3/전체 5",
      isCarriedForward: false,
      metricDate: "2026-07-08",
    });
  });

  it("isCarriedForward=true면 결과에 그대로 전달된다", () => {
    const metric: ChainCardMetric = {
      metricDate: "2026-07-08",
      totalMarketCapKrw: "1000",
      coveredNodeCount: 1,
      totalNodeCount: 1,
      isCarriedForward: true,
    };

    const result = formatMetricDisplay(metric);

    expect(result.kind).toBe("value");
    expect(result.kind === "value" && result.isCarriedForward).toBe(true);
  });

  it("totalMarketCapKrw='0'이면 '0원'으로 값 표기한다(unavailable이 아님, 역방향 검증)", () => {
    const metric: ChainCardMetric = {
      metricDate: "2026-07-08",
      totalMarketCapKrw: "0",
      coveredNodeCount: 0,
      totalNodeCount: 2,
      isCarriedForward: false,
    };

    const result = formatMetricDisplay(metric);

    expect(result).toEqual({
      kind: "value",
      text: "0원",
      coverageText: "반영 0/전체 2",
      isCarriedForward: false,
      metricDate: "2026-07-08",
    });
  });
});

describe("formatNodeCount", () => {
  it("N개 형식으로 표기한다", () => {
    expect(formatNodeCount(5)).toBe("노드 5개");
  });

  it("0이어도 정상 표기한다(엣지 9)", () => {
    expect(formatNodeCount(0)).toBe("노드 0개");
  });
});
