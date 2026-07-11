"use client";

import { useCallback, useMemo, useState } from "react";
import type { EditorMode, EditorVariant } from "@iib/domain";
import {
  ChainEditorProvider,
  useChainEditorActions,
  useChainEditorState,
} from "@/features/valuechains/editor/context/ChainEditorContext";
import { useUnsavedChangesGuard } from "@/features/valuechains/editor/hooks/useUnsavedChangesGuard";
import { useNodeDeletion } from "@/features/valuechains/editor/hooks/useNodeDeletion";
import { DeleteConfirmDialog } from "@/features/valuechains/editor/components/DeleteConfirmDialog";
import { EntryBlockedScreen } from "@/features/valuechains/editor/components/EntryBlockedScreen";
import { EditorToolbar } from "@/features/valuechains/editor/components/EditorToolbar";
import { ChainMetaPanel } from "@/features/valuechains/editor/components/ChainMetaPanel";
import { NodeAddPanel } from "@/features/valuechains/editor/components/NodeAddPanel";
import { GroupPanel } from "@/features/valuechains/editor/components/GroupPanel";
import { EditorCanvasContainer } from "@/features/valuechains/editor/components/EditorCanvasContainer";
import { IssuePanel } from "@/features/valuechains/editor/components/IssuePanel";
import { SaveConflictDialog } from "@/features/valuechains/editor/components/SaveConflictDialog";
import { UnsavedLeaveDialog } from "@/features/valuechains/editor/components/UnsavedLeaveDialog";
import {
  selectNodeListItems,
  selectUsedSecurityIds,
} from "@/features/valuechains/editor/state/chainEditorSelectors";
import { Button, Heading, Skeleton } from "@/components/ui";

export interface ChainEditorPageProps {
  mode: EditorMode;
  variant: EditorVariant;
  chainId?: string;
}

function ChainEditorPageBody() {
  const { state, computed, async: asyncState } = useChainEditorState();
  const {
    addListedCompanyNode,
    addFreeSubjectNode,
    createGroup,
    renameGroup,
    assignNodeToGroup,
    dissolveGroup,
    reloadFromLatest,
    resetSaveError,
  } = useChainEditorActions();
  const { isLeaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(state.isDirty);

  // 방금 추가된 노드 — 캔버스가 해당 위치로 뷰포트를 이동한다("추가했는데 안 보임" 방지).
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const handleFocusHandled = useCallback(() => setFocusNodeId(null), []);

  // "현재 노드" 탭 데이터 — 노드 목록과 그룹명 맵(소속 그룹 표기용). state 변경 시에만 재계산.
  const nodeListItems = useMemo(() => selectNodeListItems(state), [state]);
  const groupNameById = useMemo(
    () => new Map(Object.values(state.groups).map((g) => [g.clientGroupId, g.name])),
    [state.groups],
  );

  // 노드 삭제 흐름(캔버스 ×버튼과 별개 인스턴스 — "현재 노드" 탭 전용, 확인 다이얼로그 포함).
  const { requestDeleteNode, dialogProps: deleteDialogProps } = useNodeDeletion();

  if (asyncState.isBootstrapping) {
    return <Skeleton data-testid="editor-skeleton" className="h-[480px] w-full" />;
  }

  if (asyncState.entryBlocked) {
    return (
      <EntryBlockedScreen
        ownedChainCount={asyncState.entryBlocked.ownedChainCount}
        maxChainsPerUser={asyncState.entryBlocked.maxChainsPerUser}
      />
    );
  }

  if (asyncState.bootstrapError?.kind === "auth") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <Heading level={1}>로그인이 필요합니다</Heading>
        <p className="text-sm text-fg-muted">세션이 만료되었습니다. 다시 로그인해 주세요.</p>
        <Button as="link" href={`/auth/login?returnTo=${encodeURIComponent("/valuechains/new")}`}>
          로그인 페이지로 이동
        </Button>
      </div>
    );
  }

  if (asyncState.bootstrapError?.kind === "network") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <Heading level={1}>오류가 발생했습니다</Heading>
        <p className="text-sm text-fg-muted">잠시 후 다시 시도해 주세요.</p>
        <Button type="button" onClick={() => asyncState.bootstrapError?.retry?.()}>
          재시도
        </Button>
      </div>
    );
  }

  if (!state.initialized) {
    return <Skeleton data-testid="editor-skeleton" className="h-[480px] w-full" />;
  }

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar />
      <ChainMetaPanel />
      <div className="flex flex-1 gap-4 px-4 py-4">
        <div className="w-80 shrink-0 space-y-4 lg:w-96">
          <NodeAddPanel
            nodeCount={computed.nodeCount}
            isNearNodeLimit={computed.isNearNodeLimit}
            remainingNodeCapacity={computed.remainingNodeCapacity}
            onAddListedCompanyNode={(security) => {
              const result = addListedCompanyNode(security);
              if (result.ok && result.clientNodeId) setFocusNodeId(result.clientNodeId);
              return result;
            }}
            onAddFreeSubjectNode={(input) => {
              const result = addFreeSubjectNode(input);
              if (result.ok && result.clientNodeId) setFocusNodeId(result.clientNodeId);
              return result;
            }}
            usedSecurityIds={selectUsedSecurityIds(state)}
            nodeListItems={nodeListItems}
            groupNameById={groupNameById}
            onDeleteNode={requestDeleteNode}
            groupCount={Object.keys(state.groups).length}
            selectedNodeCount={state.selection.nodeIds.length}
            groupPanel={
              <GroupPanel
                groups={Object.values(state.groups)}
                groupMembership={computed.groupMembership}
                emptyGroupIds={computed.emptyGroupIds}
                duplicateGroupNames={computed.duplicateGroupNames}
                selectedNodeIds={state.selection.nodeIds}
                onCreateGroup={createGroup}
                onRenameGroup={renameGroup}
                onDissolveGroup={dissolveGroup}
                onAssignNodeToGroup={assignNodeToGroup}
              />
            }
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <IssuePanel clientIssues={computed.clientIssues} serverIssues={state.serverIssues} />
          <div className="flex-1">
            <EditorCanvasContainer focusNodeId={focusNodeId} onFocusHandled={handleFocusHandled} />
          </div>
        </div>
      </div>
      <DeleteConfirmDialog {...deleteDialogProps} />
      <UnsavedLeaveDialog open={isLeaveDialogOpen} onConfirm={confirmLeave} onCancel={cancelLeave} />
      <SaveConflictDialog
        open={asyncState.saveError?.kind === "conflict"}
        onReload={() => void reloadFromLatest()}
        onKeepEditing={resetSaveError}
      />
    </div>
  );
}

/**
 * 편집기 루트 (UC-013 plan 모듈 16) — Provider 장착 + 상태별 분기 렌더(Container 역할).
 * 로직은 Context가 소유하고, 이 컴포넌트는 분기·배치만 담당한다.
 */
export function ChainEditorPage({ mode, variant, chainId }: ChainEditorPageProps) {
  return (
    <ChainEditorProvider mode={mode} variant={variant} chainId={chainId}>
      <ChainEditorPageBody />
    </ChainEditorProvider>
  );
}
