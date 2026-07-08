// @vitest-environment jsdom
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import ValuechainViewPage from "@/app/(public)/valuechains/[chainId]/page";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const apiFetchMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const searchParamsRef = vi.hoisted(() => ({ current: new URLSearchParams() }));

vi.mock("@/lib/http/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http/api-client")>(
    "@/lib/http/api-client",
  );
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock, replace: routerReplaceMock }),
  useSearchParams: () => searchParamsRef.current,
}));

const CHAIN_RESPONSE = {
  chain: {
    id: "chain-1",
    name: "2차전지",
    chainType: "official",
    focusType: "industry",
    focusSecurity: null,
    isOwner: false,
  },
  snapshot: { id: "snap-1", effectiveAt: "2026-07-01T09:30:00+09:00", changeSource: "admin_edit" },
  groups: [],
  nodes: [],
  edges: [],
  dataFreshness: {
    sources: ["금융감독원 DART", "SEC EDGAR", "토스증권"],
    lastCollectedAt: { quotes: null, financials: null, fxAndMarketHours: null },
  },
};

const TIMELINE_RESPONSE = { range: { minDate: "2015-01-01", maxDate: "2026-07-06" }, markers: [] };
const DAILY_METRICS_RESPONSE = {
  chainId: "chain-1",
  current: null,
  series: [],
  annotations: {
    baseCurrency: "KRW",
    fxBasis: "daily",
    sharesAsOfDateMin: null,
    sharesAsOfDateMax: null,
    isClosingConfirmed: true,
  },
};
const QUARTERLY_METRICS_RESPONSE = {
  chainId: "chain-1",
  current: null,
  series: [],
  annotations: { baseCurrency: "KRW", fxBasis: "quarter_end", revenueOverlapNotice: true },
};
const SNAPSHOT_AT_RESPONSE = {
  snapshot: {
    snapshotId: "snap-old",
    effectiveAt: "2026-05-02T09:30:00+09:00",
    changeSource: "admin_edit",
    groups: [],
    nodes: [],
    edges: [],
  },
  metrics: { daily: null, quarterly: null },
};

const setupDefaultApiFetch = () => {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.includes("/metrics/daily")) return DAILY_METRICS_RESPONSE;
    if (path.includes("/metrics/quarterly")) return QUARTERLY_METRICS_RESPONSE;
    if (path.includes("/timeline")) return TIMELINE_RESPONSE;
    if (path.includes("/snapshot-at")) return SNAPSHOT_AT_RESPONSE;
    return CHAIN_RESPONSE;
  });
};

/** Provider 계층에서만 필요한 QueryClientProvider를 씌워 페이지 컴포넌트를 렌더링한다. */
const renderPageWithQueryClient = async (props: {
  params: Promise<{ chainId: string }>;
  searchParams: Promise<{ at?: string }>;
}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const PageElement = await ValuechainViewPage(props);
  return render(<Wrapper>{PageElement}</Wrapper>);
};

describe("ValuechainViewPage", () => {
  beforeAll(() => {
    setupDefaultApiFetch();
  });

  it("/valuechains/{uuid} 직접 진입 — 페이지 셸 + 클라이언트 구조 로드가 정상 동작한다", async () => {
    // Act
    await renderPageWithQueryClient({
      params: Promise.resolve({ chainId: "chain-1" }),
      searchParams: Promise.resolve({}),
    });

    // Assert
    await waitFor(() => expect(screen.getByText("2차전지")).toBeInTheDocument());
  });

  it("유효한 과거 날짜 ?at=로 진입하면 시점 복원 쿼리가 발화한다(UC-012 배선 활성화)", async () => {
    // Act
    await renderPageWithQueryClient({
      params: Promise.resolve({ chainId: "chain-1" }),
      searchParams: Promise.resolve({ at: "2026-05-02" }),
    });

    // Assert
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/valuechains/chain-1/snapshot-at?date=2026-05-02"),
      ),
    );
  });
});
