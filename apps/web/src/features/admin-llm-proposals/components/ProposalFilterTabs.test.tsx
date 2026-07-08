// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalFilterTabs } from "@/features/admin-llm-proposals/components/ProposalFilterTabs";

describe("ProposalFilterTabs", () => {
  it("탭 클릭 시 onChange를 1회 호출한다", () => {
    // Arrange
    const onChange = vi.fn();
    render(<ProposalFilterTabs value="pending" onChange={onChange} />);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "승인됨" }));

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("approved");
  });

  it("현재 활성 탭에 aria-pressed=true를 표시한다", () => {
    // Arrange
    render(<ProposalFilterTabs value="rejected" onChange={vi.fn()} />);

    // Act
    const activeTab = screen.getByRole("button", { name: "거부됨" });

    // Assert
    expect(activeTab).toHaveAttribute("aria-pressed", "true");
  });
});
