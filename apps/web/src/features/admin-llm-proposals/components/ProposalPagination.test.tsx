// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalPagination } from "@/features/admin-llm-proposals/components/ProposalPagination";

describe("ProposalPagination", () => {
  it("1페이지 + hasMore=true면 이전 버튼은 비활성, 다음 버튼은 활성이다", () => {
    render(<ProposalPagination page={1} hasMore={true} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음" })).not.toBeDisabled();
  });

  it("다음 클릭 시 onPageChange(page+1)을 호출한다", () => {
    const onPageChange = vi.fn();
    render(<ProposalPagination page={1} hasMore={true} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("이전 클릭 시 onPageChange(page-1)을 호출한다", () => {
    const onPageChange = vi.fn();
    render(<ProposalPagination page={3} hasMore={false} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("hasMore=false면 다음 버튼이 비활성이다", () => {
    render(<ProposalPagination page={2} hasMore={false} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });

  it("현재 페이지를 표시한다", () => {
    render(<ProposalPagination page={4} hasMore={true} onPageChange={vi.fn()} />);
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });
});
