// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminBatchesPage from "@/app/admin/batches/page";

/**
 * "부분 성공" 등 상태 라벨은 필터 select의 옵션에도 동일 텍스트로 존재하므로,
 * 테이블(role="table") 스코프 안에서만 조회해 행을 특정한다.
 */
const getRunsTableRowText = (text: string) => within(screen.getByRole("table")).getByText(text);

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const RUN_ID = "11111111-1111-4111-8111-111111111111";

const runItem = {
  id: RUN_ID,
  jobType: "collect_financials",
  status: "partial_success",
  startedAt: "2026-07-05T02:00:00+09:00",
  finishedAt: "2026-07-05T02:41:12+09:00",
  processedCount: 2480,
  failedCount: 12,
  isCarriedOver: true,
  targetMarket: "KRX",
  hasErrorLog: true,
};

const emptyBackfillProgress = {
  totalCheckpoints: 0,
  completedCheckpoints: 0,
  isCompleted: false,
  latestRun: null,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify({ data: body }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("AdminBatchesPage", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("진입 시 실행 이력 목록과 백필 진행 카드를 자동 조회해 렌더링한다(Main 1~4)", async () => {
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/backfill/progress")) {
        return jsonResponse(emptyBackfillProgress);
      }
      if (url.includes("/runs")) {
        return jsonResponse({ runs: [runItem], pagination: { page: 1, pageSize: 20, totalCount: 1 } });
      }
      return jsonResponse({});
    });

    render(<AdminBatchesPage />, { wrapper });

    // "재무·공시 수집"은 필터 select의 옵션에도 존재하므로, 테이블 셀(td)에서만 유일하게
    // 매칭되는 상태 배지 텍스트("부분 성공")로 행 렌더 완료를 확인한다.
    await waitFor(() => expect(getRunsTableRowText("부분 성공")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("미실행")).toBeInTheDocument());
  });

  it("실행 이력이 없으면 빈 상태 안내를 표시한다(E1)", async () => {
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/backfill/progress")) {
        return jsonResponse(emptyBackfillProgress);
      }
      if (url.includes("/runs")) {
        return jsonResponse({ runs: [], pagination: { page: 1, pageSize: 20, totalCount: 0 } });
      }
      return jsonResponse({});
    });

    render(<AdminBatchesPage />, { wrapper });

    await waitFor(() => expect(screen.getByText("실행 이력이 없습니다.")).toBeInTheDocument());
  });

  it("행 선택 시 상세 패널이 열리고 errorLog·실패 목록을 로드한다(Main 6)", async () => {
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/backfill/progress")) {
        return jsonResponse(emptyBackfillProgress);
      }
      if (url.includes("/failures")) {
        return jsonResponse({ failures: [], pagination: { page: 1, pageSize: 20, totalCount: 0 } });
      }
      if (url.match(new RegExp(`/runs/${RUN_ID}$`))) {
        return jsonResponse({
          run: {
            id: RUN_ID,
            jobType: "collect_financials",
            status: "partial_success",
            startedAt: "2026-07-05T02:00:00+09:00",
            finishedAt: "2026-07-05T02:41:12+09:00",
            processedCount: 2480,
            failedCount: 12,
            isCarriedOver: true,
            targetMarket: "KRX",
            errorLog: "OpenDART 일일 한도 도달로 214건 이월",
          },
        });
      }
      if (url.includes("/runs")) {
        return jsonResponse({ runs: [runItem], pagination: { page: 1, pageSize: 20, totalCount: 1 } });
      }
      return jsonResponse({});
    });

    render(<AdminBatchesPage />, { wrapper });
    await waitFor(() => expect(getRunsTableRowText("부분 성공")).toBeInTheDocument());

    fireEvent.click(getRunsTableRowText("부분 성공"));

    await waitFor(() =>
      expect(screen.getByText(/OpenDART 일일 한도 도달로 214건 이월/)).toBeInTheDocument(),
    );
  });

  it("미존재 runId 상세 조회는 404 안내를 표시한다(E8)", async () => {
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/backfill/progress")) {
        return jsonResponse(emptyBackfillProgress);
      }
      if (url.match(new RegExp(`/runs/${RUN_ID}$`))) {
        return new Response(
          JSON.stringify({ error: { code: "RUN_NOT_FOUND", message: "실행 이력을 찾을 수 없습니다." } }),
          { status: 404, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/failures")) {
        return jsonResponse({ failures: [], pagination: { page: 1, pageSize: 20, totalCount: 0 } });
      }
      if (url.includes("/runs")) {
        return jsonResponse({ runs: [runItem], pagination: { page: 1, pageSize: 20, totalCount: 1 } });
      }
      return jsonResponse({});
    });

    render(<AdminBatchesPage />, { wrapper });
    await waitFor(() => expect(getRunsTableRowText("부분 성공")).toBeInTheDocument());

    fireEvent.click(getRunsTableRowText("부분 성공"));

    await waitFor(() =>
      expect(screen.getByText(/해당 실행 이력을 찾을 수 없습니다/)).toBeInTheDocument(),
    );
  });

  it("필터 변경 시 재조회 쿼리에 파라미터가 반영된다(Main 5)", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/backfill/progress")) {
        return jsonResponse(emptyBackfillProgress);
      }
      if (url.includes("/runs")) {
        return jsonResponse({ runs: [], pagination: { page: 1, pageSize: 20, totalCount: 0 } });
      }
      return jsonResponse({});
    });
    global.fetch = fetchMock;

    render(<AdminBatchesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText("실행 이력이 없습니다.")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("작업 종류"), { target: { value: "collect_financials" } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("jobType=collect_financials"),
        expect.anything(),
      ),
    );
  });
});
