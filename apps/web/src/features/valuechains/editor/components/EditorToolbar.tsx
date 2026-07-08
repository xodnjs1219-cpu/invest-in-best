"use client";

import { MAX_NODES_PER_CHAIN } from "@iib/domain";
import { useChainEditorState } from "@/features/valuechains/editor/context/ChainEditorContext";

const UNTITLED_PLACEHOLDER = "제목 없음";

/**
 * 편집 툴바 (UC-013 plan 모듈 18).
 * 본 plan분: 체인 이름 표시·노드 수 배지·더티 표시. 저장 버튼은 자리만(비활성 고정) —
 * 활성화·동작은 UC-018 plan이 교체한다.
 */
export function EditorToolbar() {
  const { state, computed } = useChainEditorState();

  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">
          {state.name.trim().length > 0 ? state.name : UNTITLED_PLACEHOLDER}
        </span>
        {state.isDirty && (
          <span data-testid="dirty-indicator" aria-label="저장되지 않은 변경 사항" className="text-amber-500">
            ●
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">
          {computed.nodeCount}/{MAX_NODES_PER_CHAIN}
        </span>
        <button
          type="button"
          disabled
          title="저장은 이름 입력 후 가능합니다"
          className="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500"
        >
          저장
        </button>
      </div>
    </div>
  );
}
