import { Badge, Button, EmptyState, ErrorState } from "@/components/ui";
import type { ProposalListItem } from "@/features/admin-llm-proposals/lib/dto";
import {
  APPLICABILITY_REASON_LABELS,
  APPROVE_CONFIRM_MESSAGE,
  EMPTY_QUEUE_MESSAGE,
  LIST_LOAD_ERROR_MESSAGE,
  LIST_RETRY_BUTTON_LABEL,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_TYPE_LABELS,
} from "@/features/admin-llm-proposals/constants";

type ProposalTableProps = {
  items: ProposalListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedProposalId: string | null;
  processingProposalId: string | null;
  onSelect: (proposalId: string) => void;
  onApprove: (proposalId: string) => void;
  onRejectClick: (proposalId: string) => void;
};

const nodeLabel = (node: ProposalListItem["sourceNode"]) =>
  node.ticker ? `${node.displayName} (${node.ticker})` : node.displayName;

/**
 * 순수 Presenter — 제안 목록 테이블(spec 4-A-6). 로딩/오류/빈 상태 분기,
 * pending 행에만 적용 가능/재검토 배지와 승인/거부 버튼을 렌더한다(R-6).
 */
export function ProposalTable({
  items,
  isLoading,
  isError,
  onRetry,
  selectedProposalId,
  processingProposalId,
  onSelect,
  onApprove,
  onRejectClick,
}: ProposalTableProps) {
  if (isLoading) {
    return <p className="p-6 text-center text-sm text-fg-muted">로딩 중...</p>;
  }

  if (isError) {
    return (
      <ErrorState
        message={LIST_LOAD_ERROR_MESSAGE}
        onRetry={onRetry}
        retryLabel={LIST_RETRY_BUTTON_LABEL}
      />
    );
  }

  if (items.length === 0) {
    return <EmptyState message={EMPTY_QUEUE_MESSAGE} />;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-fg-muted">
          <th className="p-2">유형</th>
          <th className="p-2">대상 노드</th>
          <th className="p-2">관계 종류</th>
          <th className="p-2">근거 공시</th>
          <th className="p-2">상태</th>
          <th className="p-2">작업</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const isSelected = item.proposalId === selectedProposalId;
          const isProcessing = item.proposalId === processingProposalId;
          const isPending = item.status === "pending";

          return (
            <tr
              key={item.proposalId}
              onClick={() => onSelect(item.proposalId)}
              className={`cursor-pointer border-b border-border hover:bg-surface-hover ${isSelected ? "bg-accent-soft" : ""}`}
            >
              <td className="p-2">
                <Badge tone="neutral">{PROPOSAL_TYPE_LABELS[item.proposalType]}</Badge>
              </td>
              <td className="p-2">
                {nodeLabel(item.sourceNode)} → {nodeLabel(item.targetNode)}
              </td>
              <td className="p-2">
                {item.relationType ? (
                  <span>
                    {item.relationType.name}
                    {!item.relationType.isActive && (
                      <Badge tone="warning" className="ml-1">
                        비활성
                      </Badge>
                    )}
                  </span>
                ) : (
                  <span className="text-fg-subtle">-</span>
                )}
              </td>
              <td className="p-2">
                {item.disclosure ? (
                  <div className="flex flex-col">
                    <a
                      href={item.disclosure.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="text-accent underline hover:text-accent-hover"
                    >
                      {item.disclosure.title}
                    </a>
                    <span className="text-xs text-fg-muted">{item.disclosure.disclosureDate}</span>
                  </div>
                ) : (
                  <span className="text-fg-subtle">-</span>
                )}
              </td>
              <td className="p-2">
                <Badge tone="neutral">{PROPOSAL_STATUS_LABELS[item.status]}</Badge>
                {isPending && !item.applicability.isApplicable && (
                  <Badge tone="warning" className="ml-1">
                    재검토
                    {item.applicability.reason
                      ? `: ${APPLICABILITY_REASON_LABELS[
                          item.applicability.reason as keyof typeof APPLICABILITY_REASON_LABELS
                        ]}`
                      : ""}
                  </Badge>
                )}
              </td>
              <td className="p-2">
                {isPending && (
                  <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => {
                        if (window.confirm(APPROVE_CONFIRM_MESSAGE)) {
                          onApprove(item.proposalId);
                        }
                      }}
                    >
                      승인
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => onRejectClick(item.proposalId)}
                    >
                      거부
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
