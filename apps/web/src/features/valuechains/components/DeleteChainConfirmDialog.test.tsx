// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteChainConfirmDialog } from "@/features/valuechains/components/DeleteChainConfirmDialog";

describe("DeleteChainConfirmDialog", () => {
  it("open=false면 아무것도 렌더하지 않는다", () => {
    render(
      <DeleteChainConfirmDialog
        open={false}
        chainName="내 체인"
        isDeleting={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText(/삭제/)).not.toBeInTheDocument();
  });

  it("open=true면 체인 이름과 되돌릴 수 없음 안내 문구를 표시한다", () => {
    render(
      <DeleteChainConfirmDialog
        open
        chainName="내 체인"
        isDeleting={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/내 체인/)).toBeInTheDocument();
    expect(screen.getByText(/되돌릴 수 없/)).toBeInTheDocument();
    expect(screen.getByText(/스냅샷 이력/)).toBeInTheDocument();
  });

  it("[삭제] 클릭 시 onConfirm이 호출된다", async () => {
    const onConfirm = vi.fn();
    render(
      <DeleteChainConfirmDialog
        open
        chainName="내 체인"
        isDeleting={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("[취소] 클릭 시 onCancel이 호출된다(E7)", async () => {
    const onCancel = vi.fn();
    render(
      <DeleteChainConfirmDialog
        open
        chainName="내 체인"
        isDeleting={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("isDeleting=true면 삭제 버튼이 비활성화되고 취소 버튼도 비활성화된다(진행 중 이탈 방지)", () => {
    render(
      <DeleteChainConfirmDialog
        open
        chainName="내 체인"
        isDeleting
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /삭제 중/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
  });
});
