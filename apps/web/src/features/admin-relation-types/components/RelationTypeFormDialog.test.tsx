// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelationTypeFormDialog } from "./RelationTypeFormDialog";

const noop = () => {};

describe("RelationTypeFormDialog (M12)", () => {
  it("create 모드에서 이름 빈 값, 방향성 기본 '유향' 선택으로 렌더된다", () => {
    render(
      <RelationTypeFormDialog mode="create" isSubmitting={false} onSubmit={noop} onCancel={noop} />,
    );
    expect(screen.getByLabelText("이름")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "유향" })).toBeChecked();
  });

  it("이름 미입력 제출 시 필드 오류를 표시하고 onSubmit을 호출하지 않는다(E7)", async () => {
    const onSubmit = vi.fn();
    render(
      <RelationTypeFormDialog mode="create" isSubmitting={false} onSubmit={onSubmit} onCancel={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("무향 선택 후 추가하면 {name, isDirected:false}로 onSubmit이 호출된다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <RelationTypeFormDialog mode="create" isSubmitting={false} onSubmit={onSubmit} onCancel={noop} />,
    );
    await user.type(screen.getByLabelText("이름"), "경쟁");
    await user.click(screen.getByRole("radio", { name: "무향" }));
    await user.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // handleSubmit이 (values, event) 두 인자로 호출하므로 첫 인자만 검증한다.
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: "경쟁", isDirected: false }),
    );
  });

  it("rename 모드는 현재 이름을 초깃값으로 갖고 방향성 필드가 없다(BR-4)", () => {
    render(
      <RelationTypeFormDialog
        mode="rename"
        target={{ id: "rt-1", name: "공급" }}
        isSubmitting={false}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByLabelText("이름")).toHaveValue("공급");
    expect(screen.queryByText("방향성")).not.toBeInTheDocument();
  });

  it("서버 오류 메시지가 있으면 이름 필드 아래에 표시된다(E2)", () => {
    render(
      <RelationTypeFormDialog
        mode="create"
        isSubmitting={false}
        serverErrorMessage="이미 존재하는 이름입니다."
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByText("이미 존재하는 이름입니다.")).toBeInTheDocument();
  });

  it("제출 중이면 확정 버튼이 비활성화된다", () => {
    render(
      <RelationTypeFormDialog mode="create" isSubmitting={true} onSubmit={noop} onCancel={noop} />,
    );
    expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();
  });

  it("취소 클릭 시 onCancel이 호출되고 onSubmit은 호출되지 않는다", () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    render(
      <RelationTypeFormDialog mode="create" isSubmitting={false} onSubmit={onSubmit} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
