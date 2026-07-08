// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IsoDate } from "@iib/domain";
import { useChainDailyMetrics } from "@/features/valuechains/hooks/useChainDailyMetrics";
import { ApiError } from "@/lib/http/api-client";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http/api-client")>("@/lib/http/api-client");
  return { ...actual, apiFetch: apiFetchMock };
});

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
};

describe("useChainDailyMetrics", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("성공 시 데이터를 노출하고 from/to 쿼리스트링을 전달한다", async () => {
    apiFetchMock.mockResolvedValue({ chainId: "chain-1", current: null, series: [], annotations: {} });

    const { result } = renderHook(
      () =>
        useChainDailyMetrics("chain-1", {
          from: "2025-01-01" as IsoDate,
          to: "2026-01-01" as IsoDate,
          at: null,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/valuechains/chain-1/metrics/daily?from=2025-01-01&to=2026-01-01",
    );
  });

  it("at 지정 시 쿼리스트링에 포함된다", async () => {
    apiFetchMock.mockResolvedValue({ chainId: "chain-1", current: null, series: [], annotations: {} });

    renderHook(
      () =>
        useChainDailyMetrics("chain-1", {
          from: "2025-01-01" as IsoDate,
          to: "2026-01-01" as IsoDate,
          at: "2025-06-01" as IsoDate,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/valuechains/chain-1/metrics/daily?from=2025-01-01&to=2026-01-01&at=2025-06-01",
    );
  });

  it("404 오류는 재시도하지 않는다", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("CHAIN_NOT_FOUND", 404, "not found"));

    const { result } = renderHook(
      () => useChainDailyMetrics("chain-1", { from: "2025-01-01" as IsoDate, to: "2026-01-01" as IsoDate, at: null }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
