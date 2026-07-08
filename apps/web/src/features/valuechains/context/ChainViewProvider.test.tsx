// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChainViewProvider } from "@/features/valuechains/context/ChainViewProvider";
import {
  useChainViewActions,
  useChainViewState,
} from "@/features/valuechains/context/chain-view-context";
import { ApiError } from "@/lib/http/api-client";

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
  nodes: [
    {
      id: "n1",
      groupId: null,
      nodeKind: "listed_company",
      security: { id: "s1", ticker: "005930", name: "삼성전자", market: "KRX", listingStatus: "listed" },
      subjectName: null,
      subjectType: null,
      subjectMemo: null,
      position: { x: 10, y: 20 },
    },
  ],
  edges: [],
  dataFreshness: {
    sources: ["금융감독원 DART", "SEC EDGAR", "토스증권"],
    lastCollectedAt: { quotes: null, financials: null, fxAndMarketHours: null },
  },
};

const TIMELINE_RESPONSE = {
  range: { minDate: "2015-01-01", maxDate: "2026-07-06" },
  markers: [],
};

const DAILY_METRICS_RESPONSE = {
  chainId: "chain-1",
  current: null,
  series: [],
  annotations: { baseCurrency: "KRW", fxBasis: "daily", sharesAsOfDateMin: null, sharesAsOfDateMax: null, isClosingConfirmed: true },
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

/** 경로별로 다른 응답을 주는 기본 라우팅 mock — 개별 테스트에서 override 가능. */
const setupDefaultApiFetch = () => {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.includes("/metrics/daily")) return DAILY_METRICS_RESPONSE;
    if (path.includes("/metrics/quarterly")) return QUARTERLY_METRICS_RESPONSE;
    if (path.includes("/timeline")) return TIMELINE_RESPONSE;
    if (path.includes("/snapshot-at")) return SNAPSHOT_AT_RESPONSE;
    return CHAIN_RESPONSE;
  });
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
};

/** 상태를 화면에 노출해 검증하는 테스트 전용 소비 컴포넌트. */
const StateProbe = () => {
  const state = useChainViewState();
  return (
    <div>
      <span data-testid="status">{state.structure.status}</span>
      <span data-testid="selectedDate">{state.selectedDate ?? "null"}</span>
      <span data-testid="nodeCount">
        {state.structure.status === "ready" ? state.renderGraph?.nodes.length : "n/a"}
      </span>
    </div>
  );
};

const RetryProbe = () => {
  const { retryStructure } = useChainViewActions();
  return (
    <button type="button" onClick={retryStructure}>
      재시도
    </button>
  );
};

const ReturnToLatestProbe = () => {
  const { returnToLatest } = useChainViewActions();
  return (
    <button type="button" onClick={returnToLatest}>
      최신으로 돌아가기
    </button>
  );
};

describe("ChainViewProvider", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    routerPushMock.mockReset();
    routerReplaceMock.mockReset();
    searchParamsRef.current = new URLSearchParams();
  });

  it("Provider 마운트(유효 공식 체인) — 구조 쿼리 1회 발화 → loading에서 ready로 전이한다", async () => {
    // Arrange
    setupDefaultApiFetch();

    // Act
    render(
      <ChainViewProvider chainId="chain-1" atParam={null}>
        <StateProbe />
      </ChainViewProvider>,
      { wrapper: createWrapper() },
    );

    // Assert
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
    expect(screen.getByTestId("nodeCount").textContent).toBe("1");
    expect(apiFetchMock).toHaveBeenCalledWith("/valuechains/chain-1");
  });

  it("Provider 없이 useChainViewState()를 호출하면 명시적 Error를 throw한다", () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const BareProbe = () => {
      useChainViewState();
      return null;
    };

    // Act & Assert
    expect(() => render(<BareProbe />)).toThrow(
      "useChainViewState는 ChainViewProvider 내부에서만 호출할 수 있습니다.",
    );
    consoleErrorSpy.mockRestore();
  });

  it("404 응답이면 structure.status='not-found'가 된다(401/403/400도 동일 — C-2 방어)", async () => {
    // Arrange
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/valuechains/chain-1") {
        throw new ApiError("CHAIN_NOT_FOUND", 404, "not found");
      }
      if (path.includes("/timeline")) return TIMELINE_RESPONSE;
      if (path.includes("/metrics/daily")) return DAILY_METRICS_RESPONSE;
      if (path.includes("/metrics/quarterly")) return QUARTERLY_METRICS_RESPONSE;
      return CHAIN_RESPONSE;
    });

    // Act
    render(
      <ChainViewProvider chainId="chain-1" atParam={null}>
        <StateProbe />
      </ChainViewProvider>,
      { wrapper: createWrapper() },
    );

    // Assert
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("not-found"));
  });

  it("500 응답이면 structure.status='error'가 되고, retryStructure() 호출 시 재조회한다", async () => {
    // Arrange
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/valuechains/chain-1") {
        throw new ApiError("STRUCTURE_LOAD_FAILED", 500, "boom");
      }
      if (path.includes("/timeline")) return TIMELINE_RESPONSE;
      if (path.includes("/metrics/daily")) return DAILY_METRICS_RESPONSE;
      if (path.includes("/metrics/quarterly")) return QUARTERLY_METRICS_RESPONSE;
      return CHAIN_RESPONSE;
    });
    const user = userEvent.setup();

    // Act
    render(
      <ChainViewProvider chainId="chain-1" atParam={null}>
        <StateProbe />
        <RetryProbe />
      </ChainViewProvider>,
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("error"), {
      timeout: 3000,
    });
    const callsBefore = apiFetchMock.mock.calls.filter(([p]) => p === "/valuechains/chain-1").length;
    await user.click(screen.getByRole("button", { name: "재시도" }));

    // Assert
    await waitFor(() => {
      const callsAfter = apiFetchMock.mock.calls.filter(([p]) => p === "/valuechains/chain-1").length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });

  it("유효한 과거 날짜 atParam으로 마운트하면 S1=D로 시작하고 snapshot-at 쿼리가 발화한다(UC-012 배선 활성화)", async () => {
    // Arrange
    setupDefaultApiFetch();

    // Act
    render(
      <ChainViewProvider chainId="chain-1" atParam="2026-05-02">
        <StateProbe />
      </ChainViewProvider>,
      { wrapper: createWrapper() },
    );

    // Assert — S1이 즉시 채워짐(atParam 배선), snapshot-at 쿼리가 호출되어 결국 ready에 도달(무한 로딩 없음)
    expect(screen.getByTestId("selectedDate").textContent).toBe("2026-05-02");
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/valuechains/chain-1/snapshot-at?date=2026-05-02"),
    );
  });

  it("무효한 atParam(형식 오류)으로 마운트하면 S1=null로 시작한다", async () => {
    // Arrange
    setupDefaultApiFetch();

    // Act
    render(
      <ChainViewProvider chainId="chain-1" atParam="2026/05/02">
        <StateProbe />
      </ChainViewProvider>,
      { wrapper: createWrapper() },
    );

    // Assert
    expect(screen.getByTestId("selectedDate").textContent).toBe("null");
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
  });

  it("시점 딥링크 진입 후 '최신으로 돌아가기' 클릭 시 URL이 최종적으로 ?at= 없이 정리된다 (회귀: 경쟁 상태로 되돌리는 replace가 실행되면 안 됨)", async () => {
    // Arrange
    searchParamsRef.current = new URLSearchParams("at=2026-05-02");
    setupDefaultApiFetch();
    const user = userEvent.setup();

    // Act
    render(
      <ChainViewProvider chainId="chain-1" atParam="2026-05-02">
        <StateProbe />
        <ReturnToLatestProbe />
      </ChainViewProvider>,
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
    routerReplaceMock.mockClear();

    await user.click(screen.getByRole("button", { name: "최신으로 돌아가기" }));
    await waitFor(() => expect(screen.getByTestId("selectedDate").textContent).toBe("null"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));

    // Assert — replace가 여러 번 호출되더라도, 그 어떤 호출도 ?at=2026-05-02로 되돌리면 안 된다.
    // (마지막 호출이 반드시 ?at= 파라미터를 제거하는 형태여야 한다.)
    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalled();
    });
    const calls = routerReplaceMock.mock.calls.map(([url]) => url as string);
    expect(calls.some((url) => url.includes("at=2026-05-02"))).toBe(false);
    const lastCall = calls[calls.length - 1];
    expect(lastCall).not.toContain("at=");
  });
});
