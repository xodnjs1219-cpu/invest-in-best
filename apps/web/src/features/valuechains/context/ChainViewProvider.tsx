"use client";

import { useCallback, useMemo, useReducer, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getTimelineToday, isWithinTimelineRange, type IsoDate } from "@iib/domain";
import {
  buildRenderGraph,
  selectDailyMetricsParams,
  selectQuarterlyMetricsParams,
  buildDailyMetricsView,
  buildQuarterlyMetricsView,
  buildNodePanelView,
} from "@/features/valuechains/state/chain-view.selectors";
import {
  chainViewReducer,
  createInitialChainViewState,
} from "@/features/valuechains/state/chain-view.reducer";
import { useChainStructure } from "@/features/valuechains/hooks/useChainStructure";
import { useChainDailyMetrics } from "@/features/valuechains/hooks/useChainDailyMetrics";
import { useChainQuarterlyMetrics } from "@/features/valuechains/hooks/useChainQuarterlyMetrics";
import { useChainNodeDetail } from "@/features/valuechains/hooks/useChainNodeDetail";
import { useChainTimeline } from "@/features/valuechains/hooks/useChainTimeline";
import { useChainSnapshotAt } from "@/features/valuechains/hooks/useChainSnapshotAt";
import { useTimelineUrlSync } from "@/features/valuechains/hooks/effects/useTimelineUrlSync";
import { useRestoreResultSync } from "@/features/valuechains/hooks/effects/useRestoreResultSync";
import { useNodeClickRouting } from "@/features/valuechains/hooks/effects/useNodeClickRouting";
import {
  ChainViewActionsContext,
  ChainViewStateContext,
  type ChainViewActionsValue,
  type ChainViewStateValue,
  type StructureView,
  type TimelineMetaView,
  type TimelineBadge,
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
 * UC-009(구조·캔버스) + UC-010(지표) + UC-011(노드 패널) + UC-012(타임라인) 전체를 연결한다.
 *
 * **`?at=` 배선 규칙(UC-012에서 활성화, 매우 중요)**: atParam을 초기 상태(S1)에 주입하는 것과
 * `useChainSnapshotAt` 쿼리를 활성화하는 것은 **반드시 동시에** 이루어져야 한다(부분 배선 금지).
 * UC-009 단계에서는 의도적으로 atParam을 무시(S1=null 고정)했으나, 본 구현에서 snapshot-at 쿼리
 * 배선과 함께 활성화한다 — 그래야 유효한 과거 날짜 딥링크가 무한 로딩에 빠지지 않는다.
 */
export const ChainViewProvider = ({ chainId, atParam, children }: ChainViewProviderProps) => {
  const router = useRouter();

  // `today`는 Asia/Seoul 기준(결정 C-6)으로 렌더 시 1회 계산해 주입한다(reducer 순수성 유지).
  const today = useMemo(() => getTimelineToday(), []);

  // UC-012: atParam을 초기 상태에 주입 — snapshot-at 쿼리 활성화와 동시 배선(무한 로딩 방지).
  const [state, dispatch] = useReducer(
    chainViewReducer,
    { atParam, today },
    createInitialChainViewState,
  );

  const selectedDate = state.timeline.selectedDate;

  // ── UC-009: 구조 쿼리(최신) ──
  const structureQuery = useChainStructure(chainId, { enabled: selectedDate === null });

  // ── UC-012: 타임라인 메타 + 시점 복원 쿼리 ──
  const timelineQuery = useChainTimeline(chainId);
  const snapshotAtQuery = useChainSnapshotAt(chainId, selectedDate);

  // 복원 확정 여부: S2(lastAppliedDate)가 S1(selectedDate)과 일치해야 "이 시점에 대한 복원이 끝났다"고
  // 간주한다. `useRestoreResultSync`의 dispatch가 아직 reducer에 반영되지 않은 중간 렌더에서
  // `hasRestoreConcluded`가 섣불리 true가 되면 `useTimelineUrlSync`가 stale한 lastAppliedDate로
  // URL을 되돌려 쓰는 경쟁 상태가 발생한다(최신으로 돌아가기 직후 관찰됨) — S1=S2 비교로 방지한다.
  const hasRestoreConcluded = state.timeline.lastAppliedDate === selectedDate;

  const [restoreFailureNotice, setRestoreFailureNotice] = useState<
    { kind: "snapshot-not-found" | "error" } | null
  >(null);

  const notifyRestoreFailure = useCallback((kind: "snapshot-not-found" | "error") => {
    setRestoreFailureNotice({ kind });
  }, []);

  useRestoreResultSync({
    selectedDate,
    latestQuery: structureQuery,
    snapshotAtQuery,
    dispatch,
    notifyRestoreFailure,
  });

  useTimelineUrlSync({ lastAppliedDate: state.timeline.lastAppliedDate, hasRestoreConcluded });

  // ── 활성 구조 선택: 최신 vs 시점 복원(UC-012) ──
  const structure: StructureView = useMemo(() => {
    if (selectedDate !== null) {
      // 시점 복원 흐름
      if (snapshotAtQuery.isPending && !snapshotAtQuery.data) {
        return { status: "loading" };
      }
      if (snapshotAtQuery.isError) {
        const error = snapshotAtQuery.error;
        if (error instanceof ApiError && NOT_FOUND_LIKE_STATUSES.has(error.status)) {
          return { status: "not-found" };
        }
        return { status: "error" };
      }
      if (snapshotAtQuery.data) {
        const snap = snapshotAtQuery.data.snapshot;
        return {
          status: "ready",
          data: {
            chain:
              structureQuery.data?.chain ??
              ({
                id: chainId,
                name: "",
                chainType: "official",
                focusType: "industry",
                focusSecurity: null,
                isOwner: false,
              } as const),
            snapshot: {
              id: snap.snapshotId,
              effectiveAt: snap.effectiveAt,
              changeSource: snap.changeSource,
            },
            groups: snap.groups,
            nodes: snap.nodes.map((n) => ({
              id: n.id,
              groupId: n.groupId,
              nodeKind: n.nodeKind,
              security: n.security
                ? {
                    id: n.security.securityId,
                    ticker: n.security.ticker,
                    name: n.security.name,
                    market: n.security.market,
                    listingStatus: n.security.listingStatus,
                  }
                : null,
              subjectName: n.subjectName,
              subjectType: n.subjectType,
              subjectMemo: n.subjectMemo,
              position: n.positionX !== null && n.positionY !== null ? { x: n.positionX, y: n.positionY } : null,
            })),
            edges: snap.edges,
            dataFreshness: structureQuery.data?.dataFreshness ?? {
              sources: [],
              lastCollectedAt: { quotes: null, financials: null, fxAndMarketHours: null },
            },
          },
          snapshotEffectiveAt: snap.effectiveAt,
          isRestoring: snapshotAtQuery.isFetching,
        };
      }
      return { status: "loading" };
    }

    // 최신 구조 흐름(UC-009)
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
  }, [
    selectedDate,
    snapshotAtQuery.isPending,
    snapshotAtQuery.isError,
    snapshotAtQuery.error,
    snapshotAtQuery.data,
    snapshotAtQuery.isFetching,
    structureQuery.isPending,
    structureQuery.isError,
    structureQuery.error,
    structureQuery.data,
    chainId,
  ]);

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

  // ── UC-010: 대시보드 지표 ──
  const dailyParams = useMemo(
    () => ({ ...selectDailyMetricsParams(state.dashboard.range, today), at: selectedDate }),
    [state.dashboard.range, today, selectedDate],
  );
  const quarterlyParams = useMemo(
    () => ({ ...selectQuarterlyMetricsParams(state.dashboard.range, today), at: selectedDate }),
    [state.dashboard.range, today, selectedDate],
  );
  const dailyMetricsQuery = useChainDailyMetrics(chainId, dailyParams);
  const quarterlyMetricsQuery = useChainQuarterlyMetrics(chainId, quarterlyParams);

  const dailyMetrics = useMemo(
    () =>
      buildDailyMetricsView({
        query: {
          status: dailyMetricsQuery.isPending ? "pending" : dailyMetricsQuery.isError ? "error" : "success",
          data: dailyMetricsQuery.data,
        },
        highlightedDate: selectedDate,
      }),
    [dailyMetricsQuery.isPending, dailyMetricsQuery.isError, dailyMetricsQuery.data, selectedDate],
  );
  const quarterlyMetrics = useMemo(
    () =>
      buildQuarterlyMetricsView({
        query: {
          status: quarterlyMetricsQuery.isPending
            ? "pending"
            : quarterlyMetricsQuery.isError
              ? "error"
              : "success",
          data: quarterlyMetricsQuery.data,
        },
        highlightedDate: selectedDate,
      }),
    [quarterlyMetricsQuery.isPending, quarterlyMetricsQuery.isError, quarterlyMetricsQuery.data, selectedDate],
  );

  // ── UC-011: 노드 정보 패널 ──
  const selectedNodeId = state.nodePanel.selectedNodeId;
  const nodeDetailQuery = useChainNodeDetail(chainId, selectedNodeId);

  const nodePanel = useMemo(
    () =>
      buildNodePanelView({
        selectedNodeId,
        query: {
          status: nodeDetailQuery.isPending ? "pending" : nodeDetailQuery.isError ? "error" : "success",
          data: nodeDetailQuery.data,
        },
      }),
    [selectedNodeId, nodeDetailQuery.isPending, nodeDetailQuery.isError, nodeDetailQuery.data],
  );

  useNodeClickRouting({
    selectedNodeId,
    nodeDetailQuery,
    selectedDate,
    dispatch,
    router,
  });

  // ── UC-012: 타임라인 메타 + 배지 ──
  const timelineMeta: TimelineMetaView = useMemo(() => {
    if (timelineQuery.isPending) {
      return { status: "loading" };
    }
    if (timelineQuery.isError) {
      return { status: "error" };
    }
    if (timelineQuery.data) {
      return {
        status: "ready",
        range: timelineQuery.data.range as { minDate: IsoDate; maxDate: IsoDate },
        markers: timelineQuery.data.markers,
      };
    }
    return { status: "loading" };
  }, [timelineQuery.isPending, timelineQuery.isError, timelineQuery.data]);

  const timelineBadge: TimelineBadge | null = useMemo(() => {
    if (selectedDate === null || structure.status !== "ready") {
      return null;
    }
    return { selectedDate, snapshotEffectiveAt: structure.snapshotEffectiveAt };
  }, [selectedDate, structure]);

  // ── Actions ──
  const commitNodeDrag = useCallback((nodeId: string, position: { x: number; y: number }) => {
    dispatch({ type: "NODE_DRAG_ENDED", payload: { nodeId, position } });
  }, []);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    dispatch({ type: "GROUP_COLLAPSE_TOGGLED", payload: { groupId } });
  }, []);

  const retryStructure = useCallback(() => {
    void structureQuery.refetch();
  }, [structureQuery]);

  const changeDashboardRange = useCallback((range: (typeof state)["dashboard"]["range"]) => {
    dispatch({ type: "DASHBOARD_RANGE_CHANGED", payload: { range } });
  }, []);

  const retryDailyMetrics = useCallback(() => {
    void dailyMetricsQuery.refetch();
  }, [dailyMetricsQuery]);

  const retryQuarterlyMetrics = useCallback(() => {
    void quarterlyMetricsQuery.refetch();
  }, [quarterlyMetricsQuery]);

  const selectNode = useCallback((nodeId: string) => {
    dispatch({ type: "NODE_SELECTED", payload: { nodeId } });
  }, []);

  const closeNodePanel = useCallback(() => {
    dispatch({ type: "NODE_PANEL_CLOSED" });
  }, []);

  const retryNodeDetail = useCallback(() => {
    void nodeDetailQuery.refetch();
  }, [nodeDetailQuery]);

  const selectTimelineDate = useCallback(
    (date: (typeof state)["timeline"]["selectedDate"]) => {
      if (date === null) {
        return;
      }
      if (!isWithinTimelineRange(date, today)) {
        return; // 무효 선택은 무시(1차 검증, spec step 3)
      }
      dispatch({ type: "TIMELINE_DATE_SELECTED", payload: { date } });
    },
    [today],
  );

  const returnToLatest = useCallback(() => {
    dispatch({ type: "TIMELINE_RETURNED_TO_LATEST" });
  }, []);

  const clearRestoreFailureNotice = useCallback(() => {
    setRestoreFailureNotice(null);
  }, []);

  const stateValue: ChainViewStateValue = useMemo(
    () => ({
      chainId,
      selectedDate,
      selectedNodeId,
      dashboardRange: state.dashboard.range,
      localNodePositions: state.canvas.localNodePositions,
      collapsedGroupIds: state.canvas.collapsedGroupIds,
      isTimeTraveling: selectedDate !== null,
      structure,
      renderGraph,
      dataFreshness,
      isOwner,
      dailyMetrics,
      quarterlyMetrics,
      nodePanel,
      timelineMeta,
      timelineBadge,
      restoreFailureNotice,
    }),
    [
      chainId,
      selectedDate,
      selectedNodeId,
      state.dashboard.range,
      state.canvas.localNodePositions,
      state.canvas.collapsedGroupIds,
      structure,
      renderGraph,
      dataFreshness,
      isOwner,
      dailyMetrics,
      quarterlyMetrics,
      nodePanel,
      timelineMeta,
      timelineBadge,
      restoreFailureNotice,
    ],
  );

  // 참조 안정 — dispatch·refetch·router만 의존하므로 상태 변경에 리렌더되지 않는다(§8.3).
  const actionsValue: ChainViewActionsValue = useMemo(
    () => ({
      commitNodeDrag,
      toggleGroupCollapse,
      retryStructure,
      changeDashboardRange,
      retryDailyMetrics,
      retryQuarterlyMetrics,
      selectNode,
      closeNodePanel,
      retryNodeDetail,
      selectTimelineDate,
      returnToLatest,
      clearRestoreFailureNotice,
    }),
    [
      commitNodeDrag,
      toggleGroupCollapse,
      retryStructure,
      changeDashboardRange,
      retryDailyMetrics,
      retryQuarterlyMetrics,
      selectNode,
      closeNodePanel,
      retryNodeDetail,
      selectTimelineDate,
      returnToLatest,
      clearRestoreFailureNotice,
    ],
  );

  return (
    <ChainViewStateContext.Provider value={stateValue}>
      <ChainViewActionsContext.Provider value={actionsValue}>
        {children}
      </ChainViewActionsContext.Provider>
    </ChainViewStateContext.Provider>
  );
};
