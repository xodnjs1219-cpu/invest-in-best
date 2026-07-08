// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecuritySearchTab } from "@/features/valuechains/editor/components/SecuritySearchTab";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(status === 200 ? JSON.stringify({ data }) : JSON.stringify({ error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

const buildSearchResponse = (items: unknown[]) => ({ items, page: 1, pageSize: 20, hasMore: false });

describe("SecuritySearchTab", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("검색 후 결과 선택 시 onAdd(SecurityRef) 호출", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        buildSearchResponse([
          { id: "s1", ticker: "005930", name: "삼성전자", englishName: "Samsung", market: "KRX", listingStatus: "listed" },
        ]),
      ),
    );
    const onAdd = vi.fn();
    const user = userEvent.setup();

    render(<SecuritySearchTab onAdd={onAdd} usedSecurityIds={new Set()} disabled={false} />, { wrapper });

    await user.type(screen.getByRole("textbox"), "삼성전자");
    await waitFor(() => expect(screen.getByText("삼성전자")).toBeInTheDocument(), { timeout: 3000 });

    await user.click(screen.getByText("삼성전자"));
    expect(onAdd).toHaveBeenCalledWith({ securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" });
  });

  it("이미 추가된 종목(usedSecurityIds 포함)은 '추가됨' 표시", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        buildSearchResponse([
          { id: "s1", ticker: "005930", name: "삼성전자", englishName: null, market: "KRX", listingStatus: "listed" },
        ]),
      ),
    );
    const user = userEvent.setup();

    render(
      <SecuritySearchTab onAdd={vi.fn()} usedSecurityIds={new Set(["s1"])} disabled={false} />,
      { wrapper },
    );

    await user.type(screen.getByRole("textbox"), "삼성전자");
    await waitFor(() => expect(screen.getByText("추가됨")).toBeInTheDocument(), { timeout: 3000 });
  });

  it("결과 없음 → 빈 결과 안내 표시(E3)", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildSearchResponse([])));
    const user = userEvent.setup();

    render(<SecuritySearchTab onAdd={vi.fn()} usedSecurityIds={new Set()} disabled={false} />, { wrapper });

    await user.type(screen.getByRole("textbox"), "존재하지않는종목명");
    await waitFor(() => expect(screen.getByText(/검색 결과가 없습니다/)).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it("disabled=true면 검색 입력이 비활성화된다(E1)", () => {
    render(<SecuritySearchTab onAdd={vi.fn()} usedSecurityIds={new Set()} disabled />, { wrapper });
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
