// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminRelationTypesPage from "@/app/admin/relation-types/page";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const listResponseBody = (items: unknown[] = []) => ({ data: { relationTypes: items } });

const relationTypeItem = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "공급",
  isDirected: true,
  isActive: true,
  isInUse: false,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

describe("AdminRelationTypesPage (M14)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("진입 시 목록을 자동 조회해 렌더링한다(Main-1·2)", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(listResponseBody([relationTypeItem])), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // Act
    render(<AdminRelationTypesPage />, { wrapper });

    // Assert
    await waitFor(() => expect(screen.getByText("공급")).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/relation-types"),
      expect.anything(),
    );
  });

  it("빈 목록이면 빈 상태 안내를 표시한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(listResponseBody()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // Act
    render(<AdminRelationTypesPage />, { wrapper });

    // Assert
    await waitFor(() => expect(screen.getByText("등록된 관계 종류가 없습니다.")).toBeInTheDocument());
  });

  it("추가 성공 시 다이얼로그가 닫히고 토스트가 표시된다(Main-3)", async () => {
    // Arrange
    const user = userEvent.setup();
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      callCount += 1;
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            data: { id: "new-id", name: "라이선스", isDirected: true, isActive: true },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(listResponseBody(callCount > 1 ? [relationTypeItem] : [])), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    render(<AdminRelationTypesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText("등록된 관계 종류가 없습니다.")).toBeInTheDocument());

    // Act
    await user.click(screen.getByRole("button", { name: "관계 종류 추가" }));
    await user.type(screen.getByLabelText("이름"), "라이선스");
    await user.click(screen.getByRole("button", { name: "추가" }));

    // Assert
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("관계 종류를 추가했습니다.")).toBeInTheDocument();
  });

  it("사용 중 종류 비활성화 시 영향 안내 다이얼로그를 거쳐 비활성 배지로 전환된다(Main-5)", async () => {
    // Arrange
    const user = userEvent.setup();
    const inUseItem = { ...relationTypeItem, isInUse: true };
    let isDeactivated = false;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        isDeactivated = true;
        return new Response(
          JSON.stringify({ data: { id: inUseItem.id, name: inUseItem.name, isDirected: true, isActive: false } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      const item = isDeactivated ? { ...inUseItem, isActive: false } : inUseItem;
      return new Response(JSON.stringify(listResponseBody([item])), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    render(<AdminRelationTypesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText("공급")).toBeInTheDocument());

    // Act
    await user.click(screen.getByRole("button", { name: "비활성화" }));
    const alertDialog = await screen.findByRole("alertdialog");
    expect(screen.getByText(/기존 관계와 과거 스냅샷은 그대로 유지/)).toBeInTheDocument();
    const { getByRole } = within(alertDialog);
    await user.click(getByRole("button", { name: "비활성화" }));

    // Assert
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("비활성화했습니다.")).toBeInTheDocument());
  });

  it("재활성화는 확인 다이얼로그 없이 즉시 실행된다(E4)", async () => {
    // Arrange
    const user = userEvent.setup();
    const inactiveItem = { ...relationTypeItem, isActive: false };
    let isReactivated = false;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        isReactivated = true;
        return new Response(
          JSON.stringify({ data: { id: inactiveItem.id, name: inactiveItem.name, isDirected: true, isActive: true } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      const item = isReactivated ? { ...inactiveItem, isActive: true } : inactiveItem;
      return new Response(JSON.stringify(listResponseBody([item])), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    render(<AdminRelationTypesPage />, { wrapper });
    await waitFor(() => expect(screen.getByRole("button", { name: "재활성화" })).toBeInTheDocument());

    // Act
    await user.click(screen.getByRole("button", { name: "재활성화" }));

    // Assert
    await waitFor(() => expect(screen.getByText("재활성화했습니다.")).toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("서버 오류 시 오류 토스트를 표시하고 목록은 유지된다(E11)", async () => {
    // Arrange
    const user = userEvent.setup();
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "서버 오류" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(listResponseBody([relationTypeItem])), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    render(<AdminRelationTypesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText("공급")).toBeInTheDocument());

    // Act
    await user.click(screen.getByRole("button", { name: "관계 종류 추가" }));
    await user.type(screen.getByLabelText("이름"), "새이름");
    await user.click(screen.getByRole("button", { name: "추가" }));

    // Assert
    await waitFor(() => expect(screen.getByText(/다시 시도/)).toBeInTheDocument());
    // 다이얼로그는 유지되어 재시도 가능해야 한다(E11)
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("목록 조회 실패 시 재시도 버튼을 표시하고 클릭하면 다시 조회한다(E11)", async () => {
    // Arrange
    let attempt = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) {
        return new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "실패" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(listResponseBody([relationTypeItem])), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    render(<AdminRelationTypesPage />, { wrapper });
    await waitFor(() => expect(screen.getByText("관계 종류 목록을 불러오지 못했습니다.")).toBeInTheDocument());

    // Act
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    // Assert
    await waitFor(() => expect(screen.getByText("공급")).toBeInTheDocument());
  });
});
