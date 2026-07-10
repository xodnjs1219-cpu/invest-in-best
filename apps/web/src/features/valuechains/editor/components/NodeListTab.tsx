"use client";

import { Badge } from "@/components/ui";
import type { EditorNodeListItem } from "@/features/valuechains/editor/state/chainEditorSelectors";

interface NodeListTabProps {
  items: EditorNodeListItem[];
  /** clientGroupId → 그룹명 맵(소속 그룹 표기용). */
  groupNameById: ReadonlyMap<string, string>;
  onDeleteNode: (clientNodeId: string) => void;
}

/**
 * "현재 노드" 탭 — 캔버스에 추가된 노드 목록을 표시하고 개별 삭제한다(UC-015).
 * 종목/자유 주체를 구분해 라벨·부가정보·시장 배지·소속 그룹·연결 엣지 수를 보여준다.
 * 삭제는 상위(NodeAddPanel)의 useNodeDeletion 흐름에 위임한다(연결 엣지 있으면 확인 다이얼로그).
 */
export function NodeListTab({ items, groupNameById, onDeleteNode }: NodeListTabProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-[var(--radius)] bg-surface-sunken px-3 py-6 text-center text-sm text-fg-muted">
        아직 추가된 노드가 없습니다. 종목 검색·자유 주체 탭에서 노드를 추가하세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-fg-muted">현재 노드 {items.length}개</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const groupName = item.groupClientId ? groupNameById.get(item.groupClientId) : undefined;
          return (
            <li
              key={item.clientNodeId}
              className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-surface-raised px-3 py-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm text-fg">{item.label}</span>
                  {item.market && (
                    <Badge tone={item.market === "US" ? "accent" : "data"}>{item.market}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                  <span>{item.sublabel}</span>
                  {groupName && <span>· 그룹: {groupName}</span>}
                  {item.connectedEdgeCount > 0 && <span>· 엣지 {item.connectedEdgeCount}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDeleteNode(item.clientNodeId)}
                aria-label={`${item.label} 노드 삭제`}
                title="노드 삭제"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius)] border border-border text-fg-muted transition-colors hover:border-danger hover:bg-danger hover:text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
