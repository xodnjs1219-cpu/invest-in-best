// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import { QUOTES_MARKET_CAP_MISSING_MESSAGE, QUOTES_SECTION_ERROR_MESSAGE } from "@/features/companies/constants";
import type { QuotesResponse } from "@/features/companies/lib/dto";
import { ApiError } from "@/lib/http/api-client";

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({ setData: vi.fn() })),
    resize: vi.fn(),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
  })),
  createSeriesMarkers: vi.fn(() => ({ setMarkers: vi.fn() })),
  CandlestickSeries: "CandlestickSeries",
}));

const { QuotesSection } = await import("@/features/companies/components/QuotesSection");

afterEach(() => {
  cleanup();
});

const buildQuery = (
  overrides: Partial<UseQueryResult<QuotesResponse, ApiError>>,
): UseQueryResult<QuotesResponse, ApiError> =>
  ({
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    refetch: vi.fn(),
    ...overrides,
  }) as UseQueryResult<QuotesResponse, ApiError>;

const buildData = (overrides?: Partial<QuotesResponse>): QuotesResponse => ({
  securityId: "sec-1",
  currency: "KRW",
  candles: [
    { tradeDate: "2026-07-01", open: 1000, high: 1100, low: 950, close: 1050, volume: 100, isClosingConfirmed: true },
  ],
  marketCapSeries: [{ tradeDate: "2026-07-01", marketCap: 500000 }],
  sharesMeta: { shares: 500, asOfDate: "2026-06-01", source: "toss", isMultiClassPartial: false },
  ...overrides,
});

describe("QuotesSection", () => {
  it("로딩 중이면 스켈레톤을 표시한다", () => {
    render(<QuotesSection query={buildQuery({ isPending: true })} period="1Y" onPeriodChange={vi.fn()} />);
    expect(screen.getByTestId("quotes-loading")).toBeInTheDocument();
  });

  it("오류면 폴백+재시도 버튼을 표시한다", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    render(
      <QuotesSection
        query={buildQuery({ isError: true, error: new ApiError("QUOTES_FETCH_ERROR", 500, "오류"), refetch })}
        period="1Y"
        onPeriodChange={vi.fn()}
      />,
    );

    expect(screen.getByText(QUOTES_SECTION_ERROR_MESSAGE)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("정상 데이터면 캔들차트와 시총 추이·기준일 주석을 표시한다", () => {
    render(
      <QuotesSection query={buildQuery({ isSuccess: true, data: buildData() })} period="1Y" onPeriodChange={vi.fn()} />,
    );

    expect(screen.getByText(/주식수 기준일/)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-01/)).toBeInTheDocument();
  });

  it("sharesMeta: null이면 시총 미표시 안내를 표시한다(E9)", () => {
    render(
      <QuotesSection
        query={buildQuery({ isSuccess: true, data: buildData({ sharesMeta: null, marketCapSeries: [] }) })}
        period="1Y"
        onPeriodChange={vi.fn()}
      />,
    );

    expect(screen.getByText(QUOTES_MARKET_CAP_MISSING_MESSAGE)).toBeInTheDocument();
  });

  it("isMultiClassPartial=true면 부분 집계 주석을 병기한다", () => {
    render(
      <QuotesSection
        query={buildQuery({
          isSuccess: true,
          data: buildData({
            sharesMeta: { shares: 500, asOfDate: "2026-06-01", source: "toss", isMultiClassPartial: true },
          }),
        })}
        period="1Y"
        onPeriodChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/다중 클래스/)).toBeInTheDocument();
  });

  it("기간 프리셋 클릭 시 onPeriodChange가 호출된다", async () => {
    const user = userEvent.setup();
    const onPeriodChange = vi.fn();
    render(
      <QuotesSection query={buildQuery({ isSuccess: true, data: buildData() })} period="1Y" onPeriodChange={onPeriodChange} />,
    );

    await user.click(screen.getByRole("button", { name: "3M" }));
    expect(onPeriodChange).toHaveBeenCalledWith("3M");
  });
});
