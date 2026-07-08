"use client";

import { useState } from "react";
import type { FreeSubjectType, SecurityRef } from "@iib/domain";
import { SecuritySearchTab } from "@/features/valuechains/editor/components/SecuritySearchTab";
import { FreeSubjectFormTab } from "@/features/valuechains/editor/components/FreeSubjectFormTab";

type TabKey = "security" | "free-subject";

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
}

/**
 * 노드 추가 패널(UC-015 plan 모듈 18) — 종목 검색/자유 주체 탭 컨테이너 + 상한·잔여 안내.
 * 비즈니스 로직 없음 — 상한 도달 시 두 탭 입력을 비활성화하고 하위 탭에 위임한다.
 */
export function NodeAddPanel({
  nodeCount,
  isNearNodeLimit,
  remainingNodeCapacity,
  onAddListedCompanyNode,
  onAddFreeSubjectNode,
  usedSecurityIds,
}: NodeAddPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("security");
  const isLimitReached = remainingNodeCapacity <= 0;

  return (
    <div className="flex flex-col gap-3">
      {isLimitReached && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          노드 상한(100개)에 도달해 더 이상 추가할 수 없습니다.
        </div>
      )}
      {!isLimitReached && isNearNodeLimit && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          잔여 {remainingNodeCapacity}개 추가 가능 (현재 {nodeCount}개)
        </div>
      )}

      <div role="tablist" className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "security"}
          onClick={() => setActiveTab("security")}
          className={`px-3 py-1.5 text-sm font-medium ${
            activeTab === "security" ? "border-b-2 border-gray-900 text-gray-900" : "text-gray-500"
          }`}
        >
          종목 검색
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "free-subject"}
          onClick={() => setActiveTab("free-subject")}
          className={`px-3 py-1.5 text-sm font-medium ${
            activeTab === "free-subject" ? "border-b-2 border-gray-900 text-gray-900" : "text-gray-500"
          }`}
        >
          자유 주체
        </button>
      </div>

      {activeTab === "security" ? (
        <SecuritySearchTab onAdd={onAddListedCompanyNode} usedSecurityIds={usedSecurityIds} disabled={isLimitReached} />
      ) : (
        <FreeSubjectFormTab onAdd={onAddFreeSubjectNode} disabled={isLimitReached} />
      )}
    </div>
  );
}
