// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FreeSubjectFormTab } from "@/features/valuechains/editor/components/FreeSubjectFormTab";

describe("FreeSubjectFormTab", () => {
  it("유형 미선택 + 제출 → 유형 필드 인라인 오류, onAdd 미호출(E9)", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<FreeSubjectFormTab onAdd={onAdd} disabled={false} />);

    await user.type(screen.getByLabelText("이름"), "일반 소비자");
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("유형을 선택하세요")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("이름 공백만 입력 + 제출 → 이름 필드 인라인 오류(E9)", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<FreeSubjectFormTab onAdd={onAdd} disabled={false} />);

    await user.selectOptions(screen.getByLabelText("유형"), "consumer");
    await user.type(screen.getByLabelText("이름"), "   ");
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("이름을 입력하세요")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("유형=소비자, 이름 입력, 메모 없이 제출 → onAdd 호출 + subjectMemo=null, 폼 리셋", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<FreeSubjectFormTab onAdd={onAdd} disabled={false} />);

    await user.selectOptions(screen.getByLabelText("유형"), "consumer");
    await user.type(screen.getByLabelText("이름"), "일반 소비자");
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(onAdd).toHaveBeenCalledWith({ subjectType: "consumer", subjectName: "일반 소비자", subjectMemo: null });
    expect((screen.getByLabelText("이름") as HTMLInputElement).value).toBe("");
  });

  it("메모 포함 제출 → subjectMemo 보존", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<FreeSubjectFormTab onAdd={onAdd} disabled={false} />);

    await user.selectOptions(screen.getByLabelText("유형"), "government");
    await user.type(screen.getByLabelText("이름"), "정부");
    await user.type(screen.getByLabelText("설명 메모"), "규제 기관");
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(onAdd).toHaveBeenCalledWith({ subjectType: "government", subjectName: "정부", subjectMemo: "규제 기관" });
  });

  it("disabled=true면 제출 버튼이 비활성화된다(E1)", () => {
    render(<FreeSubjectFormTab onAdd={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();
  });
});
