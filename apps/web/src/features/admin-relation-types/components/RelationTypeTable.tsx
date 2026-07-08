import type { AdminRelationTypeListItem } from "@/features/admin-relation-types/backend/schema";
import {
  ACTIVE_STATE_BADGE_CLASSES,
  ACTIVE_STATE_LABELS,
  DIRECTION_LABELS,
  EMPTY_LIST_MESSAGE,
  IN_USE_BADGE_CLASSES,
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
    return <p className="p-6 text-center text-sm text-gray-500">{LIST_LOADING_MESSAGE}</p>;
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
    return <p className="p-6 text-center text-sm text-gray-500">{EMPTY_LIST_MESSAGE}</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
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
            <tr key={item.id} className="border-b hover:bg-gray-50">
              <td className="p-2">{item.name}</td>
              <td className="p-2">
                {item.isDirected ? DIRECTION_LABELS.directed : DIRECTION_LABELS.undirected}
              </td>
              <td className="p-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${ACTIVE_STATE_BADGE_CLASSES[activeKey]}`}
                >
                  {ACTIVE_STATE_LABELS[activeKey]}
                </span>
                {item.isInUse && (
                  <span className={`ml-1 rounded px-2 py-0.5 text-xs ${IN_USE_BADGE_CLASSES}`}>
                    {IN_USE_BADGE_LABEL}
                  </span>
                )}
              </td>
              <td className="p-2">{new Date(item.updatedAt).toLocaleString("ko-KR")}</td>
              <td className="p-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => onRenameClick(item)}
                    className="rounded border px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
                  >
                    {ROW_ACTION_LABELS.rename}
                  </button>
                  {item.isActive ? (
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => onDeactivateClick(item)}
                      className="rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {ROW_ACTION_LABELS.deactivate}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => onReactivate(item)}
                      className="rounded border px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                    >
                      {ROW_ACTION_LABELS.reactivate}
                    </button>
                  )}
                  {isMutating && <span className="text-xs text-gray-400">처리 중...</span>}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
