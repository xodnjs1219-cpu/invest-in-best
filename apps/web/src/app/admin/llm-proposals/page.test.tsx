// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminLlmProposalsPage from "@/app/admin/llm-proposals/page";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const listResponseBody = (overrides?: Partial<{ items: unknown[] }>) => ({
  data: {
    items: [],
    page: 1,
    pageSize: 20,
    hasMore: false,
    ...overrides,
  },
});

const proposalItem = {
  proposalId: "11111111-1111-4111-8111-111111111111",
  chain: { chainId: "chain-1", name: "반도체 밸류체인" },
  proposalType: "relation_add",
  sourceNode: { nodeId: "n-1", displayName: "삼성전자", nodeKind: "listed_company", ticker: "005930" },
  targetNode: { nodeId: "n-2", displayName: "SK하이닉스", nodeKind: "listed_company", ticker: "000660" },
  relationType: { relationTypeId: "rt-1", name: "공급", isActive: true },
  disclosure: {
    disclosureId: "d-1",
    title: "공급계약체결",
    disclosureDate: "2026-07-01",
    url: "https://dart.fss.or.kr/x",
    source: "dart",
  },
  rationale: "공시 내용에 따르면...",
  status: "pending",
  basedOnSnapshotId: "snap-0",
  applicability: { isApplicable: true, reason: null },
  createdAt: "2026-07-01T00:00:00.000Z",
  reviewedBy: null,
  reviewedAt: null,
  resultingSnapshotId: null,
};

describe("AdminLlmProposalsPage", () => {
  const originalFetch = global.fetch;
  const originalConfirm = window.confirm;

  beforeEach(() => {
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  it("진입 시 pending 목록을 자동 조회해 렌더링한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(listResponseBody({ items: [proposalItem] })), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // Act
    render(<AdminLlmProposalsPage />, { wrapper });

    // Assert
    await waitFor(() => expect(screen.getByText(/삼성전자/)).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/llm-proposals?status=pending&page=1"),
      expect.anything(),
    );
  });

  it("빈 목록이면 빈 상태 안내를 표시한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(listResponseBody()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // Act
    render(<AdminLlmProposalsPage />, { wrapper });

    // Assert
    await waitFor(() => expect(screen.getByText("검토할 제안이 없습니다.")).toBeInTheDocument());
  });

  it("승인 성공 시 목록을 재조회하고 패널을 닫는다", async () => {
    // Arrange
    let listCallCount = 0;
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/approve")) {
        return new Response(
          JSON.stringify({
            data: { proposalId: proposalItem.proposalId, status: "approved", resultingSnapshotId: "snap-1", effectiveAt: "2026-07-08T00:00:00.000Z" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      listCallCount += 1;
      return new Response(JSON.stringify(listResponseBody({ items: listCallCount === 1 ? [proposalItem] : [] })), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    render(<AdminLlmProposalsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText(/삼성전자/)).toBeInTheDocument());

    // Act — 행 선택 후 상세 패널의 승인 버튼 클릭
    fireEvent.click(screen.getByText(/삼성전자/));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "승인" }).length).toBeGreaterThan(0));
    const approveButtons = screen.getAllByRole("button", { name: "승인" });
    fireEvent.click(approveButtons[0]);

    // Assert
    await waitFor(() => expect(listCallCount).toBeGreaterThanOrEqual(2));
  });
});
