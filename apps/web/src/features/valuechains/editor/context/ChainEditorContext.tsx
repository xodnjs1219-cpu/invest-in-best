"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, useState, type ReactNode } from "react";
import type {
  EditorMode,
  EditorVariant,
  FocusType,
  FreeSubjectType,
  RelationType,
  SecurityRef,
  ServerIssue,
} from "@iib/domain";
import {
  MAX_NODES_PER_CHAIN,
  validateEdgeCandidate,
  validateFreeSubjectAdd,
  validateGroupCreate,
  validateGroupRename,
  validateListedNodeAdd,
  type EdgeBlockReason,
  type GroupBlockReason,
  type NodeBlockReason,
} from "@iib/domain";
import {
  CHAIN_EDITOR_INITIAL_STATE,
  chainEditorReducer,
  type ChainEditorState,
} from "@/features/valuechains/editor/state/chainEditorReducer";
import {
  selectDuplicateGroupNames,
  selectEmptyGroupIds,
  selectGroupMembership,
  selectIsNearNodeLimit,
  selectNameIssue,
  selectNodeCount,
  selectRemainingNodeCapacity,
  selectIssueHighlight,
  serializeSavePayload,
  type IssueHighlight,
} from "@/features/valuechains/editor/state/chainEditorSelectors";
import { useChainQuotaGate } from "@/features/valuechains/editor/hooks/useChainQuotaGate";
import { useEditorBootstrap } from "@/features/valuechains/editor/hooks/useEditorBootstrap";
import { useLatestSnapshot } from "@/features/valuechains/editor/hooks/useLatestSnapshot";
import { useRelationTypes } from "@/features/valuechains/editor/hooks/useRelationTypes";
import { useSaveChainMutation } from "@/features/valuechains/editor/hooks/useSaveChainMutation";
import { useUnsavedChangesGuard } from "@/features/valuechains/editor/hooks/useUnsavedChangesGuard";
import { collectClientIssues } from "@/features/valuechains/editor/lib/collectClientIssues";
import { getDefaultNodePosition } from "@/features/valuechains/editor/lib/nodePlacement";
import { classifySaveError, normalizeSaveErrorToIssues } from "@/features/valuechains/editor/lib/saveIssues";
import { toEditorBootstrap } from "@/features/valuechains/editor/lib/toEditorBootstrap";
import { ApiError } from "@/lib/http/api-client";

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

/** 저장 실행 결과(UC-018 plan 모듈 19 — save() 반환값). */
export type SaveOutcome =
  | { status: "saved" }
  | { status: "blocked_client" }
  | { status: "rejected_server" }
  | { status: "conflict" }
  | { status: "auth_required" }
  | { status: "network_error" };

/** 서버 캐시·mutation에서 파생되는 비동기 메타 (reducer 밖). */
export interface ChainEditorAsync {
  /** 초기 로드 중(스켈레톤) — create: 상한 게이트 조회 중 / edit: 최신 스냅샷 조회 중. */
  isBootstrapping: boolean;
  /** 401/네트워크·500 — 편집 진입 보류 + 재시도. */
  bootstrapError: { kind: "auth" | "network"; retry?: () => void } | null;
  /** create·user: 소유 체인 수 >= MAX_CHAINS_PER_USER(진입 차단 + 삭제 유도). null이면 미차단. */
  entryBlocked: { ownedChainCount: number; maxChainsPerUser: number } | null;
  /** UC-018 — 저장 요청 진행 중(저장 버튼 비활성화 트리거). */
  isSaving: boolean;
  /** UC-018 — 409 SAVE_CONFLICT/401/네트워크 오류(reducer 미유입 — dirty·문서 보존). */
  saveError: { kind: "conflict" | "auth" | "network" } | null;
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
  /** UC-017 — 그룹 수(패널 배지용). */
  groupCount: number;
  /** UC-017 — groupClientId → clientNodeIds[] 역인덱스. */
  groupMembership: ReadonlyMap<string, string[]>;
  /** UC-017 — 멤버 0개 그룹(저장 시 제외 예고 — BR-6). */
  emptyGroupIds: string[];
  /** UC-017 — 이름 중복 그룹(알림 전용, 차단 아님 — E3). */
  duplicateGroupNames: string[];
  /** UC-018 — 저장 가능 여부(이름 유효 ∧ 노드 상한 이내 ∧ 초기화 완료 ∧ 저장 중 아님). */
  canSave: boolean;
  /** UC-018 — 클라이언트 사전 검증 이슈(비어있으면 저장 진행 가능). */
  clientIssues: ServerIssue[];
  /** UC-018 — server+client 이슈 합산 하이라이트(캔버스·패널 공용). */
  issueHighlight: IssueHighlight;
}

export interface ChainEditorStateValue {
  meta: ChainEditorMeta;
  state: ChainEditorState;
  computed: ChainEditorComputed;
  async: ChainEditorAsync;
}

/** 노드/엣지 액션 공용 결과 타입 — 실패 시 dispatch 없이 사유만 반환한다. */
/** ok 시 노드 추가류 액션은 생성된 clientNodeId를 함께 반환한다(캔버스 포커스용). */
export type ActionResult<TReason extends string> =
  | { ok: true; clientNodeId?: string }
  | { ok: false; reason: TReason };

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
  /** UC-017 — 캔버스 선택 상태 갱신(그룹 노드는 호출측이 제외 — EditorCanvasContainer 책임). */
  changeSelection(selection: { nodeIds: string[]; edgeIds: string[] }): void;
  /** UC-016 — 신규 엣지 연결. 검증 실패 시 dispatch 없이 사유 반환. */
  addEdge(input: {
    sourceClientNodeId: string;
    targetClientNodeId: string;
    relationTypeId: string;
  }): ActionResult<EdgeBlockReason>;
  /** UC-016 — 기존 엣지의 관계 종류 변경(자기 자신 제외 재검증). */
  changeEdgeRelation(clientEdgeId: string, relationTypeId: string): ActionResult<EdgeBlockReason>;
  /** UC-017 — 그룹 생성(선택 노드가 소속, 타 그룹 소속 노드는 자동 이동 — E1·BR-3). */
  createGroup(input: { name: string; memberNodeIds: string[] }): ActionResult<GroupBlockReason>;
  /** UC-017 — 그룹 이름 변경. */
  renameGroup(clientGroupId: string, name: string): ActionResult<GroupBlockReason>;
  /** UC-017 — 노드의 그룹 소속 변경(null=미소속 전환). 대상 그룹 미존재 시 무시(이중 방어). */
  assignNodeToGroup(clientNodeId: string, groupClientId: string | null): void;
  /** UC-017 — 그룹 해제(그룹만 제거, 소속 노드는 유지 — E5·BR-5). */
  dissolveGroup(clientGroupId: string): void;
  /**
   * UC-018 — 저장 실행(클라이언트 검증 → 직렬화 → API 호출 → 결과 반영).
   * UC-021 — `variant==='official'`이면 options.disclosureDate가 body에 합성된다(R-8).
   */
  save(options?: { disclosureDate?: string | null }): Promise<SaveOutcome>;
  /** UC-018 — 저장 충돌(E7) 시 최신 구성 재로드(편집 내용 폐기). */
  reloadFromLatest(): Promise<void>;
  /** UC-018 — 충돌 다이얼로그 "계속 편집"/오류 배너 닫기. */
  resetSaveError(): void;
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
  const { mode, variant, chainId: routeChainId, children } = props;
  const [state, dispatch] = useReducer(chainEditorReducer, CHAIN_EDITOR_INITIAL_STATE);

  // create+user 경로만 게이트 활성화 — edit/official은 게이트 비적용(useChainQuotaGate 계약).
  const gateEnabled = mode === "create" && variant === "user";
  const gate = useChainQuotaGate({ enabled: gateEnabled });

  // edit 모드: 최신 구성 조회(UC-016 M16) — routeChainId가 있을 때만 활성화.
  const latestSnapshotQuery = useLatestSnapshot(mode === "edit" ? (routeChainId ?? null) : null);

  useEditorBootstrap({
    mode,
    gate,
    initialized: state.initialized,
    dispatch,
    latestSnapshot:
      mode === "edit"
        ? {
            status: latestSnapshotQuery.isSuccess ? "success" : latestSnapshotQuery.isError ? "error" : "pending",
            data: latestSnapshotQuery.data,
          }
        : undefined,
  });

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

  const saveMutation = useSaveChainMutation();
  const [saveErrorKind, setSaveErrorKind] = useState<"conflict" | "auth" | "network" | null>(null);

  const asyncValue: ChainEditorAsync = useMemo(() => {
    if (mode === "edit") {
      if (latestSnapshotQuery.isPending) {
        return {
          isBootstrapping: true,
          bootstrapError: null,
          entryBlocked: null,
          isSaving: saveMutation.isPending,
          saveError: saveErrorKind ? { kind: saveErrorKind } : null,
        };
      }
      if (latestSnapshotQuery.isError) {
        const err = latestSnapshotQuery.error;
        const kind = err instanceof ApiError && err.status === 401 ? "auth" : "network";
        return {
          isBootstrapping: false,
          bootstrapError: { kind, retry: () => latestSnapshotQuery.refetch() },
          entryBlocked: null,
          isSaving: saveMutation.isPending,
          saveError: saveErrorKind ? { kind: saveErrorKind } : null,
        };
      }
      return {
        isBootstrapping: false,
        bootstrapError: null,
        entryBlocked: null,
        isSaving: saveMutation.isPending,
        saveError: saveErrorKind ? { kind: saveErrorKind } : null,
      };
    }

    if (gate.status === "checking") {
      return {
        isBootstrapping: true,
        bootstrapError: null,
        entryBlocked: null,
        isSaving: saveMutation.isPending,
        saveError: saveErrorKind ? { kind: saveErrorKind } : null,
      };
    }
    if (gate.status === "auth_required") {
      return {
        isBootstrapping: false,
        bootstrapError: { kind: "auth" },
        entryBlocked: null,
        isSaving: saveMutation.isPending,
        saveError: saveErrorKind ? { kind: saveErrorKind } : null,
      };
    }
    if (gate.status === "error") {
      return {
        isBootstrapping: false,
        bootstrapError: { kind: "network", retry: gate.retry },
        entryBlocked: null,
        isSaving: saveMutation.isPending,
        saveError: saveErrorKind ? { kind: saveErrorKind } : null,
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
        isSaving: saveMutation.isPending,
        saveError: saveErrorKind ? { kind: saveErrorKind } : null,
      };
    }
    return {
      isBootstrapping: false,
      bootstrapError: null,
      entryBlocked: null,
      isSaving: saveMutation.isPending,
      saveError: saveErrorKind ? { kind: saveErrorKind } : null,
    };
  }, [mode, gate, latestSnapshotQuery, saveMutation.isPending, saveErrorKind]);

  const clientIssues = useMemo(() => collectClientIssues(state, relationTypeById), [state, relationTypeById]);
  const issueHighlight = useMemo(() => selectIssueHighlight(state, clientIssues), [state, clientIssues]);

  const computed: ChainEditorComputed = useMemo(
    () => ({
      nodeCount: selectNodeCount(state),
      nameIssue: selectNameIssue(state),
      remainingNodeCapacity: selectRemainingNodeCapacity(state),
      isNearNodeLimit: selectIsNearNodeLimit(state),
      relationTypeById,
      activeRelationTypes,
      hasActiveRelationTypes: activeRelationTypes.length > 0,
      groupCount: Object.keys(state.groups).length,
      groupMembership: selectGroupMembership(state),
      emptyGroupIds: selectEmptyGroupIds(state),
      duplicateGroupNames: selectDuplicateGroupNames(state),
      canSave:
        selectNameIssue(state) === null &&
        selectNodeCount(state) <= MAX_NODES_PER_CHAIN &&
        state.initialized &&
        !saveMutation.isPending,
      clientIssues,
      issueHighlight,
    }),
    [state, relationTypeById, activeRelationTypes, clientIssues, issueHighlight, saveMutation.isPending],
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
      return { ok: true, clientNodeId };
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
      return { ok: true, clientNodeId };
    },
    [state],
  );

  const moveNode = useCallback((clientNodeId: string, position: { x: number; y: number }) => {
    dispatch({ type: "NODE_MOVED", payload: { clientNodeId, position } });
  }, []);

  const deleteElements = useCallback((target: { nodeIds: string[]; edgeIds: string[] }) => {
    dispatch({ type: "ELEMENTS_DELETED", payload: target });
  }, []);

  const changeSelection = useCallback((selection: { nodeIds: string[]; edgeIds: string[] }) => {
    dispatch({ type: "SELECTION_CHANGED", payload: selection });
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

  // ── UC-017: 그룹 편집 액션 ──────────────────────────────────

  const createGroup = useCallback(
    (input: { name: string; memberNodeIds: string[] }): ActionResult<GroupBlockReason> => {
      const reason = validateGroupCreate(input);
      if (reason) {
        return { ok: false, reason };
      }
      const clientGroupId = crypto.randomUUID();
      dispatch({
        type: "GROUP_CREATED",
        payload: { clientGroupId, name: input.name, memberNodeIds: input.memberNodeIds },
      });
      return { ok: true };
    },
    [],
  );

  const renameGroup = useCallback(
    (clientGroupId: string, name: string): ActionResult<GroupBlockReason> => {
      const reason = validateGroupRename({ groups: state.groups }, clientGroupId, name);
      if (reason) {
        return { ok: false, reason };
      }
      dispatch({ type: "GROUP_RENAMED", payload: { clientGroupId, name } });
      return { ok: true };
    },
    [state.groups],
  );

  const assignNodeToGroup = useCallback(
    (clientNodeId: string, groupClientId: string | null) => {
      if (groupClientId !== null && !state.groups[groupClientId]) {
        return; // 미존재 그룹 지정 무시 — 리듀서 가드와 이중 방어
      }
      dispatch({ type: "NODE_GROUP_CHANGED", payload: { clientNodeId, groupClientId } });
    },
    [state.groups],
  );

  const dissolveGroup = useCallback((clientGroupId: string) => {
    dispatch({ type: "GROUP_DISSOLVED", payload: { clientGroupId } });
  }, []);

  // ── UC-018: 저장 수명주기 액션 ──────────────────────────────────

  const resetSaveError = useCallback(() => {
    setSaveErrorKind(null);
    saveMutation.reset();
  }, [saveMutation]);

  const reloadFromLatest = useCallback(async () => {
    const result = await latestSnapshotQuery.refetch();
    if (result.data) {
      dispatch({ type: "EDITOR_INITIALIZED", payload: toEditorBootstrap(result.data) });
    }
    resetSaveError();
  }, [latestSnapshotQuery, resetSaveError]);

  const save = useCallback(
    async (options?: { disclosureDate?: string | null }): Promise<SaveOutcome> => {
      const issues = collectClientIssues(state, relationTypeById);
      if (issues.length > 0) {
        return { status: "blocked_client" };
      }

      const payload = serializeSavePayload(state);

      try {
        const result = await saveMutation.mutateAsync(
          variant === "official"
            ? { chainId: state.chainId, payload, chainType: "official", disclosureDate: options?.disclosureDate ?? null }
            : { chainId: state.chainId, payload },
        );
        setSaveErrorKind(null);
        dispatch({ type: "SAVE_SUCCEEDED", payload: { chainId: result.chainId, snapshotId: result.snapshotId } });
        return { status: "saved" };
      } catch (err) {
        if (!(err instanceof ApiError)) {
          setSaveErrorKind("network");
          return { status: "network_error" };
        }

        const errorClass = classifySaveError(err);
        if (errorClass === "conflict") {
          setSaveErrorKind("conflict");
          return { status: "conflict" };
        }
        if (errorClass === "auth") {
          setSaveErrorKind("auth");
          return { status: "auth_required" };
        }
        if (errorClass === "network") {
          setSaveErrorKind("network");
          return { status: "network_error" };
        }

        // 'rejected': 422 계열/409 DUPLICATE_NAME — 서버가 지목하지 못한 대상은 빈 targets로 채워진다
        // (respond()가 details를 노출하지 않음 — saveIssues.ts 주석 참고).
        const normalized = normalizeSaveErrorToIssues(err, {});
        dispatch({ type: "SAVE_REJECTED", payload: { issues: normalized ?? [] } });
        return { status: "rejected_server" };
      }
    },
    [state, relationTypeById, saveMutation, variant],
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
      changeSelection,
      addEdge,
      changeEdgeRelation,
      createGroup,
      renameGroup,
      assignNodeToGroup,
      dissolveGroup,
      save,
      reloadFromLatest,
      resetSaveError,
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
      changeSelection,
      addEdge,
      changeEdgeRelation,
      createGroup,
      renameGroup,
      assignNodeToGroup,
      dissolveGroup,
      save,
      reloadFromLatest,
      resetSaveError,
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
