"use client";

import { useEffect, useRef, type Dispatch } from "react";
import type { EditorMode } from "@iib/domain";
import type { ChainEditorAction, EditorBootstrap } from "@/features/valuechains/editor/state/chainEditorReducer";
import type { ChainQuotaGate } from "@/features/valuechains/editor/hooks/useChainQuotaGate";

/**
 * 편집기 부트스트랩 이펙트 (UC-013 plan 모듈 11).
 * create 경로: 게이트 통과 시 빈 문서로 EDITOR_INITIALIZED를 1회 dispatch한다.
 * edit 경로(스냅샷 로드·toEditorBootstrap 변환)는 본 plan에서 미구현 — UC-014/018 plan이 확장한다.
 */

/** create 모드 초기 편집 상태 팩토리 — 테스트·UC-014(edit fallback) 재사용 가능. */
export function createEmptyBootstrap(): EditorBootstrap {
  return {
    chainId: null,
    baseSnapshotId: null,
    name: "",
    focusType: "industry",
    focusSecurity: null,
    nodes: {},
    edges: {},
    groups: {},
  };
}

export interface UseEditorBootstrapParams {
  mode: EditorMode;
  gate: ChainQuotaGate;
  initialized: boolean;
  dispatch: Dispatch<ChainEditorAction>;
}

export function useEditorBootstrap(params: UseEditorBootstrapParams): void {
  const { mode, gate, initialized, dispatch } = params;
  // StrictMode 이중 실행/재렌더 안전망 — 동일 세션에서 1회만 dispatch(멱등 가드 이중화).
  const hasDispatchedRef = useRef(false);

  useEffect(() => {
    if (initialized) {
      hasDispatchedRef.current = true;
      return;
    }
    if (hasDispatchedRef.current) {
      return;
    }
    if (mode === "create" && gate.status === "allowed") {
      hasDispatchedRef.current = true;
      dispatch({ type: "EDITOR_INITIALIZED", payload: createEmptyBootstrap() });
    }
    // edit 경로는 UC-014/018 plan이 이 이펙트를 확장한다(스냅샷 로드 성공 시 dispatch).
  }, [mode, gate, initialized, dispatch]);
}
