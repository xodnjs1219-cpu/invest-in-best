// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const useDeleteChainActionMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/valuechains/hooks/useDeleteChainAction", () => ({
  useDeleteChainAction: useDeleteChainActionMock,
}));

import { DeleteChainButton } from "@/features/valuechains/components/DeleteChainButton";

const buildActionReturn = (overrides?: Partial<Record<string, unknown>>) => ({
  isDialogOpen: false,
  requestDelete: vi.fn(),
  confirmDelete: vi.fn(),
  cancelDelete: vi.fn(),
  isDeleting: false,
  errorMessage: null,
  successMessage: null,
  ...overrides,
});

describe("DeleteChainButton", () => {
  it("삭제 버튼 클릭 시 requestDelete를 호출한다", async () => {
    const requestDelete = vi.fn();
    useDeleteChainActionMock.mockReturnValue(buildActionReturn({ requestDelete }));

    render(<DeleteChainButton chainId="chain-1" chainName="내 체인" source="list" />);
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(requestDelete).toHaveBeenCalledTimes(1);
  });

  it("isDialogOpen=true면 확인 다이얼로그가 함께 렌더된다", () => {
    useDeleteChainActionMock.mockReturnValue(buildActionReturn({ isDialogOpen: true }));

    render(<DeleteChainButton chainId="chain-1" chainName="내 체인" source="list" />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("card variant 클릭 시 부모로의 이벤트 버블링을 차단한다", async () => {
    const requestDelete = vi.fn();
    useDeleteChainActionMock.mockReturnValue(buildActionReturn({ requestDelete }));
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <DeleteChainButton chainId="chain-1" chainName="내 체인" source="list" variant="card" />
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(requestDelete).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("isDeleting=true면 트리거 버튼이 비활성화되고 진행 중 라벨을 표시한다", () => {
    useDeleteChainActionMock.mockReturnValue(buildActionReturn({ isDeleting: true, isDialogOpen: true }));

    render(<DeleteChainButton chainId="chain-1" chainName="내 체인" source="list" />);

    const buttons = screen.getAllByRole("button", { name: "삭제 중..." });
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });
});
