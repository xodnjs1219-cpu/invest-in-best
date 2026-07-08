// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalTable } from "@/features/admin-llm-proposals/components/ProposalTable";
import type { ProposalListItem } from "@/features/admin-llm-proposals/backend/schema";
import { EMPTY_QUEUE_MESSAGE, LIST_LOAD_ERROR_MESSAGE } from "@/features/admin-llm-proposals/constants";

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
  rationale: "공시 내용에 따르면...",
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

describe("ProposalTable", () => {
  it("빈 목록이면 빈 상태 안내를 표시한다(E13)", () => {
    render(
      <ProposalTable
        items={[]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.getByText(EMPTY_QUEUE_MESSAGE)).toBeInTheDocument();
  });

  it("오류 상태면 오류 안내와 재시도 버튼을 표시하고 클릭 시 onRetry를 호출한다", () => {
    const onRetry = vi.fn();
    render(
      <ProposalTable
        items={[]}
        isLoading={false}
        isError={true}
        onRetry={onRetry}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.getByText(LIST_LOAD_ERROR_MESSAGE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("행 클릭 시 onSelect를 호출한다", () => {
    const onSelect = vi.fn();
    render(
      <ProposalTable
        items={[buildItem()]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={onSelect}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    fireEvent.click(screen.getByText(/삼성전자/));
    expect(onSelect).toHaveBeenCalledWith("proposal-1");
  });

  it("pending 행에는 승인/거부 버튼이 노출된다", () => {
    render(
      <ProposalTable
        items={[buildItem()]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "승인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "거부" })).toBeInTheDocument();
  });

  it("approved 행에는 승인/거부 버튼이 노출되지 않는다", () => {
    render(
      <ProposalTable
        items={[buildItem({ status: "approved", reviewedBy: "admin-1", reviewedAt: "2026-07-02T00:00:00.000Z", resultingSnapshotId: "snap-1" })]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.queryByRole("button", { name: "승인" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "거부" })).not.toBeInTheDocument();
  });

  it("승인 클릭 시 confirm 통과하면 onApprove를 호출한다", () => {
    const onApprove = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <ProposalTable
        items={[buildItem()]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={onApprove}
        onRejectClick={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith("proposal-1");
    confirmSpy.mockRestore();
  });

  it("승인 클릭 시 confirm 취소하면 onApprove를 호출하지 않는다", () => {
    const onApprove = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <ProposalTable
        items={[buildItem()]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={onApprove}
        onRejectClick={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    expect(onApprove).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("거부 클릭 시 onRejectClick을 호출한다", () => {
    const onRejectClick = vi.fn();
    render(
      <ProposalTable
        items={[buildItem()]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={noop}
        onRejectClick={onRejectClick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "거부" }));
    expect(onRejectClick).toHaveBeenCalledWith("proposal-1");
  });

  it("processingProposalId가 해당 행이면 승인/거부 버튼이 비활성화된다", () => {
    render(
      <ProposalTable
        items={[buildItem()]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId="proposal-1"
        onSelect={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "승인" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "거부" })).toBeDisabled();
  });

  it("relationType이 null이면(예: relation_delete) 관계 종류 라벨을 표시하지 않고 오류가 나지 않는다", () => {
    render(
      <ProposalTable
        items={[buildItem({ proposalType: "relation_delete", relationType: null })]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.getByText(/삼성전자/)).toBeInTheDocument();
  });

  it("적용 불가(isApplicable=false) 행에 재검토 배지를 표시한다", () => {
    render(
      <ProposalTable
        items={[buildItem({ applicability: { isApplicable: false, reason: "NODE_NOT_FOUND" } })]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    expect(screen.getByText(/재검토/)).toBeInTheDocument();
  });

  it("원문 링크는 새 탭으로 열리도록 target/rel이 설정된다", () => {
    render(
      <ProposalTable
        items={[buildItem()]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        selectedProposalId={null}
        processingProposalId={null}
        onSelect={noop}
        onApprove={noop}
        onRejectClick={noop}
      />,
    );
    const link = screen.getByRole("link", { name: "공급계약체결" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
