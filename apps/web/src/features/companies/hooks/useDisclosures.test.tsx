// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDisclosures } from "@/features/companies/hooks/useDisclosures";

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

describe("useDisclosures", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("securityId가 undefined면 fetch가 발생하지 않는다", () => {
    renderHook(() => useDisclosures(undefined), { wrapper: createWrapper() });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("hasMore=true 후 fetchNextPage() 호출 시 page=2를 요청하고 목록을 누적한다", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ items: [{ id: "1" }], page: 1, pageSize: 20, hasMore: true })
      .mockResolvedValueOnce({ items: [{ id: "2" }], page: 2, pageSize: 20, hasMore: false });

    const { result } = renderHook(() => useDisclosures("sec-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/securities/sec-1/disclosures?page=1");

    const nextPageResult = await result.current.fetchNextPage();

    expect(apiFetchMock).toHaveBeenCalledWith("/securities/sec-1/disclosures?page=2");
    expect(nextPageResult.data?.pages).toHaveLength(2);
  });

  it("hasMore=false면 hasNextPage가 false다", async () => {
    apiFetchMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, hasMore: false });

    const { result } = renderHook(() => useDisclosures("sec-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
