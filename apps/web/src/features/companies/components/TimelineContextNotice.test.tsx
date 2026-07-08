// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimelineContextNotice } from "@/features/companies/components/TimelineContextNotice";

describe("TimelineContextNotice", () => {
  it("asOfDate가 있으면 해당 일자를 포함한 안내를 표시한다", () => {
    render(<TimelineContextNotice asOfDate="2026-05-02" isDismissed={false} onDismiss={vi.fn()} />);

    expect(screen.getByText(/2026-05-02/)).toBeInTheDocument();
  });

  it("asOfDate가 없으면 아무것도 렌더하지 않는다", () => {
    const { container } = render(
      <TimelineContextNotice asOfDate={null} isDismissed={false} onDismiss={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("isDismissed=true이면 아무것도 렌더하지 않는다", () => {
    const { container } = render(
      <TimelineContextNotice asOfDate="2026-05-02" isDismissed={true} onDismiss={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("닫기 버튼 클릭 시 onDismiss가 1회 호출된다", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<TimelineContextNotice asOfDate="2026-05-02" isDismissed={false} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
