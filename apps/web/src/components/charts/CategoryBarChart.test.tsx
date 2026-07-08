// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";

afterEach(() => {
  cleanup();
});

describe("CategoryBarChart (UC-020 plan 모듈 10 — 다중 시리즈 확장)", () => {
  it("series/values 미지정 시 기존 단일 y 동작을 유지한다(하위호환, 크래시 없음)", () => {
    expect(() =>
      render(
        <CategoryBarChart
          data={[
            { x: "2024Q1", y: 100 },
            { x: "2024Q2", y: null },
          ]}
        />,
      ),
    ).not.toThrow();
  });

  it("series + values 지정 시 다중 시리즈로 렌더한다(크래시 없음)", () => {
    expect(() =>
      render(
        <CategoryBarChart
          series={[
            { key: "revenue", label: "매출" },
            { key: "operatingIncome", label: "영업이익" },
          ]}
          data={[
            { x: "2024Q1", values: { revenue: 1000, operatingIncome: 100 } },
            { x: "2024Q2", values: { revenue: null, operatingIncome: 50 } },
          ]}
        />,
      ),
    ).not.toThrow();
  });
});
