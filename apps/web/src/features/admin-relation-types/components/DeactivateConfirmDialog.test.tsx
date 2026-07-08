// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeactivateConfirmDialog } from "./DeactivateConfirmDialog";

const noop = () => {};

describe("DeactivateConfirmDialog (M13)", () => {
  it("target이 null이면 아무것도 렌더하지 않는다", () => {
    const { container } = render(
      <DeactivateConfirmDialog target={null} isSubmitting={false} onConfirm={noop} onCancel={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("미사용 종류(isInUse=false)는 공통 안내만 표시한다", () => {
    render(
      <DeactivateConfirmDialog
        target={{ id: "rt-1", name: "규제", isInUse: false }}
        isSubmitting={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByText(/신규 선택 목록에서 제외/)).toBeInTheDocument();
    expect(screen.queryByText(/기존 관계와 과거 스냅샷은 그대로 유지/)).not.toBeInTheDocument();
  });

  it("사용 중 종류(isInUse=true)는 강조 안내를 추가로 표시한다(E3)", () => {
    render(
      <DeactivateConfirmDialog
        target={{ id: "rt-1", name: "공급", isInUse: true }}
        isSubmitting={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByText(/신규 선택 목록에서 제외/)).toBeInTheDocument();
    expect(screen.getByText(/기존 관계와 과거 스냅샷은 그대로 유지/)).toBeInTheDocument();
  });

  it("확정 클릭 시 onConfirm(id)이 1회 호출된다", () => {
    const onConfirm = vi.fn();
    render(
      <DeactivateConfirmDialog
        target={{ id: "rt-1", name: "공급", isInUse: false }}
        isSubmitting={false}
        onConfirm={onConfirm}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("rt-1");
  });

  it("취소 클릭 시 onCancel이 호출되고 onConfirm은 호출되지 않는다", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeactivateConfirmDialog
        target={{ id: "rt-1", name: "공급", isInUse: false }}
        isSubmitting={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("처리 중이면 확정/취소 버튼이 모두 비활성화된다", () => {
    render(
      <DeactivateConfirmDialog
        target={{ id: "rt-1", name: "공급", isInUse: false }}
        isSubmitting={true}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "비활성화" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
  });
});
