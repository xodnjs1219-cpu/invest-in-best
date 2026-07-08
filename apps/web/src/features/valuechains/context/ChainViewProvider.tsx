"use client";

import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import { getTimelineToday } from "@iib/domain";
import { buildRenderGraph } from "@/features/valuechains/state/chain-view.selectors";
import {
  chainViewReducer,
  createInitialChainViewState,
} from "@/features/valuechains/state/chain-view.reducer";
import { useChainStructure } from "@/features/valuechains/hooks/useChainStructure";
import {
  ChainViewActionsContext,
  ChainViewStateContext,
  type ChainViewActionsValue,
  type ChainViewStateValue,
  type StructureView,
} from "@/features/valuechains/context/chain-view-context";
import { ApiError } from "@/lib/http/api-client";

export interface ChainViewProviderProps {
  chainId: string;
  /** Server Component가 해석한 searchParams.at 원본. */
  atParam: string | null;
  children: ReactNode;
}

const NOT_FOUND_LIKE_STATUSES = new Set([400, 401, 403, 404]);

/**
 * chain-view 페이지 Provider (plan 모듈 C5) — Store·쿼리·computed를 조립하는 Container.
 * UC-009 범위(구조·캔버스)만 연결한다. UC-010~012 확장 포인트는 아래 주석 참고.
 *
 * **`?at=` 배선 규칙(UC-009 단계 확정, 매우 중요)**: atParam을 초기 상태에 주입하지 **않는다**.
 * `useReducer(chainViewReducer, { atParam: null, today }, createInitialChainViewState)`로 S1을
 * 항상 `null`에서 시작한다. UC-009에는 시점 복원 쿼리(snapshot-at)가 없으므로, atParam을 그대로
 * 주입하면 유효한 과거 날짜 딥링크(예: `?at=2026-05-02`)에서 S1≠null이 되어 구조 쿼리가 영구
 * 비활성(`enabled=false`)되고 무한 로딩에 빠진다(C5/C7 모순, plan 선검증에서 발견됨).
 * atParam→parseAtParam→S1 주입 복원은 UC-012 plan(모듈 12·16)이 snapshot-at 쿼리 배선과
 * **반드시 동일 변경으로** 수행한다(부분 배선 금지).
 */
export const ChainViewProvider = ({ chainId, children }: ChainViewProviderProps) => {
  // `today`는 Asia/Seoul 기준(결정 C-6)으로 렌더 시 1회 계산해 주입한다(reducer 순수성 유지).
  const today = useMemo(() => getTimelineToday(), []);

  // UC-009 배선 규칙: atParam은 초기 상태에 주입하지 않는다(S1 항상 null로 시작).
  const [state, dispatch] = useReducer(
    chainViewReducer,
    { atParam: null, today },
    createInitialChainViewState,
  );

  const structureQuery = useChainStructure(chainId, {
    enabled: state.timeline.selectedDate === null,
  });

  const structure: StructureView = useMemo(() => {
    if (structureQuery.isPending) {
      return { status: "loading" };
    }
    if (structureQuery.isError) {
      const error = structureQuery.error;
      if (error instanceof ApiError && NOT_FOUND_LIKE_STATUSES.has(error.status)) {
        return { status: "not-found" };
      }
      return { status: "error" };
    }
    if (structureQuery.data) {
      return {
        status: "ready",
        data: structureQuery.data,
        snapshotEffectiveAt: structureQuery.data.snapshot.effectiveAt,
        isRestoring: false,
      };
    }
    return { status: "loading" };
  }, [structureQuery.isPending, structureQuery.isError, structureQuery.error, structureQuery.data]);

  const renderGraph = useMemo(() => {
    if (structure.status !== "ready") {
      return null;
    }
    return buildRenderGraph({
      structure: structure.data,
      localPositions: state.canvas.localNodePositions,
      collapsedGroupIds: state.canvas.collapsedGroupIds,
    });
  }, [structure, state.canvas.localNodePositions, state.canvas.collapsedGroupIds]);

  const dataFreshness = structure.status === "ready" ? structure.data.dataFreshness : null;
  const isOwner = structure.status === "ready" ? structure.data.chain.isOwner : false;

  const commitNodeDrag = useCallback((nodeId: string, position: { x: number; y: number }) => {
    dispatch({ type: "NODE_DRAG_ENDED", payload: { nodeId, position } });
  }, []);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    dispatch({ type: "GROUP_COLLAPSE_TOGGLED", payload: { groupId } });
  }, []);

  const retryStructure = useCallback(() => {
    void structureQuery.refetch();
  }, [structureQuery]);

  const stateValue: ChainViewStateValue = useMemo(
    () => ({
      chainId,
      selectedDate: state.timeline.selectedDate,
      localNodePositions: state.canvas.localNodePositions,
      collapsedGroupIds: state.canvas.collapsedGroupIds,
      isTimeTraveling: state.timeline.selectedDate !== null,
      structure,
      renderGraph,
      dataFreshness,
      isOwner,
    }),
    [
      chainId,
      state.timeline.selectedDate,
      state.canvas.localNodePositions,
      state.canvas.collapsedGroupIds,
      structure,
      renderGraph,
      dataFreshness,
      isOwner,
    ],
  );

  // 참조 안정 — dispatch·refetch만 의존하므로 상태 변경에 리렌더되지 않는다(§8.3).
  const actionsValue: ChainViewActionsValue = useMemo(
    () => ({ commitNodeDrag, toggleGroupCollapse, retryStructure }),
    [commitNodeDrag, toggleGroupCollapse, retryStructure],
  );

  // 확장 포인트: 나머지 쿼리 5종(snapshot-at/timeline/daily/quarterly/nodeDetail)·이펙트 3종·
  // computed(timelineMeta/timelineBadge/dailyMetrics/quarterlyMetrics/nodePanel)는
  // UC-010(지표)·UC-011(노드 패널)·UC-012(타임라인) plan이 이 파일에 추가한다.

  return (
    <ChainViewStateContext.Provider value={stateValue}>
      <ChainViewActionsContext.Provider value={actionsValue}>
        {children}
      </ChainViewActionsContext.Provider>
    </ChainViewStateContext.Provider>
  );
};
