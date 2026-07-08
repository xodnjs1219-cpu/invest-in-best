// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const { CompanyDetailView } = await import("@/features/companies/components/CompanyDetailView");
const { ApiError } = await import("@/lib/http/api-client");

const SUMMARY_RESPONSE = {
  security: {
    id: "sec-1",
    ticker: "005930",
    name: "삼성전자",
    englishName: "Samsung Electronics",
    market: "KRX",
    currency: "KRW",
    listingStatus: "listed",
  },
  profile: null,
  dataSources: { financialSource: "dart", quoteSource: "toss", lastQuoteDate: null, lastDisclosureDate: null },
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
};

describe("CompanyDetailView", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    routerReplaceMock.mockReset();
  });

  it("summary 성공 시 하위 4개 섹션 API를 병렬 호출한다", async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith("/companies/")) return Promise.resolve(SUMMARY_RESPONSE);
      if (path.includes("/financials")) return Promise.resolve({ securityId: "sec-1", currency: "KRW", items: [], annotations: { minFiscalYear: 2015, isAnnualOnly: false } });
      if (path.includes("/disclosures")) return Promise.resolve({ securityId: "sec-1", items: [], page: 1, pageSize: 20, hasMore: false });
      if (path.includes("/quotes")) return Promise.resolve({ securityId: "sec-1", currency: "KRW", candles: [], marketCapSeries: [], sharesMeta: null });
      if (path.includes("/valuechains")) return Promise.resolve({ securityId: "sec-1", items: [] });
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    render(<CompanyDetailView ticker="005930" market={null} asOf={null} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("/financials"));
      expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("/disclosures"));
      expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("/quotes"));
      expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("/valuechains"));
    });
  });

  it("summary 404면 하위 4개 쿼리를 발화하지 않고 NotFound 폴백만 표시한다", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("COMPANY_NOT_FOUND", 404, "not found"));

    render(<CompanyDetailView ticker="NOPE" market={null} asOf={null} />, { wrapper: createWrapper() });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock).toHaveBeenCalledWith("/companies/NOPE");
  });

  it("asOf가 있으면 배너를 표시하고 닫기 클릭 시 사라진다", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith("/companies/")) return Promise.resolve(SUMMARY_RESPONSE);
      return Promise.resolve({ items: [], candles: [], marketCapSeries: [], sharesMeta: null, currency: "KRW", securityId: "sec-1", page: 1, pageSize: 20, hasMore: false, annotations: { minFiscalYear: 2015, isAnnualOnly: false } });
    });

    render(<CompanyDetailView ticker="005930" market={null} asOf="2026-05-02" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(screen.getByText(/2026-05-02/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /닫기/ }));

    expect(screen.queryByText(/2026-05-02/)).not.toBeInTheDocument();
  });

  it("시장 선택 시 router.replace로 URL을 갱신한다", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockRejectedValue(new ApiError("TICKER_AMBIGUOUS", 409, "ambiguous"));

    render(<CompanyDetailView ticker="005930" market={null} asOf={null} />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByRole("button", { name: /한국거래소/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /한국거래소/ }));

    expect(routerReplaceMock).toHaveBeenCalledWith("/companies/005930?market=KRX");
  });
});
