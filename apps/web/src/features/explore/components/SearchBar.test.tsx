// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchBar } from "@/features/explore/components/SearchBar";

const baseProps = {
  value: "",
  marketFilter: "ALL" as const,
  showTooShortNotice: false,
  onInputChange: vi.fn(),
  onFilterChange: vi.fn(),
  onClear: vi.fn(),
};

describe("SearchBar", () => {
  it("검색창 타이핑 시 onInputChange가 매 입력마다 호출된다", async () => {
    // Arrange
    const user = userEvent.setup();
    const onInputChange = vi.fn();
    render(<SearchBar {...baseProps} onInputChange={onInputChange} />);

    // Act
    await user.type(screen.getByRole("searchbox"), "삼성");

    // Assert
    expect(onInputChange).toHaveBeenCalledTimes(2);
  });

  it("showTooShortNotice=true면 '검색 미실행' 안내를 표시한다", () => {
    // Act
    render(<SearchBar {...baseProps} showTooShortNotice />);

    // Assert
    expect(screen.getByText(/검색이 실행되지 않았습니다|검색어를 입력/)).toBeInTheDocument();
  });

  it("showTooShortNotice=false면 안내를 표시하지 않는다", () => {
    // Act
    render(<SearchBar {...baseProps} showTooShortNotice={false} />);

    // Assert
    expect(screen.queryByText(/검색이 실행되지 않았습니다|검색어를 입력/)).not.toBeInTheDocument();
  });

  it("시장 필터 탭 클릭 시 onFilterChange가 호출된다", async () => {
    // Arrange
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(<SearchBar {...baseProps} onFilterChange={onFilterChange} />);

    // Act
    await user.click(screen.getByRole("tab", { name: "KRX" }));

    // Assert
    expect(onFilterChange).toHaveBeenCalledWith("KRX");
  });

  it("입력값이 있으면 지우기(X) 버튼이 노출된다", () => {
    // Act
    render(<SearchBar {...baseProps} value="삼성" />);

    // Assert
    expect(screen.getByRole("button", { name: /지우기/ })).toBeInTheDocument();
  });

  it("입력값이 없으면 지우기 버튼이 노출되지 않는다", () => {
    // Act
    render(<SearchBar {...baseProps} value="" />);

    // Assert
    expect(screen.queryByRole("button", { name: /지우기/ })).not.toBeInTheDocument();
  });

  it("X 클릭 시 onClear가 호출된다", async () => {
    // Arrange
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<SearchBar {...baseProps} value="삼성" onClear={onClear} />);

    // Act
    await user.click(screen.getByRole("button", { name: /지우기/ }));

    // Assert
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("활성 필터 탭에 aria-selected=true가 설정된다", () => {
    // Act
    render(<SearchBar {...baseProps} marketFilter="US" />);

    // Assert
    expect(screen.getByRole("tab", { name: "US" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "전체" })).toHaveAttribute("aria-selected", "false");
  });
});
