// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import { FinancialsSection } from "@/features/companies/components/FinancialsSection";
import {
  FINANCIALS_EMPTY_MESSAGE,
  FINANCIALS_REVENUE_UNMAPPED_NOTE,
  FINANCIALS_SECTION_ERROR_MESSAGE,
} from "@/features/companies/constants";
import type { FinancialsResponse } from "@/features/companies/lib/dto";
import { ApiError } from "@/lib/http/api-client";

const buildQuery = (
  overrides: Partial<UseQueryResult<FinancialsResponse, ApiError>>,
): UseQueryResult<FinancialsResponse, ApiError> =>
  ({
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    refetch: vi.fn(),
    ...overrides,
  }) as UseQueryResult<FinancialsResponse, ApiError>;

const buildData = (overrides?: Partial<FinancialsResponse>): FinancialsResponse => ({
  securityId: "sec-1",
  currency: "KRW",
  items: [
    {
      periodType: "quarter",
      fiscalYear: 2024,
      fiscalQuarter: 1,
      calendarYear: 2024,
      calendarQuarter: 1,
      revenue: 1_000_000_000,
      operatingIncome: 100_000_000,
      netIncome: 50_000_000,
      amountBasis: "three_month",
      isRevenueTagUnmapped: false,
      source: "dart",
    },
  ],
  annotations: { minFiscalYear: 2015, isAnnualOnly: false },
  ...overrides,
});

describe("FinancialsSection", () => {
  it("로딩 중이면 스켈레톤을 표시한다", () => {
    render(
      <FinancialsSection query={buildQuery({ isPending: true })} period="5Y" onPeriodChange={vi.fn()} />,
    );

    expect(screen.getByTestId("financials-loading")).toBeInTheDocument();
  });

  it("오류면 폴백 + 재시도 버튼을 표시한다", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    render(
      <FinancialsSection
        query={buildQuery({ isError: true, error: new ApiError("FINANCIALS_FETCH_ERROR", 500, "오류"), refetch })}
        period="5Y"
        onPeriodChange={vi.fn()}
      />,
    );

    expect(screen.getByText(FINANCIALS_SECTION_ERROR_MESSAGE)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("items: []이면 결측 안내를 표시한다", () => {
    render(
      <FinancialsSection
        query={buildQuery({ isSuccess: true, data: buildData({ items: [] }) })}
        period="5Y"
        onPeriodChange={vi.fn()}
      />,
    );

    expect(screen.getByText(FINANCIALS_EMPTY_MESSAGE)).toBeInTheDocument();
  });

  it("정상 데이터면 표를 렌더한다", () => {
    render(
      <FinancialsSection
        query={buildQuery({ isSuccess: true, data: buildData() })}
        period="5Y"
        onPeriodChange={vi.fn()}
      />,
    );

    expect(screen.getByText("2024Q1")).toBeInTheDocument();
  });

  it("매출 미매핑 종목은 '미매핑' 주석을 표시하고 영업이익은 정상 표시한다(E6)", () => {
    render(
      <FinancialsSection
        query={buildQuery({
          isSuccess: true,
          data: buildData({
            currency: "USD",
            items: [
              {
                periodType: "quarter",
                fiscalYear: 2024,
                fiscalQuarter: 1,
                calendarYear: 2024,
                calendarQuarter: 1,
                revenue: null,
                operatingIncome: 100,
                netIncome: 50,
                amountBasis: "three_month",
                isRevenueTagUnmapped: true,
                source: "sec",
              },
            ],
          }),
        })}
        period="5Y"
        onPeriodChange={vi.fn()}
      />,
    );

    expect(screen.getByText(FINANCIALS_REVENUE_UNMAPPED_NOTE)).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("20-F 연간 전용 기업은 '분기 미제공' 주석을 표시한다(E7)", () => {
    render(
      <FinancialsSection
        query={buildQuery({
          isSuccess: true,
          data: buildData({ annotations: { minFiscalYear: 2015, isAnnualOnly: true } }),
        })}
        period="5Y"
        onPeriodChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/분기 손익을 제공하지 않아/)).toBeInTheDocument();
  });

  it("기간 프리셋 클릭 시 onPeriodChange가 호출된다", async () => {
    const user = userEvent.setup();
    const onPeriodChange = vi.fn();
    render(
      <FinancialsSection query={buildQuery({ isSuccess: true, data: buildData() })} period="5Y" onPeriodChange={onPeriodChange} />,
    );

    await user.click(screen.getByRole("button", { name: "3Y" }));

    expect(onPeriodChange).toHaveBeenCalledWith("3Y");
  });
});
