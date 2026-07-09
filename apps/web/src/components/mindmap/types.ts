import type { NodePosition } from "@iib/domain";

/**
 * 마인드맵 렌더 모델 단일 정의 (plan 모듈 A8) — 뷰(UC-009~012)와 편집(UC-015~018) 공용.
 * React Flow 데이터로 변환되기 직전의 프레임워크 독립 표현.
 */

export type ListingStatus = "listed" | "suspended" | "delisted";
export type SubjectType = "consumer" | "government" | "private_company" | "other";
export type MarketCode = "KRX" | "US";

/** 뷰어 마인드맵 노드 표시 모양 — 카드형(box, 기본) 또는 옵시디언식 원형(circle). */
export type NodeShape = "box" | "circle";

export type RenderNode = {
  id: string;
  kind: "listed_company" | "free_subject";
  label: string;
  sublabel?: string;
  market?: MarketCode;
  listingStatus?: ListingStatus;
  subjectType?: SubjectType;
  groupId: string | null;
  position: NodePosition;
};

export type RenderEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  isDirected: boolean;
  isActive: boolean;
};

export type RenderGroup = {
  id: string;
  label: string;
  isCollapsed: boolean;
  memberCount: number;
};

export type RenderGraph = {
  nodes: RenderNode[];
  edges: RenderEdge[];
  groups: RenderGroup[];
};
