// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelationTypePicker } from "@/features/valuechains/editor/components/RelationTypePicker";

const relationTypes = [
  { id: "rt-supply", name: "공급", isDirected: true, isActive: true },
  { id: "rt-compete", name: "경쟁", isDirected: false, isActive: true },
];

describe("RelationTypePicker", () => {
  it("활성 관계 종류만 나열, 방향성 뱃지 표시", () => {
    render(<RelationTypePicker relationTypes={relationTypes} onSelect={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText("공급")).toBeInTheDocument();
    expect(screen.getByText("경쟁")).toBeInTheDocument();
    expect(screen.getAllByText("유향").length).toBeGreaterThan(0);
    expect(screen.getAllByText("무향").length).toBeGreaterThan(0);
  });

  it("종류 클릭 → onSelect(relationTypeId) 호출", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<RelationTypePicker relationTypes={relationTypes} onSelect={onSelect} onCancel={vi.fn()} />);

    await user.click(screen.getByText("공급"));
    expect(onSelect).toHaveBeenCalledWith("rt-supply");
  });

  it("취소 버튼 클릭 → onCancel 호출", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<RelationTypePicker relationTypes={relationTypes} onSelect={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("변경 모드(currentRelationTypeId 지정) → 현재 종류 강조 표시", () => {
    render(
      <RelationTypePicker
        relationTypes={relationTypes}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        currentRelationTypeId="rt-compete"
      />,
    );

    const current = screen.getByRole("button", { name: /경쟁/ });
    expect(current).toHaveAttribute("aria-pressed", "true");
  });

  it("활성 관계 종류가 0개면 안내 문구를 표시한다(E6)", () => {
    render(<RelationTypePicker relationTypes={[]} onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/활성화된 관계 종류가 없습니다/)).toBeInTheDocument();
  });
});
