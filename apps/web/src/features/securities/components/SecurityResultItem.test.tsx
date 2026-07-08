// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SecurityResultItem } from "@/features/securities/components/SecurityResultItem";
import type { SecuritySearchItem } from "@/features/securities/lib/dto";

const buildItem = (overrides?: Partial<SecuritySearchItem>): SecuritySearchItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  ticker: "005930",
  name: "삼성전자",
  englishName: "Samsung Electronics",
  market: "KRX",
  listingStatus: "listed",
  ...overrides,
});

describe("SecurityResultItem", () => {
  it("일반 상장 종목은 종목명·티커·시장 배지를 표시하고 상태 배지는 없다", () => {
    // Arrange
    const item = buildItem();

    // Act
    render(<SecurityResultItem item={item} onSelect={vi.fn()} />);

    // Assert
    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(screen.getByText("005930")).toBeInTheDocument();
    expect(screen.getByText("KRX")).toBeInTheDocument();
    expect(screen.queryByText("상장폐지")).not.toBeInTheDocument();
    expect(screen.queryByText("거래정지")).not.toBeInTheDocument();
  });

  it("englishName이 null이면 영문명 영역을 표시하지 않는다", () => {
    // Arrange
    const item = buildItem({ englishName: null });

    // Act
    render(<SecurityResultItem item={item} onSelect={vi.fn()} />);

    // Assert
    expect(screen.queryByText("Samsung Electronics")).not.toBeInTheDocument();
  });

  it("폐지 종목은 '상장폐지' 배지를 함께 표시한다", () => {
    // Arrange
    const item = buildItem({ listingStatus: "delisted" });

    // Act
    render(<SecurityResultItem item={item} onSelect={vi.fn()} />);

    // Assert
    expect(screen.getByText("상장폐지")).toBeInTheDocument();
  });

  it("클릭 시 onSelect(ticker)가 1회 호출된다", async () => {
    // Arrange
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const item = buildItem();
    render(<SecurityResultItem item={item} onSelect={onSelect} />);

    // Act
    await user.click(screen.getByRole("button", { name: /삼성전자/ }));

    // Assert
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("005930");
  });

  it("Enter 키 입력 시 onSelect(ticker)가 호출된다", async () => {
    // Arrange
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const item = buildItem();
    render(<SecurityResultItem item={item} onSelect={onSelect} />);

    // Act
    const button = screen.getByRole("button", { name: /삼성전자/ });
    button.focus();
    await user.keyboard("{Enter}");

    // Assert
    expect(onSelect).toHaveBeenCalledWith("005930");
  });
});
