// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FocusSecuritySearch } from "@/features/valuechains/editor/components/FocusSecuritySearch";

const buildResponse = (items: unknown[] = []) => ({ items, page: 1, pageSize: 20, hasMore: false });

const jsonResponse = (data: unknown, status = 200) =>
  new Response(status === 200 ? JSON.stringify({ data }) : JSON.stringify({ error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("FocusSecuritySearch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("검색어 입력 후 디바운스 경과 시 결과를 표시한다", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        buildResponse([
          { id: "s1", ticker: "005930", name: "삼성전자", englishName: null, market: "KRX", listingStatus: "listed" },
        ]),
      ),
    );

    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FocusSecuritySearch onSelect={onSelect} />, { wrapper });

    await user.type(screen.getByRole("textbox"), "삼성");

    await waitFor(() => expect(screen.getByText("삼성전자")).toBeInTheDocument(), { timeout: 3000 });
  });

  it("결과 항목 선택 시 onSelect(SecurityRef)가 호출되고 검색어가 초기화된다", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        buildResponse([
          { id: "s1", ticker: "005930", name: "삼성전자", englishName: null, market: "KRX", listingStatus: "listed" },
        ]),
      ),
    );

    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FocusSecuritySearch onSelect={onSelect} />, { wrapper });

    const input = screen.getByRole("textbox");
    await user.type(input, "삼성");
    await waitFor(() => expect(screen.getByText("삼성전자")).toBeInTheDocument(), { timeout: 3000 });

    await user.click(screen.getByText("삼성전자"));

    expect(onSelect).toHaveBeenCalledWith({
      securityId: "s1",
      ticker: "005930",
      name: "삼성전자",
      market: "KRX",
    });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("검색 결과 없음이면 미지정 진행 가능 안내를 표시한다(E8)", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildResponse([])));

    const user = userEvent.setup();
    render(<FocusSecuritySearch onSelect={vi.fn()} />, { wrapper });

    await user.type(screen.getByRole("textbox"), "없는종목");

    await waitFor(
      () => expect(screen.getByText(/검색 결과 없음/)).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it("검색어가 비어 있으면 API를 호출하지 않는다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildResponse([])));
    global.fetch = fetchMock;

    render(<FocusSecuritySearch onSelect={vi.fn()} />, { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
