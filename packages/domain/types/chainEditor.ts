/**
 * chain-editor 도메인 모델 (UC-013 plan 모듈 3, state_management.md §2.1).
 * React·Supabase 비의존 순수 타입 — web(reducer/selectors/validation)과 worker가 공유할 수 있다.
 * 본 파일은 UC-013(신규 생성)이 최초 정의하며 UC-014~018·021이 동일 심볼을 확장 소비한다.
 * (타입 재정의 금지 — 필드 추가가 필요하면 이 파일에 append)
 */

export type EditorMode = "create" | "edit";
export type EditorVariant = "user" | "official"; // official = UC-021 어드민 재사용
export type FocusType = "industry" | "company";
export type FreeSubjectType = "consumer" | "government" | "private_company" | "other";

export interface XYPosition {
  x: number;
  y: number;
}

/** 표시용 정보를 포함한 종목 참조 (focusSecurity·상장기업 노드 공용). */
export interface SecurityRef {
  securityId: string;
  ticker: string;
  name: string;
  market: "KRX" | "US";
}

interface EditorNodeBase {
  /** 편집 세션 내 식별자 — 엣지/그룹 참조·저장 페이로드 공용(UC-015 §6.2). */
  clientNodeId: string;
  /** 소속 그룹(0..1) — 소속의 단일 소스(그룹 쪽에 중복 보관 금지, S9). */
  groupClientId: string | null;
  /** 최종 좌표(영속 대상, UC-018 BR-9). */
  position: XYPosition;
}

export interface ListedCompanyNode extends EditorNodeBase {
  nodeKind: "listed_company";
  security: SecurityRef;
}

export interface FreeSubjectNode extends EditorNodeBase {
  nodeKind: "free_subject";
  subjectType: FreeSubjectType;
  subjectName: string; // 필수
  subjectMemo: string | null;
}

export type EditorNode = ListedCompanyNode | FreeSubjectNode;

export interface EditorEdge {
  clientEdgeId: string;
  sourceClientNodeId: string;
  targetClientNodeId: string;
  relationTypeId: string;
}

export interface EditorGroup {
  clientGroupId: string;
  /** 필수(공백 불가) — 소속 노드 목록은 파생(노드 역인덱스). */
  name: string;
}

export interface EditorSelection {
  nodeIds: string[];
  edgeIds: string[];
}

/** 저장 422/409 응답의 error.details를 캔버스 하이라이트용으로 정규화한 것 (S12). */
export interface ServerIssue {
  /** 예: 'VALUECHAINS.INVALID_EDGE', 'VALUECHAINS.DUPLICATE_NAME'. */
  code: string;
  message: string;
  targets: {
    clientNodeIds?: string[];
    clientEdgeIds?: string[];
    clientGroupIds?: string[];
    /** 409 DUPLICATE_NAME → 이름 필드 오류. */
    field?: "name";
  };
}

/** 관계 종류 마스터 행 (TanStack Query 캐시 소유 — reducer에 두지 않음). */
export interface RelationType {
  id: string;
  name: string;
  isDirected: boolean;
  isActive: boolean;
}
