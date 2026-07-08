// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuotes } from "@/features/companies/hooks/useQuotes";

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

describe("useQuotes", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("securityId가 undefined면 fetch가 발생하지 않는다", () => {
    renderHook(() => useQuotes(undefined, { from: "2025-01-01", to: "2026-01-01" }), {
      wrapper: createWrapper(),
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("from/to를 쿼리스트링으로 전달한다", async () => {
    apiFetchMock.mockResolvedValue({ candles: [] });

    renderHook(() => useQuotes("sec-1", { from: "2025-01-01", to: "2026-01-01" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith("/securities/sec-1/quotes?from=2025-01-01&to=2026-01-01");
  });

  it("from/to 변경 시 새 queryKey로 재조회한다", async () => {
    apiFetchMock.mockResolvedValue({ candles: [] });

    const { rerender } = renderHook(
      ({ range }: { range: { from: string; to: string } }) => useQuotes("sec-1", range),
      { wrapper: createWrapper(), initialProps: { range: { from: "2025-01-01", to: "2026-01-01" } } },
    );

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    rerender({ range: { from: "2025-04-01", to: "2026-04-01" } });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
    expect(apiFetchMock).toHaveBeenLastCalledWith("/securities/sec-1/quotes?from=2025-04-01&to=2026-04-01");
  });
});
