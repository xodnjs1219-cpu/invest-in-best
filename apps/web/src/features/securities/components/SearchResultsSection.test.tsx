// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchResultsSection } from "@/features/securities/components/SearchResultsSection";
import type { SecuritySearchItem } from "@/features/securities/lib/dto";

const buildItem = (overrides?: Partial<SecuritySearchItem>): SecuritySearchItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  ticker: "005930",
  name: "삼성전자",
  englishName: "Samsung Electronics",
  market: "KRX",
  listingStatus: "listed",
  ...overrides,
});

const baseProps = {
  items: [] as SecuritySearchItem[],
  isPending: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  onLoadMore: vi.fn(),
  onRetry: vi.fn(),
  onSelect: vi.fn(),
};

describe("SearchResultsSection", () => {
  it("isPending=true면 로딩 스켈레톤을 표시한다", () => {
    render(<SearchResultsSection {...baseProps} isPending />);
    expect(screen.getByTestId("search-results-loading")).toBeInTheDocument();
  });

  it("결과 0건 성공이면 빈 결과 안내를 표시한다(오류 UI와 구분)", () => {
    render(<SearchResultsSection {...baseProps} items={[]} />);
    expect(screen.getByText(/검색 결과가 없습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /다시 시도/ })).not.toBeInTheDocument();
  });

  it("결과 20건 + hasNextPage=true면 목록 20행과 더보기 버튼을 표시한다", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      buildItem({ ticker: `T${i}`, name: `종목${i}` }),
    );
    render(<SearchResultsSection {...baseProps} items={items} hasNextPage />);
    expect(screen.getAllByRole("button", { name: /종목/ })).toHaveLength(20);
    expect(screen.getByRole("button", { name: "더보기" })).toBeInTheDocument();
  });

  it("더보기 클릭 시 onLoadMore가 호출된다", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <SearchResultsSection {...baseProps} items={[buildItem()]} hasNextPage onLoadMore={onLoadMore} />,
    );
    await user.click(screen.getByRole("button", { name: "더보기" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("hasNextPage=false면 더보기 버튼이 노출되지 않는다", () => {
    render(<SearchResultsSection {...baseProps} items={[buildItem()]} hasNextPage={false} />);
    expect(screen.queryByRole("button", { name: "더보기" })).not.toBeInTheDocument();
  });

  it("isError=true면 오류 안내와 재시도 버튼을 표시하고 클릭 시 onRetry가 호출된다", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<SearchResultsSection {...baseProps} isError onRetry={onRetry} />);
    expect(screen.getByRole("button", { name: /다시 시도/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("결과 항목 클릭 시 onSelect(ticker)가 전파된다", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SearchResultsSection {...baseProps} items={[buildItem()]} onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: /삼성전자/ }));
    expect(onSelect).toHaveBeenCalledWith("005930");
  });

  it("errorCode='INVALID_QUERY'면 입력 확인 안내 문구를 표시한다", () => {
    render(<SearchResultsSection {...baseProps} isError errorCode="INVALID_QUERY" />);
    expect(screen.getByText(/검색어/)).toBeInTheDocument();
  });
});
