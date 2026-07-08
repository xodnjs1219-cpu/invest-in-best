// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WithdrawConfirmDialog } from "@/features/account/components/withdraw-confirm-dialog";
import { ACCOUNT_MESSAGES, WITHDRAW_CONFIRM_PHRASE } from "@/features/account/constants";

describe("WithdrawConfirmDialog", () => {
  it("오픈 직후 확인 버튼이 비활성 상태다", () => {
    // Act
    render(
      <WithdrawConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} isPending={false} />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: ACCOUNT_MESSAGES.confirmSubmitLabel }),
    ).toBeDisabled();
  });

  it("불일치 문구 입력 시 확인 버튼이 비활성 유지된다", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<WithdrawConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} isPending={false} />);

    // Act
    await user.type(screen.getByRole("textbox"), "잘못된 문구");

    // Assert
    expect(
      screen.getByRole("button", { name: ACCOUNT_MESSAGES.confirmSubmitLabel }),
    ).toBeDisabled();
  });

  it("정확한 확인 문구 입력 시 확인 버튼이 활성화되고 클릭 시 onConfirm이 호출된다", async () => {
    // Arrange
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<WithdrawConfirmDialog onConfirm={onConfirm} onClose={vi.fn()} isPending={false} />);

    // Act
    await user.type(screen.getByRole("textbox"), WITHDRAW_CONFIRM_PHRASE);
    const confirmButton = screen.getByRole("button", {
      name: ACCOUNT_MESSAGES.confirmSubmitLabel,
    });
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    // Assert
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("isPending=true면 버튼이 비활성화된다", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<WithdrawConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} isPending={true} />);

    // Act
    await user.type(screen.getByRole("textbox"), WITHDRAW_CONFIRM_PHRASE);

    // Assert
    expect(
      screen.getByRole("button", { name: ACCOUNT_MESSAGES.confirmSubmittingLabel }),
    ).toBeDisabled();
  });

  it("닫기 클릭 시 onClose를 호출한다", async () => {
    // Arrange
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WithdrawConfirmDialog onConfirm={vi.fn()} onClose={onClose} isPending={false} />);

    // Act
    await user.click(screen.getByRole("button", { name: ACCOUNT_MESSAGES.closeLabel }));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("errorMessage 전달 시 오류 문구를 표시한다", () => {
    // Act
    render(
      <WithdrawConfirmDialog
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        isPending={false}
        errorMessage={ACCOUNT_MESSAGES.soleAdminBlocked}
      />,
    );

    // Assert
    expect(screen.getByText(ACCOUNT_MESSAGES.soleAdminBlocked)).toBeInTheDocument();
  });
});
