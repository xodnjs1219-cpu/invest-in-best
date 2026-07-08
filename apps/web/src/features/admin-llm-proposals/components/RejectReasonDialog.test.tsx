// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RejectReasonDialog } from "@/features/admin-llm-proposals/components/RejectReasonDialog";
import type { RejectTarget } from "@/features/admin-llm-proposals/hooks/adminLlmQueueReducer";

const noop = () => {};

describe("RejectReasonDialog", () => {
  it("target이 null이면 아무것도 렌더하지 않는다", () => {
    const { container } = render(
      <RejectReasonDialog target={null} isSubmitting={false} onReasonChange={noop} onCancel={noop} onConfirm={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("target이 있으면 textarea와 취소/거부 버튼을 표시한다", () => {
    const target: RejectTarget = { proposalId: "p-1", reason: "" };
    render(
      <RejectReasonDialog target={target} isSubmitting={false} onReasonChange={noop} onCancel={noop} onConfirm={noop} />,
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "거부" })).toBeInTheDocument();
  });

  it("textarea 입력 시 onReasonChange를 호출한다", () => {
    const onReasonChange = vi.fn();
    const target: RejectTarget = { proposalId: "p-1", reason: "" };
    render(
      <RejectReasonDialog
        target={target}
        isSubmitting={false}
        onReasonChange={onReasonChange}
        onCancel={noop}
        onConfirm={noop}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "사유입니다" } });
    expect(onReasonChange).toHaveBeenCalledWith("사유입니다");
  });

  it("취소 클릭 시 onCancel을 호출한다", () => {
    const onCancel = vi.fn();
    const target: RejectTarget = { proposalId: "p-1", reason: "" };
    render(
      <RejectReasonDialog target={target} isSubmitting={false} onReasonChange={noop} onCancel={onCancel} onConfirm={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("거부 확정 클릭 시 onConfirm을 호출한다(사유 미입력도 허용)", () => {
    const onConfirm = vi.fn();
    const target: RejectTarget = { proposalId: "p-1", reason: "" };
    render(
      <RejectReasonDialog target={target} isSubmitting={false} onReasonChange={noop} onCancel={noop} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "거부" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("isSubmitting이면 버튼이 비활성화된다", () => {
    const target: RejectTarget = { proposalId: "p-1", reason: "" };
    render(
      <RejectReasonDialog target={target} isSubmitting={true} onReasonChange={noop} onCancel={noop} onConfirm={noop} />,
    );
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "거부" })).toBeDisabled();
  });

  it("글자수 카운터를 표시한다", () => {
    const target: RejectTarget = { proposalId: "p-1", reason: "abc" };
    render(
      <RejectReasonDialog target={target} isSubmitting={false} onReasonChange={noop} onCancel={noop} onConfirm={noop} />,
    );
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});
