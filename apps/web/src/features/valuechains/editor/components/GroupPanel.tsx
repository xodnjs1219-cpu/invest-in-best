"use client";

import { useState } from "react";
import type { EditorGroup, GroupBlockReason } from "@iib/domain";
import type { ActionResult } from "@/features/valuechains/editor/context/ChainEditorContext";
import { Badge, Button, Heading, Input, Select } from "@/components/ui";

const GROUP_BLOCK_MESSAGES: Record<GroupBlockReason, string> = {
  NAME_REQUIRED: "이름을 입력해 주세요",
  NO_NODES_SELECTED: "노드를 먼저 선택해 주세요",
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

  const selectedCount = selectedNodeIds.length;
  const trimmedName = nameInput.trim();
  const canCreate = selectedCount > 0 && trimmedName.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Heading level={3}>그룹</Heading>
          <Badge tone={selectedCount > 0 ? "accent" : "neutral"}>
            선택된 노드 {selectedCount}개
          </Badge>
        </div>

        {/* 사전 안내 — 실패 후 에러로 알려주는 대신, 선택이 없을 때 방법을 먼저 알려준다. */}
        {selectedCount === 0 && (
          <p className="rounded-[var(--radius)] bg-surface-sunken px-3 py-2 text-xs text-fg-muted">
            캔버스에서 노드를 클릭하거나 <span className="text-fg">Shift+드래그</span>로 여러 개
            선택한 뒤, 이름을 붙여 그룹으로 묶으세요.
          </p>
        )}

        <label htmlFor="group-name-input" className="text-sm text-fg-muted">
          그룹 이름
        </label>
        <Input
          id="group-name-input"
          aria-label="그룹 이름"
          type="text"
          placeholder="예: 소재, 장비, 완성품"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
        {createError && <p className="text-xs text-danger">{GROUP_BLOCK_MESSAGES[createError]}</p>}
        <Button
          type="button"
          size="sm"
          onClick={handleCreate}
          disabled={!canCreate}
          title={
            canCreate
              ? undefined
              : selectedCount === 0
                ? "캔버스에서 노드를 먼저 선택해 주세요"
                : "그룹 이름을 입력해 주세요"
          }
        >
          {selectedCount > 0 ? `선택한 ${selectedCount}개로 그룹 만들기` : "그룹 만들기"}
        </Button>
      </div>

      {selectedNodeIds.length > 0 && groups.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <label htmlFor="group-assign-select" className="text-sm text-fg-muted">
            선택한 노드 {selectedCount}개를 기존 그룹으로 이동
          </label>
          <Select
            id="group-assign-select"
            aria-label="선택 노드 그룹 지정"
            value={assignTarget}
            onChange={(e) => setAssignTarget(e.target.value)}
          >
            <option value={NO_GROUP_OPTION}>그룹 없음</option>
            {groups.map((group) => (
              <option key={group.clientGroupId} value={group.clientGroupId}>
                {group.name}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" size="sm" onClick={handleAssign}>
            적용
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-2 border-t border-border pt-3">
        {groups.map((group) => {
          const memberCount = groupMembership.get(group.clientGroupId)?.length ?? 0;
          const isEmpty = emptyGroupIdSet.has(group.clientGroupId);
          const isDuplicate = duplicateNameSet.has(group.name.trim());
          const isRenaming = renamingGroupId === group.clientGroupId;

          return (
            <li key={group.clientGroupId} className="flex flex-col gap-1 rounded-[var(--radius)] border border-border p-2">
              {isRenaming ? (
                <div className="flex flex-col gap-1">
                  <Input
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                  />
                  {renameError && <p className="text-xs text-danger">{GROUP_BLOCK_MESSAGES[renameError]}</p>}
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={confirmRename}>
                      확인
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setRenamingGroupId(null)}>
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-fg">{group.name}</span>
                    <span className="text-xs text-fg-muted">멤버 {memberCount}개</span>
                    {isEmpty && <Badge tone="accent">저장 시 제외</Badge>}
                    {isDuplicate && <Badge tone="warning">이름 중복</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => startRename(group)}>
                      이름 변경
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      title="노드는 유지됩니다"
                      onClick={() => onDissolveGroup(group.clientGroupId)}
                    >
                      그룹 해제
                    </Button>
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
