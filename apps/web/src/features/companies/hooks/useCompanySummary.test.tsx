// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCompanySummary } from "@/features/companies/hooks/useCompanySummary";
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

describe("useCompanySummary", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("market 미지정 시 요청 URL에 market 파라미터가 없다", async () => {
    apiFetchMock.mockResolvedValue({ security: { id: "sec-1" } });

    renderHook(() => useCompanySummary("005930"), { wrapper: createWrapper() });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith("/companies/005930");
  });

  it("market 지정 시 쿼리스트링에 포함된다", async () => {
    apiFetchMock.mockResolvedValue({ security: { id: "sec-1" } });

    renderHook(() => useCompanySummary("AAPL", "US"), { wrapper: createWrapper() });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith("/companies/AAPL?market=US");
  });

  it("409 응답은 재시도 없이 ApiError를 노출한다", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("TICKER_AMBIGUOUS", 409, "ambiguous"));

    const { result } = renderHook(() => useCompanySummary("005930"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(409);
  });

  it("404 응답은 재시도하지 않는다", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("COMPANY_NOT_FOUND", 404, "not found"));

    const { result } = renderHook(() => useCompanySummary("NOPE"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
