// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";

const pushMock = vi.hoisted(() => vi.fn());
const useCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
}));

vi.mock("@/features/auth/context/current-user-provider", () => ({
  useCurrentUser: useCurrentUserMock,
}));

const { MainExplorePage } = await import("@/features/explore/components/MainExplorePage");

const buildCardListResponse = (overrides?: Partial<Record<string, unknown>>) => ({
  items: [],
  pagination: { page: 1, limit: 20, totalCount: 0, hasMore: false },
  ...overrides,
});

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { data } : { error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MainExplorePage />
    </QueryClientProvider>,
  );
};

describe("MainExplorePage", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("비로그인 상태: 공식 체인 섹션·생성 버튼은 보이고 내 체인 섹션은 미노출된다", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "unauthenticated", user: null });
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildCardListResponse()));

    // Act
    renderPage();

    // Assert
    expect(screen.getByText("공식 밸류체인")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /새 밸류체인 만들기/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/내 밸류체인/)).not.toBeInTheDocument());
  });

  it("로그인 상태: 내 밸류체인 섹션이 추가로 노출된다", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "a@a.com", role: "user" },
    });
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildCardListResponse()));

    // Act
    renderPage();

    // Assert
    await waitFor(() => expect(screen.getByText("내 밸류체인")).toBeInTheDocument());
  });

  it("카드 클릭 시 /valuechains/[chainId]로 이동한다", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "unauthenticated", user: null });
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        buildCardListResponse({
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "반도체 밸류체인",
              chainType: "official",
              focusType: "industry",
              focusCompanyName: null,
              nodeCount: 3,
              latestMetric: null,
              updatedAt: "2026-07-08T00:00:00Z",
            },
          ],
        }),
      ),
    );

    // Act
    renderPage();
    await waitFor(() => expect(screen.getByText("반도체 밸류체인")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /반도체 밸류체인/ }));

    // Assert
    expect(pushMock).toHaveBeenCalledWith(
      "/valuechains/11111111-1111-4111-8111-111111111111",
    );
  });

  it("공식 체인 카드에 복제 버튼이 노출된다(UC-014)", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "unauthenticated", user: null });
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        buildCardListResponse({
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "반도체 밸류체인",
              chainType: "official",
              focusType: "industry",
              focusCompanyName: null,
              nodeCount: 3,
              latestMetric: null,
              updatedAt: "2026-07-08T00:00:00Z",
            },
          ],
        }),
      ),
    );

    // Act
    renderPage();
    await waitFor(() => expect(screen.getByText("반도체 밸류체인")).toBeInTheDocument());

    // Assert
    expect(screen.getByRole("button", { name: "복제" })).toBeInTheDocument();
  });

  it("내 체인 카드에 삭제 버튼이 노출된다(UC-019)", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "a@a.com", role: "user" },
    });
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/valuechains/mine")) {
        return Promise.resolve(
          jsonResponse(
            buildCardListResponse({
              items: [
                {
                  id: "22222222-2222-4222-8222-222222222222",
                  name: "내 체인",
                  chainType: "user",
                  focusType: "industry",
                  focusCompanyName: null,
                  nodeCount: 1,
                  latestMetric: null,
                  updatedAt: "2026-07-08T00:00:00Z",
                },
              ],
            }),
          ),
        );
      }
      return Promise.resolve(jsonResponse(buildCardListResponse()));
    });

    // Act
    renderPage();

    // Assert
    await waitFor(() => expect(screen.getByText("내 체인")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("내 체인 401(세션 만료) 시 게스트 뷰로 전환하고 공식 목록은 유지된다(엣지 7)", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "a@a.com", role: "user" },
    });
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/valuechains/mine")) {
        return Promise.resolve(
          jsonResponse({ code: "VALUECHAIN_LIST_UNAUTHORIZED", message: "unauth" }, 401),
        );
      }
      return Promise.resolve(jsonResponse(buildCardListResponse()));
    });

    // Act
    renderPage();

    // Assert
    expect(screen.getByText("공식 밸류체인")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("내 밸류체인")).not.toBeInTheDocument());
  });
  it("체인 검색어 입력(디바운스) 후 목록 요청 URL에 search가 포함된다", async () => {
    useCurrentUserMock.mockReturnValue({ status: "unauthenticated", user: null });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildCardListResponse()));
    global.fetch = fetchMock;
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox", { name: "밸류체인 검색" }), "반도체");

    await waitFor(
      () => {
        const urls = fetchMock.mock.calls.map((call) => String(call[0]));
        expect(urls.some((url) => url.includes("search=%EB%B0%98%EB%8F%84%EC%B2%B4"))).toBe(true);
      },
      { timeout: 3000 },
    );
  });

});
