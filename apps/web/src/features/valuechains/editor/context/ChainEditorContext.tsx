"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type {
  EditorMode,
  EditorVariant,
  FocusType,
  FreeSubjectType,
  RelationType,
  SecurityRef,
} from "@iib/domain";
import {
  validateEdgeCandidate,
  validateFreeSubjectAdd,
  validateListedNodeAdd,
  type EdgeBlockReason,
  type NodeBlockReason,
} from "@iib/domain";
import {
  CHAIN_EDITOR_INITIAL_STATE,
  chainEditorReducer,
  type ChainEditorState,
} from "@/features/valuechains/editor/state/chainEditorReducer";
import {
  selectIsNearNodeLimit,
  selectNameIssue,
  selectNodeCount,
  selectRemainingNodeCapacity,
} from "@/features/valuechains/editor/state/chainEditorSelectors";
import { useChainQuotaGate } from "@/features/valuechains/editor/hooks/useChainQuotaGate";
import { useEditorBootstrap } from "@/features/valuechains/editor/hooks/useEditorBootstrap";
import { useRelationTypes } from "@/features/valuechains/editor/hooks/useRelationTypes";
import { useUnsavedChangesGuard } from "@/features/valuechains/editor/hooks/useUnsavedChangesGuard";
import { getDefaultNodePosition } from "@/features/valuechains/editor/lib/nodePlacement";

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
  /** UC-015 — 잔여 노드 추가 가능 수(음수 방어). */
  remainingNodeCapacity: number;
  /** UC-015 — 노드 상한 근접 여부(잔여 수 안내 배지 트리거). */
  isNearNodeLimit: boolean;
  /** UC-016 — 관계 종류 마스터 id→RelationType 캐시(전체, 비활성 포함 — 라벨 렌더링용). */
  relationTypeById: ReadonlyMap<string, RelationType>;
  /** UC-016 — 신규 선택 목록(활성만, BR-4). */
  activeRelationTypes: RelationType[];
  /** UC-016 — 활성 관계 종류 0개 게이트(E6). */
  hasActiveRelationTypes: boolean;
}

export interface ChainEditorStateValue {
  meta: ChainEditorMeta;
  state: ChainEditorState;
  computed: ChainEditorComputed;
  async: ChainEditorAsync;
}

/** 노드/엣지 액션 공용 결과 타입 — 실패 시 dispatch 없이 사유만 반환한다. */
export type ActionResult<TReason extends string> = { ok: true } | { ok: false; reason: TReason };

export interface ChainEditorActions {
  changeName(name: string): void;
  changeFocusType(focusType: FocusType): void;
  setFocusSecurity(security: SecurityRef): void;
  clearFocusSecurity(): void;
  /** UC-015 — 상장기업 노드 추가. 검증 실패 시 dispatch 없이 사유 반환. */
  addListedCompanyNode(security: SecurityRef): ActionResult<NodeBlockReason>;
  /** UC-015 — 자유 주체 노드 추가. */
  addFreeSubjectNode(input: {
    subjectType: FreeSubjectType | null;
    subjectName: string;
    subjectMemo: string | null;
  }): ActionResult<NodeBlockReason>;
  /** UC-015 — 노드 이동(좌표 갱신). */
  moveNode(clientNodeId: string, position: { x: number; y: number }): void;
  /** UC-015/016 — 노드·엣지 일괄 삭제(연결 엣지 연쇄 제거는 리듀서 책임). */
  deleteElements(target: { nodeIds: string[]; edgeIds: string[] }): void;
  /** UC-016 — 신규 엣지 연결. 검증 실패 시 dispatch 없이 사유 반환. */
  addEdge(input: {
    sourceClientNodeId: string;
    targetClientNodeId: string;
    relationTypeId: string;
  }): ActionResult<EdgeBlockReason>;
  /** UC-016 — 기존 엣지의 관계 종류 변경(자기 자신 제외 재검증). */
  changeEdgeRelation(clientEdgeId: string, relationTypeId: string): ActionResult<EdgeBlockReason>;
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

  const relationTypesQuery = useRelationTypes();
  const relationTypeById = useMemo(() => {
    const map = new Map<string, RelationType>();
    for (const rt of relationTypesQuery.data ?? []) {
      map.set(rt.id, rt);
    }
    return map;
  }, [relationTypesQuery.data]);
  const activeRelationTypes = useMemo(
    () => (relationTypesQuery.data ?? []).filter((rt) => rt.isActive),
    [relationTypesQuery.data],
  );

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
      remainingNodeCapacity: selectRemainingNodeCapacity(state),
      isNearNodeLimit: selectIsNearNodeLimit(state),
      relationTypeById,
      activeRelationTypes,
      hasActiveRelationTypes: activeRelationTypes.length > 0,
    }),
    [state, relationTypeById, activeRelationTypes],
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

  // ── UC-015: 노드 추가/삭제 액션 ──────────────────────────────────

  const addListedCompanyNode = useCallback(
    (security: SecurityRef): ActionResult<NodeBlockReason> => {
      const reason = validateListedNodeAdd({ nodes: state.nodes }, security.securityId);
      if (reason) {
        return { ok: false, reason };
      }
      const clientNodeId = crypto.randomUUID();
      const position = getDefaultNodePosition(selectNodeCount(state));
      dispatch({ type: "LISTED_NODE_ADDED", payload: { clientNodeId, security, position } });
      return { ok: true };
    },
    [state],
  );

  const addFreeSubjectNode = useCallback(
    (input: {
      subjectType: FreeSubjectType | null;
      subjectName: string;
      subjectMemo: string | null;
    }): ActionResult<NodeBlockReason> => {
      const trimmedName = input.subjectName.trim();
      const reason = validateFreeSubjectAdd(
        { nodes: state.nodes },
        { subjectType: input.subjectType, subjectName: trimmedName },
      );
      if (reason) {
        return { ok: false, reason };
      }
      const clientNodeId = crypto.randomUUID();
      const position = getDefaultNodePosition(selectNodeCount(state));
      const subjectMemo = input.subjectMemo && input.subjectMemo.trim().length > 0 ? input.subjectMemo : null;
      dispatch({
        type: "FREE_SUBJECT_NODE_ADDED",
        payload: {
          clientNodeId,
          // validateFreeSubjectAdd 통과 시 subjectType은 항상 non-null.
          subjectType: input.subjectType as FreeSubjectType,
          subjectName: trimmedName,
          subjectMemo,
          position,
        },
      });
      return { ok: true };
    },
    [state],
  );

  const moveNode = useCallback((clientNodeId: string, position: { x: number; y: number }) => {
    dispatch({ type: "NODE_MOVED", payload: { clientNodeId, position } });
  }, []);

  const deleteElements = useCallback((target: { nodeIds: string[]; edgeIds: string[] }) => {
    dispatch({ type: "ELEMENTS_DELETED", payload: target });
  }, []);

  // ── UC-016: 엣지 설정/편집 액션 ──────────────────────────────────

  const addEdge = useCallback(
    (input: {
      sourceClientNodeId: string;
      targetClientNodeId: string;
      relationTypeId: string;
    }): ActionResult<EdgeBlockReason> => {
      const reason = validateEdgeCandidate(
        { nodes: state.nodes, edges: state.edges },
        input,
        relationTypeById,
      );
      if (reason) {
        return { ok: false, reason };
      }
      const clientEdgeId = crypto.randomUUID();
      dispatch({
        type: "EDGE_ADDED",
        payload: {
          clientEdgeId,
          sourceClientNodeId: input.sourceClientNodeId,
          targetClientNodeId: input.targetClientNodeId,
          relationTypeId: input.relationTypeId,
        },
      });
      return { ok: true };
    },
    [state, relationTypeById],
  );

  const changeEdgeRelation = useCallback(
    (clientEdgeId: string, relationTypeId: string): ActionResult<EdgeBlockReason> => {
      const existing = state.edges[clientEdgeId];
      if (!existing) {
        return { ok: false, reason: "NODE_NOT_FOUND" };
      }
      const reason = validateEdgeCandidate(
        { nodes: state.nodes, edges: state.edges },
        {
          sourceClientNodeId: existing.sourceClientNodeId,
          targetClientNodeId: existing.targetClientNodeId,
          relationTypeId,
        },
        relationTypeById,
        { excludeEdgeId: clientEdgeId },
      );
      if (reason) {
        return { ok: false, reason };
      }
      dispatch({ type: "EDGE_RELATION_CHANGED", payload: { clientEdgeId, relationTypeId } });
      return { ok: true };
    },
    [state, relationTypeById],
  );

  const actionsValue: ChainEditorActions = useMemo(
    () => ({
      changeName,
      changeFocusType,
      setFocusSecurity,
      clearFocusSecurity,
      addListedCompanyNode,
      addFreeSubjectNode,
      moveNode,
      deleteElements,
      addEdge,
      changeEdgeRelation,
    }),
    [
      changeName,
      changeFocusType,
      setFocusSecurity,
      clearFocusSecurity,
      addListedCompanyNode,
      addFreeSubjectNode,
      moveNode,
      deleteElements,
      addEdge,
      changeEdgeRelation,
    ],
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
