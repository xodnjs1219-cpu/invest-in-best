// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChainMetaPanel } from "@/features/valuechains/editor/components/ChainMetaPanel";

const stateMock = vi.hoisted(() => ({ current: null as unknown }));
const actionsMock = vi.hoisted(() => ({
  changeName: vi.fn(),
  changeFocusType: vi.fn(),
  setFocusSecurity: vi.fn(),
  clearFocusSecurity: vi.fn(),
}));

vi.mock("@/features/valuechains/editor/context/ChainEditorContext", () => ({
  useChainEditorState: () => stateMock.current,
  useChainEditorActions: () => actionsMock,
}));

vi.mock("@/features/valuechains/editor/components/FocusSecuritySearch", () => ({
  FocusSecuritySearch: ({ onSelect }: { onSelect: (s: unknown) => void }) => (
    <button type="button" onClick={() => onSelect({ securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" })}>
      mock-select-security
    </button>
  ),
}));

function setState(overrides: {
  name?: string;
  focusType?: "industry" | "company";
  focusSecurity?: { securityId: string; ticker: string; name: string; market: "KRX" | "US" } | null;
  nameIssue?: "NAME_REQUIRED" | null;
}) {
  stateMock.current = {
    state: {
      name: overrides.name ?? "",
      focusType: overrides.focusType ?? "industry",
      focusSecurity: overrides.focusSecurity ?? null,
    },
    computed: { nameIssue: overrides.nameIssue ?? null },
  };
}

describe("ChainMetaPanel", () => {
  it("이름 입력 시 changeName이 호출된다", async () => {
    setState({});
    const user = userEvent.setup();
    render(<ChainMetaPanel />);

    await user.type(screen.getByLabelText("체인 이름"), "A");
    expect(actionsMock.changeName).toHaveBeenCalled();
  });

  it("이름이 비어있고 필드가 터치되지 않았으면 오류가 보이지 않는다", () => {
    setState({ nameIssue: "NAME_REQUIRED" });
    render(<ChainMetaPanel />);
    expect(screen.queryByText("이름을 입력해 주세요")).not.toBeInTheDocument();
  });

  it("이름 필드 터치 후 비어있으면(E3) 오류를 표시한다", async () => {
    setState({ nameIssue: "NAME_REQUIRED" });
    const user = userEvent.setup();
    render(<ChainMetaPanel />);

    const input = screen.getByLabelText("체인 이름");
    await user.click(input);
    await user.tab(); // blur

    expect(screen.getByText("이름을 입력해 주세요")).toBeInTheDocument();
  });

  it("기준을 '기업 중심'으로 선택하면 대상 기업 검색 영역과 선택 사항 안내가 노출된다", async () => {
    setState({});
    const user = userEvent.setup();
    render(<ChainMetaPanel />);

    await user.click(screen.getByRole("radio", { name: "기업 중심" }));
    expect(actionsMock.changeFocusType).toHaveBeenCalledWith("company");
  });

  it("focusType='company'면 검색 영역이 노출된다", () => {
    setState({ focusType: "company" });
    render(<ChainMetaPanel />);
    expect(screen.getByText("대상 기업 지정은 선택 사항입니다")).toBeInTheDocument();
    expect(screen.getByText("mock-select-security")).toBeInTheDocument();
  });

  it("focusType='industry'면 검색 영역이 숨겨진다", () => {
    setState({ focusType: "industry" });
    render(<ChainMetaPanel />);
    expect(screen.queryByText("mock-select-security")).not.toBeInTheDocument();
  });

  it("focusSecurity가 설정되어 있으면 종목 칩과 해제 버튼이 보인다", async () => {
    setState({
      focusType: "company",
      focusSecurity: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
    });
    const user = userEvent.setup();
    render(<ChainMetaPanel />);

    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /해제/ }));
    expect(actionsMock.clearFocusSecurity).toHaveBeenCalled();
  });

  it("검색 결과 선택 시 setFocusSecurity가 호출된다", async () => {
    setState({ focusType: "company" });
    const user = userEvent.setup();
    render(<ChainMetaPanel />);

    await user.click(screen.getByText("mock-select-security"));
    expect(actionsMock.setFocusSecurity).toHaveBeenCalledWith({
      securityId: "s1",
      ticker: "005930",
      name: "삼성전자",
      market: "KRX",
    });
  });
});
