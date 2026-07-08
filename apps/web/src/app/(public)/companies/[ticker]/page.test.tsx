// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http/api-client")>("@/lib/http/api-client");
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
  usePathname: () => "/companies/005930",
}));

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

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

const CompanyDetailPage = (await import("@/app/(public)/companies/[ticker]/page")).default;

const SUMMARY_RESPONSE = {
  security: {
    id: "sec-1",
    ticker: "005930",
    name: "삼성전자",
    englishName: null,
    market: "KRX",
    currency: "KRW",
    listingStatus: "listed",
  },
  profile: null,
  dataSources: { financialSource: "dart", quoteSource: "toss", lastQuoteDate: null, lastDisclosureDate: null },
};

const setupDefaultApiFetch = () => {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/companies/")) return SUMMARY_RESPONSE;
    if (path.includes("/financials")) return { securityId: "sec-1", currency: "KRW", items: [], annotations: { minFiscalYear: 2015, isAnnualOnly: false } };
    if (path.includes("/disclosures")) return { securityId: "sec-1", items: [], page: 1, pageSize: 20, hasMore: false };
    if (path.includes("/quotes")) return { securityId: "sec-1", currency: "KRW", candles: [], marketCapSeries: [], sharesMeta: null };
    if (path.includes("/valuechains")) return { securityId: "sec-1", items: [] };
    throw new Error(`unexpected path ${path}`);
  });
};

const renderPageWithQueryClient = async (props: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ market?: string; asOf?: string }>;
}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const PageElement = await CompanyDetailPage(props);
  return render(<Wrapper>{PageElement}</Wrapper>);
};

describe("CompanyDetailPage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    setupDefaultApiFetch();
  });

  it("/companies/005930 직접 진입(비로그인) — 전체 페이지가 정상 로드된다", async () => {
    await renderPageWithQueryClient({
      params: Promise.resolve({ ticker: "005930" }),
      searchParams: Promise.resolve({}),
    });

    await waitFor(() => expect(screen.getByText("삼성전자")).toBeInTheDocument());
  });

  it("market=US 쿼리를 포함해 진입하면 summary 요청에 market이 전달된다", async () => {
    await renderPageWithQueryClient({
      params: Promise.resolve({ ticker: "AAPL" }),
      searchParams: Promise.resolve({ market: "US" }),
    });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/companies/AAPL?market=US"));
  });

  it("asOf 형식 오류(?asOf=abc)면 배너 없이 페이지가 정상 렌더된다(크래시 없음)", async () => {
    await renderPageWithQueryClient({
      params: Promise.resolve({ ticker: "005930" }),
      searchParams: Promise.resolve({ asOf: "abc" }),
    });

    await waitFor(() => expect(screen.getByText("삼성전자")).toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("유효한 asOf로 진입하면 시점 컨텍스트 배너를 표시한다(E14)", async () => {
    await renderPageWithQueryClient({
      params: Promise.resolve({ ticker: "005930" }),
      searchParams: Promise.resolve({ market: "US", asOf: "2026-05-02" }),
    });

    await waitFor(() => expect(screen.getByText(/2026-05-02/)).toBeInTheDocument());
  });
});
