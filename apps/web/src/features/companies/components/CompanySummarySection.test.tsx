// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import { CompanySummarySection } from "@/features/companies/components/CompanySummarySection";
import { COMPANY_NOT_FOUND_MESSAGE, PROFILE_NOT_COLLECTED_MESSAGE } from "@/features/companies/constants";
import type { CompanySummaryResponse } from "@/features/companies/lib/dto";
import { ApiError } from "@/lib/http/api-client";

const buildQuery = (
  overrides: Partial<UseQueryResult<CompanySummaryResponse, ApiError>>,
): UseQueryResult<CompanySummaryResponse, ApiError> =>
  ({
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    refetch: vi.fn(),
    ...overrides,
  }) as UseQueryResult<CompanySummaryResponse, ApiError>;

const buildData = (overrides?: Partial<CompanySummaryResponse>): CompanySummaryResponse => ({
  security: {
    id: "sec-1",
    ticker: "005930",
    name: "삼성전자",
    englishName: "Samsung Electronics",
    market: "KRX",
    currency: "KRW",
    listingStatus: "listed",
  },
  profile: {
    representativeName: "대표자",
    establishedDate: "1969-01-13",
    homepageUrl: "https://samsung.com",
    sector: "전자",
    lastCollectedAt: "2026-07-01T00:00:00Z",
  },
  dataSources: {
    financialSource: "dart",
    quoteSource: "toss",
    lastQuoteDate: "2026-07-01",
    lastDisclosureDate: "2026-06-01",
  },
  ...overrides,
});

describe("CompanySummarySection", () => {
  it("로딩 중이면 스켈레톤을 표시한다", () => {
    render(<CompanySummarySection query={buildQuery({ isPending: true })} onMarketSelect={vi.fn()} />);

    expect(screen.getByTestId("company-summary-loading")).toBeInTheDocument();
  });

  it("404 오류면 NotFound 폴백을 렌더한다", () => {
    render(
      <CompanySummarySection
        query={buildQuery({ isError: true, error: new ApiError("COMPANY_NOT_FOUND", 404, "not found") })}
        onMarketSelect={vi.fn()}
      />,
    );

    expect(screen.getByText(COMPANY_NOT_FOUND_MESSAGE)).toBeInTheDocument();
  });

  it("409 오류면 시장 선택 UI를 표시하고 선택 시 콜백을 전파한다", async () => {
    const user = userEvent.setup();
    const onMarketSelect = vi.fn();
    render(
      <CompanySummarySection
        query={buildQuery({ isError: true, error: new ApiError("TICKER_AMBIGUOUS", 409, "ambiguous") })}
        onMarketSelect={onMarketSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /한국거래소/ }));

    expect(onMarketSelect).toHaveBeenCalledWith("KRX");
  });

  it("500 오류면 섹션 폴백 + 재시도 버튼을 표시한다", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    render(
      <CompanySummarySection
        query={buildQuery({
          isError: true,
          error: new ApiError("COMPANY_FETCH_ERROR", 500, "서버 오류"),
          refetch,
        })}
        onMarketSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /다시 시도/ }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("정상 KRX 종목이면 정형 정보 + 배지 + 출처를 표시한다", () => {
    render(
      <CompanySummarySection query={buildQuery({ data: buildData() })} onMarketSelect={vi.fn()} />,
    );

    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(screen.getByText("005930")).toBeInTheDocument();
    expect(screen.getByText("KRX")).toBeInTheDocument();
    expect(screen.getByText(/DART/)).toBeInTheDocument();
  });

  it("profile: null이면 미수집 안내를 표시한다(회사명·티커는 표시)", () => {
    render(
      <CompanySummarySection
        query={buildQuery({ data: buildData({ profile: null }) })}
        onMarketSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(screen.getByText(PROFILE_NOT_COLLECTED_MESSAGE)).toBeInTheDocument();
  });

  it("listingStatus='suspended'면 거래정지 배지를 표시한다", () => {
    render(
      <CompanySummarySection
        query={buildQuery({
          data: buildData({
            security: { ...buildData().security, listingStatus: "suspended" },
          }),
        })}
        onMarketSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("거래정지")).toBeInTheDocument();
  });

  it("establishedDate/homepageUrl이 null이면 해당 행을 표시하지 않는다", () => {
    render(
      <CompanySummarySection
        query={buildQuery({
          data: buildData({
            profile: {
              representativeName: "대표자",
              establishedDate: null,
              homepageUrl: null,
              sector: "전자",
              lastCollectedAt: null,
            },
          }),
        })}
        onMarketSelect={vi.fn()}
      />,
    );

    expect(screen.queryByText("설립일")).not.toBeInTheDocument();
    expect(screen.queryByText("홈페이지")).not.toBeInTheDocument();
  });

  it("홈페이지 링크는 새 창으로 열리도록 구성된다", () => {
    render(
      <CompanySummarySection query={buildQuery({ data: buildData() })} onMarketSelect={vi.fn()} />,
    );

    const link = screen.getByRole("link", { name: /홈페이지/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("href", "https://samsung.com");
  });
});
