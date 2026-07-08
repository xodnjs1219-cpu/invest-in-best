// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChainViewHeader } from "@/features/valuechains/components/ChainViewHeader";
import { useChainViewState } from "@/features/valuechains/context/chain-view-context";

vi.mock("@/features/valuechains/context/chain-view-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/valuechains/context/chain-view-context")
  >("@/features/valuechains/context/chain-view-context");
  return { ...actual, useChainViewState: vi.fn() };
});

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
});
