"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { EditorMode, EditorVariant, FocusType, SecurityRef } from "@iib/domain";
import {
  CHAIN_EDITOR_INITIAL_STATE,
  chainEditorReducer,
  type ChainEditorState,
} from "@/features/valuechains/editor/state/chainEditorReducer";
import { selectNameIssue, selectNodeCount } from "@/features/valuechains/editor/state/chainEditorSelectors";
import { useChainQuotaGate } from "@/features/valuechains/editor/hooks/useChainQuotaGate";
import { useEditorBootstrap } from "@/features/valuechains/editor/hooks/useEditorBootstrap";
import { useUnsavedChangesGuard } from "@/features/valuechains/editor/hooks/useUnsavedChangesGuard";

/**
 * chain-editor Context (UC-013 plan 모듈 7, state_management.md §6~8).
 * 상태/액션 Context를 분리해 액션만 쓰는 컴포넌트가 상태 변경에 재렌더되지 않도록 한다.
 * 본 plan 구현 범위는 `mode='create' && variant='user'` 경로다.
 * `mode='edit'`·`variant='official'` 분기는 시그니처만 두고 UC-014/018/021 plan이 채운다.
 */

export interface ChainEditorMeta {
  mode: EditorMode;
  variant: EditorVariant;
}

/** 서버 캐시·mutation에서 파생되는 비동기 메타 (reducer 밖). */
export interface ChainEditorAsync {
  /** 초기 로드 중(스켈레톤) — 본 plan: 상한 게이트 조회 중(create). */
  isBootstrapping: boolean;
  /** 401/네트워크·500 — 편집 진입 보류 + 재시도. */
  bootstrapError: { kind: "auth" | "network"; retry?: () => void } | null;
  /** create·user: 소유 체인 수 >= MAX_CHAINS_PER_USER(진입 차단 + 삭제 유도). null이면 미차단. */
  entryBlocked: { ownedChainCount: number; maxChainsPerUser: number } | null;
}

export interface ChainEditorComputed {
  nodeCount: number;
  nameIssue: "NAME_REQUIRED" | null;
}

export interface ChainEditorStateValue {
  meta: ChainEditorMeta;
  state: ChainEditorState;
  computed: ChainEditorComputed;
  async: ChainEditorAsync;
}

export interface ChainEditorActions {
  changeName(name: string): void;
  changeFocusType(focusType: FocusType): void;
  setFocusSecurity(security: SecurityRef): void;
  clearFocusSecurity(): void;
}

const ChainEditorStateContext = createContext<ChainEditorStateValue | null>(null);
const ChainEditorActionsContext = createContext<ChainEditorActions | null>(null);

export interface ChainEditorProviderProps {
  mode: EditorMode;
  variant: EditorVariant;
  chainId?: string;
  children: ReactNode;
}

export function ChainEditorProvider(props: ChainEditorProviderProps) {
  const { mode, variant, children } = props;
  const [state, dispatch] = useReducer(chainEditorReducer, CHAIN_EDITOR_INITIAL_STATE);

  // create+user 경로만 게이트 활성화 — edit/official은 게이트 비적용(useChainQuotaGate 계약).
  const gateEnabled = mode === "create" && variant === "user";
  const gate = useChainQuotaGate({ enabled: gateEnabled });

  useEditorBootstrap({ mode, gate, initialized: state.initialized, dispatch });

  useUnsavedChangesGuard(state.isDirty);

  const asyncValue: ChainEditorAsync = useMemo(() => {
    if (gate.status === "checking") {
      return { isBootstrapping: true, bootstrapError: null, entryBlocked: null };
    }
    if (gate.status === "auth_required") {
      return { isBootstrapping: false, bootstrapError: { kind: "auth" }, entryBlocked: null };
    }
    if (gate.status === "error") {
      return {
        isBootstrapping: false,
        bootstrapError: { kind: "network", retry: gate.retry },
        entryBlocked: null,
      };
    }
    if (gate.status === "blocked") {
      return {
        isBootstrapping: false,
        bootstrapError: null,
        entryBlocked: {
          ownedChainCount: gate.ownedChainCount,
          maxChainsPerUser: gate.maxChainsPerUser,
        },
      };
    }
    return { isBootstrapping: false, bootstrapError: null, entryBlocked: null };
  }, [gate]);

  const computed: ChainEditorComputed = useMemo(
    () => ({
      nodeCount: selectNodeCount(state),
      nameIssue: selectNameIssue(state),
    }),
    [state],
  );

  const changeName = useCallback((name: string) => {
    dispatch({ type: "CHAIN_NAME_CHANGED", payload: { name } });
  }, []);

  const changeFocusType = useCallback((focusType: FocusType) => {
    dispatch({ type: "FOCUS_TYPE_CHANGED", payload: { focusType } });
  }, []);

  const setFocusSecurity = useCallback((security: SecurityRef) => {
    dispatch({ type: "FOCUS_SECURITY_SET", payload: { security } });
  }, []);

  const clearFocusSecurity = useCallback(() => {
    dispatch({ type: "FOCUS_SECURITY_CLEARED" });
  }, []);

  const actionsValue: ChainEditorActions = useMemo(
    () => ({ changeName, changeFocusType, setFocusSecurity, clearFocusSecurity }),
    [changeName, changeFocusType, setFocusSecurity, clearFocusSecurity],
  );

  const stateValue: ChainEditorStateValue = useMemo(
    () => ({ meta: { mode, variant }, state, computed, async: asyncValue }),
    [mode, variant, state, computed, asyncValue],
  );

  return (
    <ChainEditorStateContext.Provider value={stateValue}>
      <ChainEditorActionsContext.Provider value={actionsValue}>
        {children}
      </ChainEditorActionsContext.Provider>
    </ChainEditorStateContext.Provider>
  );
}

export function useChainEditorState(): ChainEditorStateValue {
  const value = useContext(ChainEditorStateContext);
  if (value === null) {
    throw new Error("useChainEditorState는 ChainEditorProvider 내부에서만 호출할 수 있습니다.");
  }
  return value;
}

export function useChainEditorActions(): ChainEditorActions {
  const value = useContext(ChainEditorActionsContext);
  if (value === null) {
    throw new Error("useChainEditorActions는 ChainEditorProvider 내부에서만 호출할 수 있습니다.");
  }
  return value;
}
