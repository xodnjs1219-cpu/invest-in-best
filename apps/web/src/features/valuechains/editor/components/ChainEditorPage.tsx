"use client";

import type { EditorMode, EditorVariant } from "@iib/domain";
import {
  ChainEditorProvider,
  useChainEditorState,
} from "@/features/valuechains/editor/context/ChainEditorContext";
import { useUnsavedChangesGuard } from "@/features/valuechains/editor/hooks/useUnsavedChangesGuard";
import { EntryBlockedScreen } from "@/features/valuechains/editor/components/EntryBlockedScreen";
import { EditorToolbar } from "@/features/valuechains/editor/components/EditorToolbar";
import { ChainMetaPanel } from "@/features/valuechains/editor/components/ChainMetaPanel";
import { UnsavedLeaveDialog } from "@/features/valuechains/editor/components/UnsavedLeaveDialog";
import { ChainCanvas } from "@/components/mindmap/ChainCanvas";

export interface ChainEditorPageProps {
  mode: EditorMode;
  variant: EditorVariant;
  chainId?: string;
}

function ChainEditorPageBody() {
  const { state, async: asyncState } = useChainEditorState();
  const { isLeaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(state.isDirty);

  if (asyncState.isBootstrapping) {
    return (
      <div
        data-testid="editor-skeleton"
        className="h-[480px] w-full animate-pulse rounded-lg bg-gray-100"
      />
    );
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
        <h1 className="text-lg font-semibold text-gray-900">로그인이 필요합니다</h1>
        <p className="text-sm text-gray-600">세션이 만료되었습니다. 다시 로그인해 주세요.</p>
        <a
          href={`/auth/login?returnTo=${encodeURIComponent("/valuechains/new")}`}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          로그인 페이지로 이동
        </a>
      </div>
    );
  }

  if (asyncState.bootstrapError?.kind === "network") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-gray-900">오류가 발생했습니다</h1>
        <p className="text-sm text-gray-600">잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={() => asyncState.bootstrapError?.retry?.()}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          재시도
        </button>
      </div>
    );
  }

  if (!state.initialized) {
    return (
      <div
        data-testid="editor-skeleton"
        className="h-[480px] w-full animate-pulse rounded-lg bg-gray-100"
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar />
      <ChainMetaPanel />
      <div className="flex-1 px-4 py-4">
        <ChainCanvas nodes={[]} edges={[]} />
      </div>
      <UnsavedLeaveDialog open={isLeaveDialogOpen} onConfirm={confirmLeave} onCancel={cancelLeave} />
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
