// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SaveConflictDialog } from "@/features/valuechains/editor/components/SaveConflictDialog";

describe("SaveConflictDialog", () => {
  it("open=false → 렌더 없음", () => {
    render(<SaveConflictDialog open={false} onReload={vi.fn()} onKeepEditing={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true → 다이얼로그 표시 + 안내 문구", () => {
    render(<SaveConflictDialog open={true} onReload={vi.fn()} onKeepEditing={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/현재 편집 내용은 사라집니다/)).toBeInTheDocument();
  });

  it("[최신 상태 불러오기] 클릭 → onReload 호출", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(<SaveConflictDialog open={true} onReload={onReload} onKeepEditing={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "최신 상태 불러오기" }));
    expect(onReload).toHaveBeenCalled();
  });

  it("[계속 편집] 클릭 → onKeepEditing 호출", async () => {
    const user = userEvent.setup();
    const onKeepEditing = vi.fn();
    render(<SaveConflictDialog open={true} onReload={vi.fn()} onKeepEditing={onKeepEditing} />);
    await user.click(screen.getByRole("button", { name: "계속 편집" }));
    expect(onKeepEditing).toHaveBeenCalled();
  });
});
