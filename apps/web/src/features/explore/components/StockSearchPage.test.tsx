// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/stocks",
}));

const { StockSearchPage } = await import("@/features/explore/components/StockSearchPage");

const buildSearchResponse = () => ({
  items: [
    {
      id: "sec-1",
      ticker: "005930",
      name: "삼성전자",
      market: "KRX",
      listingStatus: "listed",
    },
  ],
  pagination: { page: 1, limit: 20, totalCount: 1, hasMore: false },
});

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { data } : { error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <StockSearchPage />
    </QueryClientProvider>,
  );
};

describe("StockSearchPage (종목 검색 전용 페이지)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("h1(종목 검색)·검색창을 렌더하고, 검색 전에는 결과 섹션이 없다", () => {
    global.fetch = vi.fn();
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "종목 검색" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "종목 검색" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("검색어 입력(디바운스) 후 결과가 렌더되고, 선택 시 종목 상세로 이동한다", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildSearchResponse()));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox", { name: "종목 검색" }), "삼성");

    const result = await screen.findByText("삼성전자", undefined, { timeout: 3000 });
    expect(result).toBeInTheDocument();

    await user.click(result);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/companies/005930"));
  });
});
