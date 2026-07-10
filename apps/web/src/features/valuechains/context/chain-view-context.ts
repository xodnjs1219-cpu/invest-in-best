"use client";

import { createContext, useContext } from "react";
import type { IsoDate, NodePosition } from "@iib/domain";
import type { RenderGraph } from "@/components/mindmap/types";
import type {
  DailyAnnotations,
  DailyMetricCurrent,
  DailyMetricPoint,
  DataFreshness,
  QuarterlyAnnotations,
  QuarterlyMetricCurrent,
  QuarterlyMetricPoint,
} from "@/features/valuechains/lib/dto";
import type { MetricsRange } from "@/features/valuechains/state/chain-view.reducer";

/**
 * chain-view 페이지 Context 계약 (state_management.md §8.2, plan 모듈 C5).
 * UC-009 범위(구조·캔버스)만 정의한다 — UC-010(지표)·UC-011(노드 패널)·UC-012(타임라인) plan이
 * 아래 타입에 필드를 확장한다(기존 필드 변경 금지).
 */

/** 활성 구조(최신) 뷰모델 — 판별 유니온으로 로딩/오류/폴백을 렌더 분기로 강제한다. */
export type StructureView =
  | { status: "loading" } // 초회 로딩(표시할 직전 구조 없음)
  | { status: "not-found" } // 404 + 방어적 401/403 → "체인 없음" 폴백(C-2)
  | { status: "error" } // 500 등 → 캔버스 영역 오류 폴백 + 재시도
  | {
      status: "ready";
      data: import("@/features/valuechains/lib/dto").ChainViewResponse;
      snapshotEffectiveAt: string;
      isRestoring: boolean; // UC-012에서 시점 전환 시 true로 확장(UC-009는 항상 false)
    };

// ── UC-010: 지표 패널 뷰모델 ──

/** 지표 패널 뷰모델 — 시세 폴백 표시의 단일 계약(state_management.md §8.2). */
export type MetricsPanelView<TCurrent, TPoint, TAnnotations> =
  | { status: "loading" }
  | { status: "error" } // 지표 패널만 오류 폴백 + 재시도
  | { status: "empty" } // 빈 시계열 — "집계 준비 중"(0과 구분, UC-010 E12)
  | {
      status: "ready";
      current: TCurrent | null; // null = 미산출/"미제공"(0과 구분 — C-8)
      series: readonly TPoint[]; // 거래일만(isCarriedForward 플래그 포함)
      highlightedDate: IsoDate | null; // C-7: 전체 추이 유지 + 선택 시점 하이라이트
      annotations: TAnnotations;
    };

export type DailyMetricsView = MetricsPanelView<DailyMetricCurrent, DailyMetricPoint, DailyAnnotations>;
export type QuarterlyMetricsView = MetricsPanelView<
  QuarterlyMetricCurrent,
  QuarterlyMetricPoint,
  QuarterlyAnnotations
>;

// ── UC-011: 노드 정보 패널 뷰모델 ──

export type NodePanelView =
  | { status: "closed" }
  | { status: "loading"; nodeId: string }
  | { status: "error"; nodeId: string } // 패널 영역만 폴백 + 재시도(E9)
  | {
      status: "free-subject";
      data: {
        name: string | null;
        subjectType: "consumer" | "government" | "private_company" | "other" | null;
        memo: string | null;
        groupName: string | null;
      };
    }
  | { status: "security-fallback"; nodeId: string } // securityResolved=false — 이동 불가 안내(E1)
  | { status: "routing" }; // 상장기업 해석 성공 — 라우팅 이펙트 처리 중(과도 상태)

// ── UC-012: 타임라인 뷰모델 ──

export interface SnapshotMarkerView {
  snapshotId: string;
  effectiveAt: string;
  changeSource: "user_save" | "admin_edit" | "llm_approval";
}

export type TimelineMetaView =
  | { status: "loading" }
  | { status: "error" } // 타임라인 영역만 폴백(구조·지표와 독립)
  | {
      status: "ready";
      range: { minDate: IsoDate; maxDate: IsoDate }; // 2015-01-01 ~ 오늘(C-6)
      markers: readonly SnapshotMarkerView[];
    };

/** 시점 조회 중 배지 — null = 최신 조회(배지 없음). */
export interface TimelineBadge {
  selectedDate: IsoDate;
  snapshotEffectiveAt: string;
}

export interface ChainViewStateValue {
  chainId: string;

  // reducer 원천 상태 (S1~S6 — S2는 내부용이라 비노출)
  selectedDate: IsoDate | null; // S1
  selectedNodeId: string | null; // S3
  dashboardRange: MetricsRange; // S4
  localNodePositions: Readonly<Record<string, NodePosition>>; // S5

  // computed (상태 + 서버 캐시 파생)
  isTimeTraveling: boolean;
  structure: StructureView;
  renderGraph: RenderGraph | null; // structure ready일 때만
  dataFreshness: DataFreshness | null;
  isOwner: boolean;

  // UC-010: 대시보드 지표
  dailyMetrics: DailyMetricsView;
  quarterlyMetrics: QuarterlyMetricsView;

  // UC-011: 노드 정보 패널
  nodePanel: NodePanelView;

  // UC-012: 타임라인
  timelineMeta: TimelineMetaView;
  timelineBadge: TimelineBadge | null;
  /** 최근 시점 복원 실패 안내(일회성 UI) — 표시 후 소비측이 `clearRestoreFailureNotice()`로 지운다. */
  restoreFailureNotice: { kind: "snapshot-not-found" | "error" } | null;
}

export interface ChainViewActionsValue {
  /** React Flow onNodeDragStop에서 호출 — 로컬 표시용, 서버 저장 없음(BR-3). */
  commitNodeDrag(nodeId: string, position: NodePosition): void;
  /** 서버 상태 재시도(refetch 래퍼 — Action 아님). */
  retryStructure(): void;

  // UC-010
  changeDashboardRange(range: MetricsRange): void;
  retryDailyMetrics(): void;
  retryQuarterlyMetrics(): void;

  // UC-011
  selectNode(nodeId: string): void;
  closeNodePanel(): void;
  retryNodeDetail(): void;

  // UC-012
  /** 시점 선택 — dispatch 전에 [minDate, today] 범위 검증, 무효 선택은 무시(행동 F.1). */
  selectTimelineDate(date: IsoDate): void;
  /** 최신으로 복귀 — ?at= 제거는 URL 동기화 이펙트가 수행(행동 G). */
  returnToLatest(): void;
  /** 시점 복원 실패 안내를 닫는다(일회성 UI 소비 완료 표시). */
  clearRestoreFailureNotice(): void;
}

export const ChainViewStateContext = createContext<ChainViewStateValue | null>(null);
export const ChainViewActionsContext = createContext<ChainViewActionsValue | null>(null);

/** Provider 외부에서 호출 시 명시적 Error를 throw한다. */
export const useChainViewState = (): ChainViewStateValue => {
  const value = useContext(ChainViewStateContext);
  if (value === null) {
    throw new Error("useChainViewState는 ChainViewProvider 내부에서만 호출할 수 있습니다.");
  }
  return value;
};

export const useChainViewActions = (): ChainViewActionsValue => {
  const value = useContext(ChainViewActionsContext);
  if (value === null) {
    throw new Error("useChainViewActions는 ChainViewProvider 내부에서만 호출할 수 있습니다.");
  }
  return value;
};
