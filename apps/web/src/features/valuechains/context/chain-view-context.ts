"use client";

import { createContext, useContext } from "react";
import type { IsoDate, NodePosition } from "@iib/domain";
import type { RenderGraph } from "@/components/mindmap/types";
import type { DataFreshness } from "@/features/valuechains/lib/dto";

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

export interface ChainViewStateValue {
  chainId: string;

  // reducer 원천 상태 (S1~S6 — S2는 내부용이라 비노출)
  selectedDate: IsoDate | null; // S1
  localNodePositions: Readonly<Record<string, NodePosition>>; // S5
  collapsedGroupIds: readonly string[]; // S6

  // computed (상태 + 서버 캐시 파생)
  isTimeTraveling: boolean;
  structure: StructureView;
  renderGraph: RenderGraph | null; // structure ready일 때만
  dataFreshness: DataFreshness | null;
  isOwner: boolean;
}

export interface ChainViewActionsValue {
  /** React Flow onNodeDragStop에서 호출 — 로컬 표시용, 서버 저장 없음(BR-3). */
  commitNodeDrag(nodeId: string, position: NodePosition): void;
  toggleGroupCollapse(groupId: string): void;
  /** 서버 상태 재시도(refetch 래퍼 — Action 아님). */
  retryStructure(): void;
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
