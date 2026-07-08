// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OfficialSaveDialog } from "@/features/valuechains/editor/components/OfficialSaveDialog";

describe("OfficialSaveDialog", () => {
  it("open=false → 렌더 없음", () => {
    render(<OfficialSaveDialog open={false} isSaving={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true → 다이얼로그 + 안내 문구 + 공시일 입력 표시", () => {
    render(<OfficialSaveDialog open={true} isSaving={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/저장 1회 = 스냅샷 1건/)).toBeInTheDocument();
    expect(screen.getByLabelText("근거 공시일")).toBeInTheDocument();
  });

  it("공시일 미입력 확정 → onConfirm(null) 호출", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<OfficialSaveDialog open={true} isSaving={false} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("공시일 입력 후 확정 → onConfirm(date) 호출", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<OfficialSaveDialog open={true} isSaving={false} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const input = screen.getByLabelText("근거 공시일");
    await user.type(input, "2026-07-01");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(onConfirm).toHaveBeenCalledWith("2026-07-01");
  });

  it("[취소] 클릭 → onCancel 호출", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<OfficialSaveDialog open={true} isSaving={false} onConfirm={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("isSaving=true → 저장 버튼 비활성화", () => {
    render(<OfficialSaveDialog open={true} isSaving={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });
});
