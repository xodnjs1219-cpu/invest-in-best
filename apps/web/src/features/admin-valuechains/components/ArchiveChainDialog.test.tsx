// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArchiveChainDialog } from "@/features/admin-valuechains/components/ArchiveChainDialog";

describe("ArchiveChainDialog", () => {
  it("target=null → 렌더 없음", () => {
    render(<ArchiveChainDialog target={null} isArchiving={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("target 존재 → 다이얼로그 표시 + 이름 포함", () => {
    render(
      <ArchiveChainDialog
        target={{ chainId: "c1", name: "반도체 밸류체인" }}
        isArchiving={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/반도체 밸류체인/)).toBeInTheDocument();
    expect(screen.getByText(/공개 목록에서 제외/)).toBeInTheDocument();
  });

  it("[보관] 클릭 → onConfirm 호출", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ArchiveChainDialog
        target={{ chainId: "c1", name: "체인" }}
        isArchiving={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "보관" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("[취소] 클릭 → onCancel 호출", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ArchiveChainDialog
        target={{ chainId: "c1", name: "체인" }}
        isArchiving={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("isArchiving=true → 보관 버튼 비활성화, 취소 클릭 무시(dismiss 차단)", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ArchiveChainDialog
        target={{ chainId: "c1", name: "체인" }}
        isArchiving={true}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("button", { name: "보관" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
