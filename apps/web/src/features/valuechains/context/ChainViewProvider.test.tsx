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

vi.mock("@/lib/http/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http/api-client")>(
    "@/lib/http/api-client",
  );
  return { ...actual, apiFetch: apiFetchMock };
});

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

describe("ChainViewProvider", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("Provider 마운트(유효 공식 체인) — 구조 쿼리 1회 발화 → loading에서 ready로 전이한다", async () => {
    // Arrange
    apiFetchMock.mockResolvedValue(CHAIN_RESPONSE);

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
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
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
    apiFetchMock.mockRejectedValue(new ApiError("CHAIN_NOT_FOUND", 404, "not found"));

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
    apiFetchMock.mockRejectedValue(new ApiError("STRUCTURE_LOAD_FAILED", 500, "boom"));
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
    apiFetchMock.mockClear();
    await user.click(screen.getByRole("button", { name: "재시도" }));

    // Assert
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  });

  it("유효한 과거 날짜 atParam으로 마운트해도 S1=null 유지 — 구조 쿼리가 정상 발화한다(무한 로딩 없음, C5 배선 규칙)", async () => {
    // Arrange
    apiFetchMock.mockResolvedValue(CHAIN_RESPONSE);

    // Act
    render(
      <ChainViewProvider chainId="chain-1" atParam="2026-05-02">
        <StateProbe />
      </ChainViewProvider>,
      { wrapper: createWrapper() },
    );

    // Assert
    expect(screen.getByTestId("selectedDate").textContent).toBe("null");
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
