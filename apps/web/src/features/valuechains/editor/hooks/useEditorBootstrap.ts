"use client";

import { useEffect, useRef, type Dispatch } from "react";
import type { EditorMode } from "@iib/domain";
import type { ChainEditorAction, EditorBootstrap } from "@/features/valuechains/editor/state/chainEditorReducer";
import type { ChainQuotaGate } from "@/features/valuechains/editor/hooks/useChainQuotaGate";
import { toEditorBootstrap } from "@/features/valuechains/editor/lib/toEditorBootstrap";
import type { LatestSnapshotResponse } from "@/features/valuechains/lib/dto";

/**
 * 편집기 부트스트랩 이펙트 (UC-013 plan 모듈 11, UC-018 plan 모듈 16 edit 분기 확장).
 * create 경로: 게이트 통과 시 빈 문서로 EDITOR_INITIALIZED를 1회 dispatch한다.
 * edit 경로: `latestSnapshot` 쿼리가 성공하면 `toEditorBootstrap`으로 변환 후 1회 dispatch한다.
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

/** edit 모드가 소비하는 최신 구성 쿼리 상태 최소 인터페이스(TanStack Query 결과와 구조적으로 호환). */
export interface LatestSnapshotQueryState {
  status: string;
  data?: LatestSnapshotResponse;
}

export interface UseEditorBootstrapParams {
  mode: EditorMode;
  gate: ChainQuotaGate;
  initialized: boolean;
  dispatch: Dispatch<ChainEditorAction>;
  /** edit 모드 전용 — `useLatestSnapshot(chainId)`의 쿼리 결과(UC-016 M16). create 모드는 전달 불필요. */
  latestSnapshot?: LatestSnapshotQueryState;
}

export function useEditorBootstrap(params: UseEditorBootstrapParams): void {
  const { mode, gate, initialized, dispatch, latestSnapshot } = params;
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
      return;
    }
    if (mode === "edit" && latestSnapshot?.status === "success" && latestSnapshot.data) {
      hasDispatchedRef.current = true;
      dispatch({ type: "EDITOR_INITIALIZED", payload: toEditorBootstrap(latestSnapshot.data) });
    }
    // 실패(401/403/404/500)는 dispatch 없이 Provider `bootstrapError` 파생이 처리한다(호출측 책임).
  }, [mode, gate, initialized, dispatch, latestSnapshot]);
}
