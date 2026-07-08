// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UnsavedLeaveDialog } from "@/features/valuechains/editor/components/UnsavedLeaveDialog";

describe("UnsavedLeaveDialog", () => {
  it("open=false면 렌더링하지 않는다", () => {
    render(<UnsavedLeaveDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("open=true면 경고 문구와 [나가기]/[계속 편집] 버튼을 표시한다", () => {
    render(<UnsavedLeaveDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "나가기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계속 편집" })).toBeInTheDocument();
  });

  it("[나가기] 클릭 → onConfirm 호출", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<UnsavedLeaveDialog open={true} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "나가기" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("[계속 편집] 클릭 → onCancel 호출", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<UnsavedLeaveDialog open={true} onConfirm={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "계속 편집" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
