// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WithdrawFlow } from "@/features/account/components/withdraw-flow";
import { ACCOUNT_MESSAGES, WITHDRAW_CONFIRM_PHRASE } from "@/features/account/constants";

const withdrawMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("@/features/account/hooks/useWithdrawAccount", () => ({
  useWithdrawAccount: () => ({
    withdraw: withdrawMock,
    isPending: false,
    isError: false,
    errorCode: undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const renderFlow = () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <WithdrawFlow />
    </QueryClientProvider>,
  );
};

describe("WithdrawFlow", () => {
  it("초기 단계는 안내(WithdrawNotice)를 표시한다", () => {
    // Act
    renderFlow();

    // Assert
    expect(screen.getByText(ACCOUNT_MESSAGES.noticeTitle)).toBeInTheDocument();
  });

  it("계속 클릭 시 확인 다이얼로그로 전환된다", async () => {
    // Arrange
    const user = renderFlowAndGetUser();

    // Act
    await user.click(screen.getByRole("button", { name: ACCOUNT_MESSAGES.continueLabel }));

    // Assert
    expect(screen.getByText(ACCOUNT_MESSAGES.confirmDialogTitle)).toBeInTheDocument();
  });

  it("확인 문구 입력 후 확정 클릭 시 withdraw를 호출한다", async () => {
    // Arrange
    const user = renderFlowAndGetUser();
    await user.click(screen.getByRole("button", { name: ACCOUNT_MESSAGES.continueLabel }));

    // Act
    await user.type(screen.getByRole("textbox"), WITHDRAW_CONFIRM_PHRASE);
    await user.click(screen.getByRole("button", { name: ACCOUNT_MESSAGES.confirmSubmitLabel }));

    // Assert
    expect(withdrawMock).toHaveBeenCalledTimes(1);
  });
});

function renderFlowAndGetUser() {
  renderFlow();
  return userEvent.setup();
}
