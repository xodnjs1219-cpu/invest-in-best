// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataSourceFooter } from "@/features/valuechains/components/DataSourceFooter";
import { useChainViewState } from "@/features/valuechains/context/chain-view-context";

vi.mock("@/features/valuechains/context/chain-view-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/valuechains/context/chain-view-context")
  >("@/features/valuechains/context/chain-view-context");
  return { ...actual, useChainViewState: vi.fn() };
});

const mockState = (dataFreshness: unknown) => {
  vi.mocked(useChainViewState).mockReturnValue({ dataFreshness } as never);
};

describe("DataSourceFooter", () => {
  it("출처 3종과 잡별 최종 수집 시각을 표시한다", () => {
    // Arrange
    mockState({
      sources: ["금융감독원 DART", "SEC EDGAR", "토스증권"],
      lastCollectedAt: {
        quotes: "2026-07-05T15:10:00+09:00",
        financials: "2026-07-05T06:00:00+09:00",
        fxAndMarketHours: "2026-07-05T05:30:00+09:00",
      },
    });

    // Act
    render(<DataSourceFooter />);

    // Assert
    expect(screen.getByText(/금융감독원 DART/)).toBeInTheDocument();
    expect(screen.getByText(/SEC EDGAR/)).toBeInTheDocument();
    expect(screen.getByText(/토스증권/)).toBeInTheDocument();
  });

  it("수집 이력이 없으면 '수집 전'을 표시한다(E13)", () => {
    // Arrange
    mockState({
      sources: ["금융감독원 DART", "SEC EDGAR", "토스증권"],
      lastCollectedAt: { quotes: null, financials: null, fxAndMarketHours: null },
    });

    // Act
    render(<DataSourceFooter />);

    // Assert
    expect(screen.getAllByText(/수집 전/).length).toBeGreaterThan(0);
  });

  it("dataFreshness가 null이면 아무것도 렌더링하지 않는다", () => {
    // Arrange
    mockState(null);

    // Act
    const { container } = render(<DataSourceFooter />);

    // Assert
    expect(container.textContent).toBe("");
  });
});
