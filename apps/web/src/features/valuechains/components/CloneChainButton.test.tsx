// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const useCloneChainActionMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/valuechains/hooks/useCloneChainAction", () => ({
  useCloneChainAction: useCloneChainActionMock,
}));

import { CloneChainButton } from "@/features/valuechains/components/CloneChainButton";

describe("CloneChainButton", () => {
  it("기본 상태에서 복제 버튼을 렌더링하고 클릭 시 requestClone을 호출한다", async () => {
    const requestClone = vi.fn();
    useCloneChainActionMock.mockReturnValue({
      requestClone,
      isCloning: false,
      errorMessage: null,
      successMessage: null,
    });

    render(<CloneChainButton chainId="chain-1" />);
    await userEvent.click(screen.getByRole("button", { name: "복제" }));

    expect(requestClone).toHaveBeenCalledTimes(1);
  });

  it("isCloning=true면 버튼이 비활성화되고 진행 중 라벨을 표시한다", () => {
    useCloneChainActionMock.mockReturnValue({
      requestClone: vi.fn(),
      isCloning: true,
      errorMessage: null,
      successMessage: null,
    });

    render(<CloneChainButton chainId="chain-1" />);

    const button = screen.getByRole("button", { name: "복제 중..." });
    expect(button).toBeDisabled();
  });

  it("errorMessage가 있으면 에러 문구를 표시한다", () => {
    useCloneChainActionMock.mockReturnValue({
      requestClone: vi.fn(),
      isCloning: false,
      errorMessage: "상한 도달",
      successMessage: null,
    });

    render(<CloneChainButton chainId="chain-1" />);

    expect(screen.getByText("상한 도달")).toBeInTheDocument();
  });

  it("card variant 클릭 시 이벤트 버블링을 차단한다", async () => {
    const requestClone = vi.fn();
    useCloneChainActionMock.mockReturnValue({
      requestClone,
      isCloning: false,
      errorMessage: null,
      successMessage: null,
    });
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <CloneChainButton chainId="chain-1" variant="card" />
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: "복제" }));

    expect(requestClone).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
