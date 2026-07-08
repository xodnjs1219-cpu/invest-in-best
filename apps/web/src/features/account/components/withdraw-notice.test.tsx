// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WithdrawNotice } from "@/features/account/components/withdraw-notice";
import { ACCOUNT_MESSAGES, WITHDRAW_NOTICE_ITEMS } from "@/features/account/constants";

describe("WithdrawNotice", () => {
  it("삭제 범위·복구 불가 안내 항목을 모두 표시한다", () => {
    // Act
    render(<WithdrawNotice onCancel={vi.fn()} onProceed={vi.fn()} />);

    // Assert
    for (const item of WITHDRAW_NOTICE_ITEMS) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("취소 클릭 시 onCancel을 호출한다", async () => {
    // Arrange
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<WithdrawNotice onCancel={onCancel} onProceed={vi.fn()} />);

    // Act
    await user.click(screen.getByRole("button", { name: ACCOUNT_MESSAGES.cancelLabel }));

    // Assert
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("계속 클릭 시 onProceed를 호출한다", async () => {
    // Arrange
    const onProceed = vi.fn();
    const user = userEvent.setup();
    render(<WithdrawNotice onCancel={vi.fn()} onProceed={onProceed} />);

    // Act
    await user.click(screen.getByRole("button", { name: ACCOUNT_MESSAGES.continueLabel }));

    // Assert
    expect(onProceed).toHaveBeenCalledTimes(1);
  });
});
