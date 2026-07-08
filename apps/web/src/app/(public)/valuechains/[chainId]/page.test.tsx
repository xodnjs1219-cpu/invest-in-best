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
  nodes: [],
  edges: [],
  dataFreshness: {
    sources: ["금융감독원 DART", "SEC EDGAR", "토스증권"],
    lastCollectedAt: { quotes: null, financials: null, fxAndMarketHours: null },
  },
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
  it("/valuechains/{uuid} 직접 진입 — 페이지 셸 + 클라이언트 구조 로드가 정상 동작한다", async () => {
    // Arrange
    apiFetchMock.mockResolvedValue(CHAIN_RESPONSE);

    // Act
    await renderPageWithQueryClient({
      params: Promise.resolve({ chainId: "chain-1" }),
      searchParams: Promise.resolve({}),
    });

    // Assert
    await waitFor(() => expect(screen.getByText("2차전지")).toBeInTheDocument());
  });

  it("유효한 과거 날짜 ?at=로 진입해도 최신 구조가 표시된다(C5 배선 규칙 — 무한 로딩 없음)", async () => {
    // Arrange
    apiFetchMock.mockResolvedValue(CHAIN_RESPONSE);

    // Act
    await renderPageWithQueryClient({
      params: Promise.resolve({ chainId: "chain-1" }),
      searchParams: Promise.resolve({ at: "2026-05-02" }),
    });

    // Assert
    await waitFor(() => expect(screen.getByText("2차전지")).toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/valuechains/chain-1");
  });
});
