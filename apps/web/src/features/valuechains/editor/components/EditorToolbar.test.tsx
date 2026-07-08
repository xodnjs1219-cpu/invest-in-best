// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "@/features/valuechains/editor/components/EditorToolbar";

const stateMock = vi.hoisted(() => ({ current: null as unknown }));
const saveMock = vi.hoisted(() => vi.fn().mockResolvedValue({ status: "saved" }));

vi.mock("@/features/valuechains/editor/context/ChainEditorContext", () => ({
  useChainEditorState: () => stateMock.current,
  useChainEditorActions: () => ({ save: saveMock }),
}));

beforeEach(() => {
  saveMock.mockClear();
});

function setState(overrides: {
  name?: string;
  isDirty?: boolean;
  nodeCount?: number;
  canSave?: boolean;
  isSaving?: boolean;
  variant?: "user" | "official";
}) {
  stateMock.current = {
    meta: { mode: "create", variant: overrides.variant ?? "user" },
    state: { name: overrides.name ?? "", isDirty: overrides.isDirty ?? false },
    computed: { nodeCount: overrides.nodeCount ?? 0, canSave: overrides.canSave ?? true },
    async: { isSaving: overrides.isSaving ?? false },
  };
}

describe("EditorToolbar", () => {
  it("진입 직후 → '제목 없음' 플레이스홀더 + 0/100 배지, 더티 표시 없음", () => {
    setState({ canSave: false });
    render(<EditorToolbar />);
    expect(screen.getByText("제목 없음")).toBeInTheDocument();
    expect(screen.getByText("0/100")).toBeInTheDocument();
    expect(screen.queryByTestId("dirty-indicator")).not.toBeInTheDocument();
  });

  it("이름이 있으면 이름을 표시하고, 더티면 더티 표시(●)가 나타난다", () => {
    setState({ name: "AI 반도체", isDirty: true, nodeCount: 3 });
    render(<EditorToolbar />);
    expect(screen.getByText("AI 반도체")).toBeInTheDocument();
    expect(screen.getByText("3/100")).toBeInTheDocument();
    expect(screen.getByTestId("dirty-indicator")).toBeInTheDocument();
  });

  it("이름 미입력 상태(canSave=false) → 저장 버튼 비활성화", () => {
    setState({ canSave: false });
    render(<EditorToolbar />);
    const saveButton = screen.getByRole("button", { name: /저장/ });
    expect(saveButton).toBeDisabled();
  });

  it("canSave=true → 저장 버튼 활성화, 클릭 시 save() 호출", async () => {
    setState({ name: "체인", canSave: true });
    const user = userEvent.setup();
    render(<EditorToolbar />);
    const saveButton = screen.getByRole("button", { name: /저장/ });
    expect(saveButton).not.toBeDisabled();

    await user.click(saveButton);
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
  });

  it("isSaving=true → 저장 버튼 비활성화(중복 클릭 방지)", () => {
    setState({ name: "체인", canSave: true, isSaving: true });
    render(<EditorToolbar />);
    const saveButton = screen.getByRole("button", { name: /저장/ });
    expect(saveButton).toBeDisabled();
  });

  it("variant='official' → 저장 클릭 시 즉시 save() 호출하지 않고 다이얼로그를 연다", async () => {
    setState({ name: "공식 체인", canSave: true, variant: "official" });
    const user = userEvent.setup();
    render(<EditorToolbar />);
    await user.click(screen.getByRole("button", { name: /저장/ }));
    expect(saveMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("variant='official' 다이얼로그에서 저장 확정 → save({ disclosureDate }) 호출", async () => {
    setState({ name: "공식 체인", canSave: true, variant: "official" });
    const user = userEvent.setup();
    render(<EditorToolbar />);
    await user.click(screen.getByRole("button", { name: /저장/ }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith({ disclosureDate: null }));
  });

  it("variant='user' → 다이얼로그 미노출(기존 저장 흐름 그대로 — 회귀 없음)", async () => {
    setState({ name: "체인", canSave: true, variant: "user" });
    const user = userEvent.setup();
    render(<EditorToolbar />);
    await user.click(screen.getByRole("button", { name: /저장/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
  });
});
