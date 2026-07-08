"use client";

import { useState } from "react";
import type { EditorGroup, GroupBlockReason } from "@iib/domain";
import type { ActionResult } from "@/features/valuechains/editor/context/ChainEditorContext";

const GROUP_BLOCK_MESSAGES: Record<GroupBlockReason, string> = {
  NAME_REQUIRED: "이름을 입력하세요",
  NO_NODES_SELECTED: "노드를 먼저 선택하세요",
  GROUP_NOT_FOUND: "그룹을 찾을 수 없습니다",
};

const NO_GROUP_OPTION = "__none__";

export interface GroupPanelProps {
  groups: EditorGroup[];
  groupMembership: ReadonlyMap<string, string[]>;
  emptyGroupIds: string[];
  duplicateGroupNames: string[];
  selectedNodeIds: string[];
  onCreateGroup: (input: { name: string; memberNodeIds: string[] }) => ActionResult<GroupBlockReason>;
  onRenameGroup: (clientGroupId: string, name: string) => ActionResult<GroupBlockReason>;
  onDissolveGroup: (clientGroupId: string) => void;
  onAssignNodeToGroup: (clientNodeId: string, groupClientId: string | null) => void;
}

/**
 * 그룹 패널(UC-017 plan 모듈 M12) — 그룹 생성/이름 변경/해제/노드 그룹 지정·제외 UI.
 * 계산은 전부 props(파생) 소비, 자체 도메인 로직 없음 — 순수 Presenter + 로컬 UI 상태만 보유.
 */
export function GroupPanel({
  groups,
  groupMembership,
  emptyGroupIds,
  duplicateGroupNames,
  selectedNodeIds,
  onCreateGroup,
  onRenameGroup,
  onDissolveGroup,
  onAssignNodeToGroup,
}: GroupPanelProps) {
  const [nameInput, setNameInput] = useState("");
  const [createError, setCreateError] = useState<GroupBlockReason | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<GroupBlockReason | null>(null);
  const [assignTarget, setAssignTarget] = useState<string>(NO_GROUP_OPTION);

  const emptyGroupIdSet = new Set(emptyGroupIds);
  const duplicateNameSet = new Set(duplicateGroupNames);

  const handleCreate = () => {
    const result = onCreateGroup({ name: nameInput, memberNodeIds: selectedNodeIds });
    if (!result.ok) {
      setCreateError(result.reason);
      return;
    }
    setCreateError(null);
    setNameInput("");
  };

  const startRename = (group: EditorGroup) => {
    setRenamingGroupId(group.clientGroupId);
    setRenameInput(group.name);
    setRenameError(null);
  };

  const confirmRename = () => {
    if (!renamingGroupId) {
      return;
    }
    const result = onRenameGroup(renamingGroupId, renameInput);
    if (!result.ok) {
      setRenameError(result.reason);
      return;
    }
    setRenamingGroupId(null);
    setRenameError(null);
  };

  const handleAssign = () => {
    const targetGroupId = assignTarget === NO_GROUP_OPTION ? null : assignTarget;
    for (const nodeId of selectedNodeIds) {
      onAssignNodeToGroup(nodeId, targetGroupId);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="group-name-input" className="text-sm font-medium text-gray-700">
          그룹 이름
        </label>
        <input
          id="group-name-input"
          aria-label="그룹 이름"
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        {createError && <p className="text-xs text-red-600">{GROUP_BLOCK_MESSAGES[createError]}</p>}
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          그룹 만들기
        </button>
      </div>

      {selectedNodeIds.length > 0 && groups.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
          <label htmlFor="group-assign-select" className="text-sm font-medium text-gray-700">
            선택 노드 그룹 지정
          </label>
          <select
            id="group-assign-select"
            aria-label="선택 노드 그룹 지정"
            value={assignTarget}
            onChange={(e) => setAssignTarget(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value={NO_GROUP_OPTION}>그룹 없음</option>
            {groups.map((group) => (
              <option key={group.clientGroupId} value={group.clientGroupId}>
                {group.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAssign}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            적용
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2 border-t border-gray-200 pt-3">
        {groups.map((group) => {
          const memberCount = groupMembership.get(group.clientGroupId)?.length ?? 0;
          const isEmpty = emptyGroupIdSet.has(group.clientGroupId);
          const isDuplicate = duplicateNameSet.has(group.name.trim());
          const isRenaming = renamingGroupId === group.clientGroupId;

          return (
            <li key={group.clientGroupId} className="flex flex-col gap-1 rounded-md border border-gray-200 p-2">
              {isRenaming ? (
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  {renameError && <p className="text-xs text-red-600">{GROUP_BLOCK_MESSAGES[renameError]}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmRename}
                      className="rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white"
                    >
                      확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingGroupId(null)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{group.name}</span>
                    <span className="text-xs text-gray-500">멤버 {memberCount}개</span>
                    {isEmpty && (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                        저장 시 제외
                      </span>
                    )}
                    {isDuplicate && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        이름 중복
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startRename(group)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      이름 변경
                    </button>
                    <button
                      type="button"
                      title="노드는 유지됩니다"
                      onClick={() => onDissolveGroup(group.clientGroupId)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      그룹 해제
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
