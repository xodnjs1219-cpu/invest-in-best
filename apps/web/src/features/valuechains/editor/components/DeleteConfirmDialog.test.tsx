// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmDialog } from "@/features/valuechains/editor/components/DeleteConfirmDialog";

describe("DeleteConfirmDialog", () => {
  it("연결 엣지 2개인 노드 삭제 시도 → 동반 삭제 문구 표시", () => {
    render(
      <DeleteConfirmDialog open nodeCount={1} connectedEdgeCount={2} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText(/노드 1개/)).toBeInTheDocument();
    expect(screen.getByText(/엣지 2개/)).toBeInTheDocument();
  });

  it("open=false면 렌더링하지 않는다", () => {
    render(
      <DeleteConfirmDialog open={false} nodeCount={1} connectedEdgeCount={2} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("취소 클릭 → onCancel 호출, onConfirm 미호출", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteConfirmDialog open nodeCount={1} connectedEdgeCount={2} onConfirm={onConfirm} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("확인 클릭 → onConfirm 호출", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteConfirmDialog open nodeCount={2} connectedEdgeCount={3} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "삭제" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
