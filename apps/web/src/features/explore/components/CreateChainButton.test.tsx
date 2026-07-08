// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { CreateChainButton } = await import("@/features/explore/components/CreateChainButton");

describe("CreateChainButton", () => {
  it("로그인 상태에서 클릭하면 /valuechains/new로 이동한다", async () => {
    const user = userEvent.setup();
    render(<CreateChainButton isAuthenticated />);

    await user.click(screen.getByRole("button", { name: /새 밸류체인 만들기/ }));

    expect(pushMock).toHaveBeenCalledWith("/valuechains/new");
  });

  it("비로그인 상태에서 클릭하면 로그인 페이지로 returnTo와 함께 이동한다", async () => {
    const user = userEvent.setup();
    render(<CreateChainButton isAuthenticated={false} />);

    await user.click(screen.getByRole("button", { name: /새 밸류체인 만들기/ }));

    expect(pushMock).toHaveBeenCalledWith(
      `/auth/login?returnTo=${encodeURIComponent("/valuechains/new")}`,
    );
  });
});
