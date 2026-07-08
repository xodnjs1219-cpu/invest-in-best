import type { ProposalListItem } from "@/features/admin-llm-proposals/backend/schema";
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
    return <p className="p-6 text-center text-sm text-gray-500">로딩 중...</p>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-red-600">{LIST_LOAD_ERROR_MESSAGE}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          {LIST_RETRY_BUTTON_LABEL}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="p-6 text-center text-sm text-gray-500">{EMPTY_QUEUE_MESSAGE}</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
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
              className={`cursor-pointer border-b hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""}`}
            >
              <td className="p-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {PROPOSAL_TYPE_LABELS[item.proposalType]}
                </span>
              </td>
              <td className="p-2">
                {nodeLabel(item.sourceNode)} → {nodeLabel(item.targetNode)}
              </td>
              <td className="p-2">
                {item.relationType ? (
                  <span>
                    {item.relationType.name}
                    {!item.relationType.isActive && (
                      <span className="ml-1 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800">
                        비활성
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
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
                      className="text-blue-600 underline"
                    >
                      {item.disclosure.title}
                    </a>
                    <span className="text-xs text-gray-500">{item.disclosure.disclosureDate}</span>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="p-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {PROPOSAL_STATUS_LABELS[item.status]}
                </span>
                {isPending && !item.applicability.isApplicable && (
                  <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-800">
                    재검토
                    {item.applicability.reason
                      ? `: ${APPLICABILITY_REASON_LABELS[
                          item.applicability.reason as keyof typeof APPLICABILITY_REASON_LABELS
                        ]}`
                      : ""}
                  </span>
                )}
              </td>
              <td className="p-2">
                {isPending && (
                  <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        if (window.confirm(APPROVE_CONFIRM_MESSAGE)) {
                          onApprove(item.proposalId);
                        }
                      }}
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => onRejectClick(item.proposalId)}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      거부
                    </button>
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
