"use client";

import { useState } from "react";
import { MAX_NODES_PER_CHAIN } from "@iib/domain";
import {
  useChainEditorActions,
  useChainEditorState,
} from "@/features/valuechains/editor/context/ChainEditorContext";
import { SAVE_OUTCOME_TOAST_MESSAGES } from "@/features/valuechains/editor/constants/save";
import { OfficialSaveDialog } from "@/features/valuechains/editor/components/OfficialSaveDialog";

const UNTITLED_PLACEHOLDER = "제목 없음";

/**
 * 편집 툴바 (UC-013 plan 모듈 18, UC-018 plan 모듈 21, UC-021 plan 모듈 21 variant 분기).
 * 체인 이름 표시·노드 수 배지·더티 표시 + 저장 버튼(canSave/isSaving 연동).
 * `variant==='official'`이면 클릭 시 즉시 저장하지 않고 `OfficialSaveDialog`를 오픈해
 * 공시일 확정 후 `save({ disclosureDate })`를 호출한다(R-8). user variant는 기존 동작 유지.
 */
export function EditorToolbar() {
  const { meta, state, computed, async: asyncState } = useChainEditorState();
  const { save } = useChainEditorActions();
  const [toast, setToast] = useState<string | null>(null);
  const [isOfficialDialogOpen, setIsOfficialDialogOpen] = useState(false);

  const runSave = async (options?: { disclosureDate?: string | null }) => {
    const result = await save(options);
    const message = SAVE_OUTCOME_TOAST_MESSAGES[result.status];
    if (message) {
      setToast(message);
    }
    if (result.status === "saved" || result.status === "conflict") {
      setIsOfficialDialogOpen(false);
    }
  };

  const handleSaveClick = () => {
    if (meta.variant === "official") {
      setIsOfficialDialogOpen(true);
      return;
    }
    void runSave();
  };

  const handleOfficialConfirm = (disclosureDate: string | null) => {
    void runSave({ disclosureDate });
  };

  const isDisabled = !computed.canSave || asyncState.isSaving;

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
        {toast && <span className="text-xs text-gray-500">{toast}</span>}
        <button
          type="button"
          disabled={isDisabled}
          onClick={handleSaveClick}
          title={computed.canSave ? undefined : "저장은 이름 입력 후 가능합니다"}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            isDisabled ? "bg-gray-200 text-gray-500" : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {asyncState.isSaving ? "저장 중..." : "저장"}
        </button>
      </div>
      {meta.variant === "official" && (
        <OfficialSaveDialog
          open={isOfficialDialogOpen}
          isSaving={asyncState.isSaving}
          onConfirm={handleOfficialConfirm}
          onCancel={() => setIsOfficialDialogOpen(false)}
        />
      )}
    </div>
  );
}
