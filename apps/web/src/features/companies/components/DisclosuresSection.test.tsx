// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { DisclosuresSection } from "@/features/companies/components/DisclosuresSection";
import { DISCLOSURES_EMPTY_MESSAGE, DISCLOSURES_SECTION_ERROR_MESSAGE } from "@/features/companies/constants";
import type { DisclosuresResponse } from "@/features/companies/lib/dto";
import { ApiError } from "@/lib/http/api-client";

const buildQuery = (
  overrides: Partial<UseInfiniteQueryResult<InfiniteData<DisclosuresResponse>, ApiError>>,
): UseInfiniteQueryResult<InfiniteData<DisclosuresResponse>, ApiError> =>
  ({
    isPending: false,
    isError: false,
    data: undefined,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  }) as UseInfiniteQueryResult<InfiniteData<DisclosuresResponse>, ApiError>;

const buildPage = (overrides?: Partial<DisclosuresResponse>): DisclosuresResponse => ({
  securityId: "sec-1",
  items: [
    { id: "1", title: "정기공시", disclosureDate: "2026-06-01", url: "https://dart.fss.or.kr/x", source: "dart" },
  ],
  page: 1,
  pageSize: 20,
  hasMore: false,
  ...overrides,
});

describe("DisclosuresSection", () => {
  it("로딩 중이면 스켈레톤을 표시한다", () => {
    render(<DisclosuresSection query={buildQuery({ isPending: true })} />);
    expect(screen.getByTestId("disclosures-loading")).toBeInTheDocument();
  });

  it("오류면 폴백 + 재시도 버튼을 표시한다", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    render(
      <DisclosuresSection
        query={buildQuery({ isError: true, error: new ApiError("DISCLOSURES_FETCH_ERROR", 500, "오류"), refetch })}
      />,
    );

    expect(screen.getByText(DISCLOSURES_SECTION_ERROR_MESSAGE)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("items: []이면 '공시 없음' 안내를 표시한다(E10)", () => {
    render(
      <DisclosuresSection
        query={buildQuery({ data: { pages: [buildPage({ items: [] })], pageParams: [1] } })}
      />,
    );

    expect(screen.getByText(DISCLOSURES_EMPTY_MESSAGE)).toBeInTheDocument();
  });

  it("목록을 렌더하고 항목 클릭 시 새 탭 링크 속성을 갖는다", () => {
    render(
      <DisclosuresSection query={buildQuery({ data: { pages: [buildPage()], pageParams: [1] } })} />,
    );

    const link = screen.getByRole("link", { name: /정기공시/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("href", "https://dart.fss.or.kr/x");
  });

  it("hasNextPage=true면 더보기 버튼을 표시하고 클릭 시 fetchNextPage를 호출한다", async () => {
    const user = userEvent.setup();
    const fetchNextPage = vi.fn();
    render(
      <DisclosuresSection
        query={buildQuery({
          data: { pages: [buildPage({ hasMore: true })], pageParams: [1] },
          hasNextPage: true,
          fetchNextPage,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /더보기/ }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("isFetchingNextPage=true면 로딩 라벨을 표시한다", () => {
    render(
      <DisclosuresSection
        query={buildQuery({
          data: { pages: [buildPage({ hasMore: true })], pageParams: [1] },
          hasNextPage: true,
          isFetchingNextPage: true,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /불러오는 중/ })).toBeDisabled();
  });
});
