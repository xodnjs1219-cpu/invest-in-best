import { Badge, Button, EmptyState, ErrorState } from "@/components/ui";
import type { AdminRelationTypeListItem } from "@/features/admin-relation-types/backend/schema";
import {
  ACTIVE_STATE_BADGE_TONES,
  ACTIVE_STATE_LABELS,
  DIRECTION_LABELS,
  EMPTY_LIST_MESSAGE,
  IN_USE_BADGE_TONE,
  IN_USE_BADGE_LABEL,
  LIST_LOAD_ERROR_MESSAGE,
  LIST_LOADING_MESSAGE,
  LIST_RETRY_BUTTON_LABEL,
  ROW_ACTION_LABELS,
} from "@/features/admin-relation-types/constants";

type RelationTypeTableProps = {
  items: AdminRelationTypeListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  mutatingId: string | null;
  onRenameClick: (item: AdminRelationTypeListItem) => void;
  onDeactivateClick: (item: AdminRelationTypeListItem) => void;
  onReactivate: (item: AdminRelationTypeListItem) => void;
};

/**
 * 순수 Presenter — 관계 종류 마스터 목록 테이블(plan M11, spec Main-2).
 * 삭제 버튼은 존재하지 않는다(E1·Main-8). 활성 행은 이름 변경/비활성화, 비활성 행은
 * 재활성화(확인 다이얼로그 없이 즉시 실행, E4) 액션을 노출한다.
 */
export function RelationTypeTable({
  items,
  isLoading,
  isError,
  onRetry,
  mutatingId,
  onRenameClick,
  onDeactivateClick,
  onReactivate,
}: RelationTypeTableProps) {
  if (isLoading) {
    return <p className="p-6 text-center text-sm text-fg-muted">{LIST_LOADING_MESSAGE}</p>;
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
    return <EmptyState message={EMPTY_LIST_MESSAGE} />;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-fg-muted">
          <th className="p-2">이름</th>
          <th className="p-2">방향성</th>
          <th className="p-2">상태</th>
          <th className="p-2">수정일</th>
          <th className="p-2">액션</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const isMutating = mutatingId === item.id;
          const activeKey = item.isActive ? "active" : "inactive";

          return (
            <tr key={item.id} className="border-b border-border hover:bg-surface-hover">
              <td className="p-2">{item.name}</td>
              <td className="p-2">
                {item.isDirected ? DIRECTION_LABELS.directed : DIRECTION_LABELS.undirected}
              </td>
              <td className="p-2">
                <Badge tone={ACTIVE_STATE_BADGE_TONES[activeKey]}>
                  {ACTIVE_STATE_LABELS[activeKey]}
                </Badge>
                {item.isInUse && (
                  <Badge tone={IN_USE_BADGE_TONE} className="ml-1">
                    {IN_USE_BADGE_LABEL}
                  </Badge>
                )}
              </td>
              <td className="p-2">{new Date(item.updatedAt).toLocaleString("ko-KR")}</td>
              <td className="p-2">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => onRenameClick(item)}
                  >
                    {ROW_ACTION_LABELS.rename}
                  </Button>
                  {item.isActive ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isMutating}
                      onClick={() => onDeactivateClick(item)}
                    >
                      {ROW_ACTION_LABELS.deactivate}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isMutating}
                      onClick={() => onReactivate(item)}
                    >
                      {ROW_ACTION_LABELS.reactivate}
                    </Button>
                  )}
                  {isMutating && <span className="text-xs text-fg-subtle">처리 중...</span>}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
