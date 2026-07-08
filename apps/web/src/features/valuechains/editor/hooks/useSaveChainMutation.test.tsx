// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SaveChainRequest } from "@iib/domain";
import { useSaveChainMutation } from "./useSaveChainMutation";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(status < 400 ? JSON.stringify({ data }) : JSON.stringify({ error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const buildPayload = (): SaveChainRequest => ({
  name: "체인",
  focusType: "industry",
  focusSecurityId: null,
  baseSnapshotId: null,
  groups: [],
  nodes: [],
  edges: [],
});

describe("useSaveChainMutation", () => {
  it("chainId=null → POST 경로/본문 정확", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ chainId: "c1", snapshotId: "s1", effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 }, 201));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useSaveChainMutation(), { wrapper });
    result.current.mutate({ chainId: null, payload: buildPayload() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/valuechains");
    expect(url).not.toMatch(/\/valuechains\/.+/);
    expect((init as RequestInit).method).toBe("POST");
  });

  it("chainId 값 존재 → PUT 경로", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ chainId: "c1", snapshotId: "s2", effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 }, 200));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useSaveChainMutation(), { wrapper });
    result.current.mutate({ chainId: "c1", payload: { ...buildPayload(), baseSnapshotId: "s1" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/valuechains/c1");
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("retry 미수행(mutation 옵션 고정 — 회귀 테스트)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code: "VALUECHAINS.SAVE_FAILED", message: "실패" }, 500));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useSaveChainMutation(), { wrapper });
    result.current.mutate({ chainId: null, payload: buildPayload() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("chainType='official' + disclosureDate 지정 → body에 합성되어 전송(UC-021)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ chainId: "c1", snapshotId: "s1", effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 }, 201));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useSaveChainMutation(), { wrapper });
    result.current.mutate({
      chainId: null,
      payload: buildPayload(),
      chainType: "official",
      disclosureDate: "2026-07-01",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chainType).toBe("official");
    expect(body.disclosureDate).toBe("2026-07-01");
  });

  it("chainType 미지정 → body에 chainType/disclosureDate 필드 없음(user 저장 회귀)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ chainId: "c1", snapshotId: "s1", effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 }, 201));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useSaveChainMutation(), { wrapper });
    result.current.mutate({ chainId: null, payload: buildPayload() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chainType).toBeUndefined();
    expect(body.disclosureDate).toBeUndefined();
  });
});
