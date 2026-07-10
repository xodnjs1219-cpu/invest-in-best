"use client";

import { useState } from "react";
import type { FreeSubjectType, SecurityRef } from "@iib/domain";
import { SecuritySearchTab } from "@/features/valuechains/editor/components/SecuritySearchTab";
import { FreeSubjectFormTab } from "@/features/valuechains/editor/components/FreeSubjectFormTab";
import { NodeListTab } from "@/features/valuechains/editor/components/NodeListTab";
import type { EditorNodeListItem } from "@/features/valuechains/editor/state/chainEditorSelectors";

type TabKey = "security" | "free-subject" | "node-list";

export interface NodeAddPanelProps {
  nodeCount: number;
  isNearNodeLimit: boolean;
  remainingNodeCapacity: number;
  onAddListedCompanyNode: (security: SecurityRef) => void;
  onAddFreeSubjectNode: (input: {
    subjectType: FreeSubjectType;
    subjectName: string;
    subjectMemo: string | null;
  }) => void;
  usedSecurityIds: ReadonlySet<string>;
  /** "현재 노드" 탭에 표시할 노드 목록. */
  nodeListItems: EditorNodeListItem[];
  /** clientGroupId → 그룹명 맵(소속 그룹 표기용). */
  groupNameById: ReadonlyMap<string, string>;
  /** 노드 삭제 요청(상위 useNodeDeletion 흐름에 위임 — 연결 엣지 있으면 확인 다이얼로그). */
  onDeleteNode: (clientNodeId: string) => void;
}

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "security", label: "종목 검색" },
  { key: "free-subject", label: "자유 주체" },
  { key: "node-list", label: "현재 노드" },
];

/**
 * 노드 추가/관리 패널(UC-015 plan 모듈 18) — 종목 검색/자유 주체/현재 노드 탭 컨테이너 + 상한·잔여 안내.
 * 순수 Presenter(탭 로컬 상태만) — 노드 목록·삭제 흐름은 상위에서 주입한다.
 * "현재 노드" 탭은 추가된 노드 목록을 보여주고 개별 삭제한다.
 */
export function NodeAddPanel({
  nodeCount,
  isNearNodeLimit,
  remainingNodeCapacity,
  onAddListedCompanyNode,
  onAddFreeSubjectNode,
  usedSecurityIds,
  nodeListItems,
  groupNameById,
  onDeleteNode,
}: NodeAddPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("security");
  const isLimitReached = remainingNodeCapacity <= 0;

  return (
    <div className="flex flex-col gap-3">
      {isLimitReached && (
        <div className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-sm text-danger">
          노드 상한(100개)에 도달해 더 이상 추가할 수 없습니다.
        </div>
      )}
      {!isLimitReached && isNearNodeLimit && (
        <div className="rounded-[var(--radius)] bg-warning-soft px-3 py-2 text-sm text-warning">
          잔여 {remainingNodeCapacity}개 추가 가능 (현재 {nodeCount}개)
        </div>
      )}

      <div role="tablist" className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const showCount = tab.key === "node-list" && nodeCount > 0;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-sm ${
                isActive ? "border-b-2 border-accent text-accent" : "text-fg-muted hover:text-fg"
              }`}
            >
              {tab.label}
              {showCount && <span className="ml-1 text-xs">({nodeCount})</span>}
            </button>
          );
        })}
      </div>

      {activeTab === "security" && (
        <SecuritySearchTab
          onAdd={onAddListedCompanyNode}
          usedSecurityIds={usedSecurityIds}
          disabled={isLimitReached}
        />
      )}
      {activeTab === "free-subject" && (
        <FreeSubjectFormTab onAdd={onAddFreeSubjectNode} disabled={isLimitReached} />
      )}
      {activeTab === "node-list" && (
        <NodeListTab
          items={nodeListItems}
          groupNameById={groupNameById}
          onDeleteNode={onDeleteNode}
        />
      )}
    </div>
  );
}
