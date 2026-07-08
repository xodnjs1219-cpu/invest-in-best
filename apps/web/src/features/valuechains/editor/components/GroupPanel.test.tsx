// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GroupPanel } from "@/features/valuechains/editor/components/GroupPanel";

const buildProps = (overrides: Partial<Parameters<typeof GroupPanel>[0]> = {}) => ({
  groups: [{ clientGroupId: "g1", name: "소재" }],
  groupMembership: new Map<string, string[]>([["g1", ["n1", "n2"]]]),
  emptyGroupIds: [] as string[],
  duplicateGroupNames: [] as string[],
  selectedNodeIds: ["n1", "n2"],
  onCreateGroup: vi.fn().mockReturnValue({ ok: true }),
  onRenameGroup: vi.fn().mockReturnValue({ ok: true }),
  onDissolveGroup: vi.fn(),
  onAssignNodeToGroup: vi.fn(),
  ...overrides,
});

describe("GroupPanel", () => {
  it("노드 2개 선택 + 이름 입력 + 생성 클릭 → onCreateGroup 호출", async () => {
    const user = userEvent.setup();
    const onCreateGroup = vi.fn().mockReturnValue({ ok: true });
    render(<GroupPanel {...buildProps({ onCreateGroup })} />);

    await user.type(screen.getByLabelText("그룹 이름"), "새 그룹");
    await user.click(screen.getByRole("button", { name: "그룹 만들기" }));

    expect(onCreateGroup).toHaveBeenCalledWith({ name: "새 그룹", memberNodeIds: ["n1", "n2"] });
  });

  it("이름 공백으로 생성 시도 → 인라인 오류 표시, onCreateGroup 미호출", async () => {
    const user = userEvent.setup();
    const onCreateGroup = vi.fn().mockReturnValue({ ok: false, reason: "NAME_REQUIRED" });
    render(<GroupPanel {...buildProps({ onCreateGroup })} />);

    await user.click(screen.getByRole("button", { name: "그룹 만들기" }));

    expect(screen.getByText("이름을 입력하세요")).toBeInTheDocument();
  });

  it("노드 0개 선택 상태에서 생성 시도 → 안내 문구 표시", async () => {
    const user = userEvent.setup();
    const onCreateGroup = vi.fn().mockReturnValue({ ok: false, reason: "NO_NODES_SELECTED" });
    render(<GroupPanel {...buildProps({ selectedNodeIds: [], onCreateGroup })} />);

    await user.type(screen.getByLabelText("그룹 이름"), "새 그룹");
    await user.click(screen.getByRole("button", { name: "그룹 만들기" }));

    expect(screen.getByText("노드를 먼저 선택하세요")).toBeInTheDocument();
  });

  it("그룹 목록에 이름·멤버 수 표시", () => {
    render(<GroupPanel {...buildProps()} />);
    expect(screen.getAllByText("소재").length).toBeGreaterThan(0);
    expect(screen.getByText(/멤버 2개/)).toBeInTheDocument();
  });

  it("빈 그룹 뱃지 '저장 시 제외' 표시", () => {
    render(<GroupPanel {...buildProps({ emptyGroupIds: ["g1"] })} />);
    expect(screen.getByText("저장 시 제외")).toBeInTheDocument();
  });

  it("중복 이름 뱃지 표시", () => {
    render(<GroupPanel {...buildProps({ duplicateGroupNames: ["소재"] })} />);
    expect(screen.getByText("이름 중복")).toBeInTheDocument();
  });

  it("그룹 해제 버튼 클릭 → onDissolveGroup 호출", async () => {
    const user = userEvent.setup();
    const onDissolveGroup = vi.fn();
    render(<GroupPanel {...buildProps({ onDissolveGroup })} />);

    await user.click(screen.getByRole("button", { name: "그룹 해제" }));
    expect(onDissolveGroup).toHaveBeenCalledWith("g1");
  });

  it("그룹 이름 변경(공백) → 인라인 오류 표시", async () => {
    const user = userEvent.setup();
    const onRenameGroup = vi.fn().mockReturnValue({ ok: false, reason: "NAME_REQUIRED" });
    render(<GroupPanel {...buildProps({ onRenameGroup })} />);

    await user.click(screen.getByRole("button", { name: "이름 변경" }));
    const input = screen.getByDisplayValue("소재");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(screen.getByText("이름을 입력하세요")).toBeInTheDocument();
  });

  it("선택 노드 그룹 지정 드롭다운 → assignNodeToGroup 호출", async () => {
    const user = userEvent.setup();
    const onAssignNodeToGroup = vi.fn();
    render(<GroupPanel {...buildProps({ onAssignNodeToGroup, selectedNodeIds: ["n3"] })} />);

    await user.selectOptions(screen.getByLabelText("선택 노드 그룹 지정"), "g1");
    await user.click(screen.getByRole("button", { name: "적용" }));

    expect(onAssignNodeToGroup).toHaveBeenCalledWith("n3", "g1");
  });
});
