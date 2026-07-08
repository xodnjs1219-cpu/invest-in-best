// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChainViewHeader } from "@/features/valuechains/components/ChainViewHeader";
import { useChainViewState } from "@/features/valuechains/context/chain-view-context";

vi.mock("@/features/valuechains/context/chain-view-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/valuechains/context/chain-view-context")
  >("@/features/valuechains/context/chain-view-context");
  return { ...actual, useChainViewState: vi.fn() };
});

// UC-014 CloneChainButton(→useCloneChainAction)이 next/navigation·useCurrentUser·QueryClient에 의존하므로 mock/wrap한다.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/valuechains/chain-1",
}));
vi.mock("@/features/auth/context/current-user-provider", () => ({
  useCurrentUser: () => ({ status: "unauthenticated" }),
}));

const render = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const mockState = (overrides: {
  structure: unknown;
  isOwner: boolean;
  chainId?: string;
}) => {
  vi.mocked(useChainViewState).mockReturnValue({ chainId: "chain-1", ...overrides } as never);
};

describe("ChainViewHeader", () => {
  it("구조 로딩 전에는 편집 버튼 없이 렌더링된다", () => {
    // Arrange
    mockState({ structure: { status: "loading" }, isOwner: false });

    // Act
    render(<ChainViewHeader />);

    // Assert
    expect(screen.queryByRole("link", { name: /편집/ })).not.toBeInTheDocument();
  });

  it("산업 중심 체인은 체인명만 표시하고 focusSecurity는 생략한다", () => {
    // Arrange
    mockState({
      structure: {
        status: "ready",
        data: {
          chain: {
            name: "2차전지",
            focusType: "industry",
            focusSecurity: null,
            isOwner: false,
          },
        },
      },
      isOwner: false,
    });

    // Act
    render(<ChainViewHeader />);

    // Assert
    expect(screen.getByText("2차전지")).toBeInTheDocument();
  });

  it("기업 중심 체인은 focusSecurity 티커·종목명을 병기한다", () => {
    // Arrange
    mockState({
      structure: {
        status: "ready",
        data: {
          chain: {
            name: "삼성전자 밸류체인",
            focusType: "company",
            focusSecurity: { id: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
            isOwner: false,
          },
        },
      },
      isOwner: false,
    });

    // Act
    render(<ChainViewHeader />);

    // Assert
    expect(screen.getByText("삼성전자 밸류체인")).toBeInTheDocument();
    expect(screen.getByText(/005930/)).toBeInTheDocument();
  });

  it("isOwner=true면 편집 진입 링크를 표시한다", () => {
    // Arrange
    mockState({
      structure: {
        status: "ready",
        data: {
          chain: { name: "내 체인", focusType: "industry", focusSecurity: null, isOwner: true },
        },
      },
      isOwner: true,
    });

    // Act
    render(<ChainViewHeader />);

    // Assert
    const link = screen.getByRole("link", { name: /편집/ });
    expect(link).toHaveAttribute("href", "/valuechains/chain-1/edit");
  });

  it("isOwner=true면 삭제 버튼도 함께 표시한다(UC-019)", () => {
    // Arrange
    mockState({
      structure: {
        status: "ready",
        data: {
          chain: {
            name: "내 체인",
            chainType: "user",
            focusType: "industry",
            focusSecurity: null,
            isOwner: true,
          },
        },
      },
      isOwner: true,
    });

    // Act
    render(<ChainViewHeader />);

    // Assert
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("isOwner=false면 편집 진입 링크를 표시하지 않는다", () => {
    // Arrange
    mockState({
      structure: {
        status: "ready",
        data: {
          chain: { name: "공식 체인", focusType: "industry", focusSecurity: null, isOwner: false },
        },
      },
      isOwner: false,
    });

    // Act
    render(<ChainViewHeader />);

    // Assert
    expect(screen.queryByRole("link", { name: /편집/ })).not.toBeInTheDocument();
  });

  it("공식 체인(chainType='official')이면 복제 버튼을 표시한다(UC-014)", () => {
    // Arrange
    mockState({
      structure: {
        status: "ready",
        data: {
          chain: {
            name: "공식 체인",
            chainType: "official",
            focusType: "industry",
            focusSecurity: null,
            isOwner: false,
          },
        },
      },
      isOwner: false,
    });

    // Act
    render(<ChainViewHeader />);

    // Assert
    expect(screen.getByRole("button", { name: /복제/ })).toBeInTheDocument();
  });

  it("사용자 체인(chainType='user')이면 복제 버튼을 표시하지 않는다(UC-014 대상 제한)", () => {
    // Arrange
    mockState({
      structure: {
        status: "ready",
        data: {
          chain: {
            name: "내 체인",
            chainType: "user",
            focusType: "industry",
            focusSecurity: null,
            isOwner: true,
          },
        },
      },
      isOwner: true,
    });

    // Act
    render(<ChainViewHeader />);

    // Assert
    expect(screen.queryByRole("button", { name: /복제/ })).not.toBeInTheDocument();
  });
});
