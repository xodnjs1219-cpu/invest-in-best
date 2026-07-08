// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFinancials } from "@/features/companies/hooks/useFinancials";

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

describe("useFinancials", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("securityId가 undefined면 fetch가 발생하지 않는다(enabled 게이트)", () => {
    renderHook(() => useFinancials(undefined, { fromYear: 2022, toYear: 2026 }), {
      wrapper: createWrapper(),
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("securityId가 있으면 fromYear/toYear를 쿼리스트링으로 전달한다", async () => {
    apiFetchMock.mockResolvedValue({ items: [] });

    renderHook(() => useFinancials("sec-1", { fromYear: 2022, toYear: 2026 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith("/securities/sec-1/financials?fromYear=2022&toYear=2026");
  });
});
