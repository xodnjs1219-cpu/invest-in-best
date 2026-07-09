// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NodeListTab } from "@/features/valuechains/editor/components/NodeListTab";
import type { EditorNodeListItem } from "@/features/valuechains/editor/state/chainEditorSelectors";

const company: EditorNodeListItem = {
  clientNodeId: "n1",
  kind: "listed_company",
  label: "삼성전자",
  sublabel: "005930",
  market: "KRX",
  groupClientId: "g1",
  connectedEdgeCount: 2,
};

const free: EditorNodeListItem = {
  clientNodeId: "n2",
  kind: "free_subject",
  label: "최종 소비자",
  sublabel: "소비자",
  market: null,
  groupClientId: null,
  connectedEdgeCount: 0,
};

describe("NodeListTab", () => {
  it("노드가 없으면 빈 안내를 표시한다", () => {
    render(<NodeListTab items={[]} groupNameById={new Map()} onDeleteNode={vi.fn()} />);
    expect(screen.getByText(/아직 추가된 노드가 없습니다/)).toBeInTheDocument();
  });

  it("노드 목록과 라벨·부가정보·그룹명을 표시한다", () => {
    render(
      <NodeListTab
        items={[company, free]}
        groupNameById={new Map([["g1", "소재"]])}
        onDeleteNode={vi.fn()}
      />,
    );
    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(screen.getByText("005930")).toBeInTheDocument();
    expect(screen.getByText("최종 소비자")).toBeInTheDocument();
    expect(screen.getByText(/그룹: 소재/)).toBeInTheDocument();
    expect(screen.getByText(/엣지 2/)).toBeInTheDocument();
  });

  it("삭제 버튼 클릭 시 onDeleteNode(clientNodeId)를 호출한다", async () => {
    const onDeleteNode = vi.fn();
    const user = userEvent.setup();
    render(
      <NodeListTab items={[company]} groupNameById={new Map()} onDeleteNode={onDeleteNode} />,
    );
    await user.click(screen.getByRole("button", { name: /삼성전자 노드 삭제/ }));
    expect(onDeleteNode).toHaveBeenCalledWith("n1");
  });
});
