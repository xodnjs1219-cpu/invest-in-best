// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalDetailPanel } from "@/features/admin-llm-proposals/components/ProposalDetailPanel";
import type { ProposalListItem } from "@/features/admin-llm-proposals/backend/schema";

const buildItem = (overrides: Partial<ProposalListItem> = {}): ProposalListItem => ({
  proposalId: "proposal-1",
  chain: { chainId: "chain-1", name: "반도체 밸류체인" },
  proposalType: "relation_add",
  sourceNode: { nodeId: "n-1", displayName: "삼성전자", nodeKind: "listed_company", ticker: "005930" },
  targetNode: { nodeId: "n-2", displayName: "SK하이닉스", nodeKind: "listed_company", ticker: "000660" },
  relationType: { relationTypeId: "rt-1", name: "공급", isActive: true },
  disclosure: {
    disclosureId: "d-1",
    title: "공급계약체결",
    disclosureDate: "2026-07-01",
    url: "https://dart.fss.or.kr/x",
    source: "dart",
  },
  rationale: "공시 내용에 따르면 공급 계약을 체결했습니다.",
  status: "pending",
  basedOnSnapshotId: "snap-0",
  applicability: { isApplicable: true, reason: null },
  createdAt: "2026-07-01T00:00:00.000Z",
  reviewedBy: null,
  reviewedAt: null,
  resultingSnapshotId: null,
  ...overrides,
});

const noop = () => {};

describe("ProposalDetailPanel", () => {
  it("proposal이 null이면 아무것도 렌더하지 않는다", () => {
    const { container } = render(
      <ProposalDetailPanel proposal={null} isProcessing={false} onClose={noop} onApprove={noop} onRejectClick={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("proposal이 있으면 rationale 전문과 공시 정보를 표시한다", () => {
    render(
      <ProposalDetailPanel
        proposal={buildItem()}
        isProcessing={false}
        onClose={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.getByText(/공급 계약을 체결했습니다/)).toBeInTheDocument();
    expect(screen.getByText("공급계약체결")).toBeInTheDocument();
  });

  it("닫기 버튼 클릭 시 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(
      <ProposalDetailPanel
        proposal={buildItem()}
        isProcessing={false}
        onClose={onClose}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /닫기/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pending이 아니면 승인/거부 버튼을 표시하지 않는다", () => {
    render(
      <ProposalDetailPanel
        proposal={buildItem({ status: "approved" })}
        isProcessing={false}
        onClose={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.queryByRole("button", { name: "승인" })).not.toBeInTheDocument();
  });

  it("재검토 필요 제안은 사유 설명 문구를 표시한다", () => {
    render(
      <ProposalDetailPanel
        proposal={buildItem({ applicability: { isApplicable: false, reason: "NODE_NOT_FOUND" } })}
        isProcessing={false}
        onClose={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.getByText(/참조 노드가 현재 구성에 없습니다/)).toBeInTheDocument();
  });
});
