import type { FreeSubjectType } from "./chainEditor";
import type { SaveEdgePayload } from "../valuechains/edgeSaveValidation";

/**
 * 저장 페이로드 순수 타입 (UC-018 plan 모듈 2, spec §6.2). React/zod/Supabase 비의존 —
 * BE `schema.ts`의 zod 산출 타입이 이 인터페이스를 `satisfies`로 준수하고,
 * FE `serializeSavePayload`의 반환 타입으로도 사용한다(형상 단일 SOT).
 */

export interface SaveChainGroupPayload {
  clientGroupId: string;
  name: string;
}

export interface SaveChainNodePayload {
  clientNodeId: string;
  nodeKind: "listed_company" | "free_subject";
  securityId: string | null;
  subjectName: string | null;
  subjectType: FreeSubjectType | null;
  subjectMemo: string | null;
  groupClientId: string | null;
  positionX: number;
  positionY: number;
}

export interface SaveChainRequest {
  name: string;
  focusType: "industry" | "company";
  focusSecurityId: string | null;
  /** 신규 저장=null, 갱신 저장=필수(BR-7 낙관적 잠금). */
  baseSnapshotId: string | null;
  groups: SaveChainGroupPayload[];
  nodes: SaveChainNodePayload[];
  edges: SaveEdgePayload[];
}

export interface SaveChainResult {
  chainId: string;
  snapshotId: string;
  effectiveAt: string;
  nodeCount: number;
  edgeCount: number;
  groupCount: number;
}
