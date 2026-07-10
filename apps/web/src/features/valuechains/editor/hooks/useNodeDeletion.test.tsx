// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ChainEditorState } from "@/features/valuechains/editor/state/chainEditorReducer";
import { CHAIN_EDITOR_INITIAL_STATE, chainEditorReducer } from "@/features/valuechains/editor/state/chainEditorReducer";
import { useNodeDeletion } from "@/features/valuechains/editor/hooks/useNodeDeletion";

// hoisted는 import보다 먼저 실행되므로 초기값은 null로 두고, beforeEach/각 테스트에서 실제 state를 주입한다.
const stateMock = vi.hoisted(() => ({ current: null as ChainEditorState | null }));
const deleteElements = vi.hoisted(() => vi.fn());

vi.mock("@/features/valuechains/editor/context/ChainEditorContext", () => ({
  useChainEditorState: () => ({ state: stateMock.current }),
  useChainEditorActions: () => ({ deleteElements }),
}));

/** 노드 2개 + 그 둘을 잇는 엣지 1개를 가진 상태를 만든다. */
function buildStateWithEdge() {
  let s = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
    type: "EDITOR_INITIALIZED",
    payload: {
      chainId: null, baseSnapshotId: null, name: "", focusType: "industry", focusSecurity: null,
      nodes: {}, edges: {}, groups: {},
    },
  });
  s = chainEditorReducer(s, {
    type: "FREE_SUBJECT_NODE_ADDED",
    payload: { clientNodeId: "n1", subjectType: "other", subjectName: "A", subjectMemo: null, position: { x: 0, y: 0 } },
  });
  s = chainEditorReducer(s, {
    type: "FREE_SUBJECT_NODE_ADDED",
    payload: { clientNodeId: "n2", subjectType: "other", subjectName: "B", subjectMemo: null, position: { x: 0, y: 0 } },
  });
  s = chainEditorReducer(s, {
    type: "EDGE_ADDED",
    payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" },
  });
  return s;
}

describe("useNodeDeletion", () => {
  beforeEach(() => {
    deleteElements.mockClear();
    stateMock.current = CHAIN_EDITOR_INITIAL_STATE;
  });

  it("연결 엣지가 없으면 즉시 삭제한다(다이얼로그 미표시)", () => {
    const s = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n1", subjectType: "other", subjectName: "A", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    stateMock.current = s;

    const { result } = renderHook(() => useNodeDeletion());
    act(() => result.current.requestDeleteNode("n1"));

    expect(deleteElements).toHaveBeenCalledWith({ nodeIds: ["n1"], edgeIds: [] });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it("연결 엣지가 있으면 확인 다이얼로그를 열고, 확인 시 노드+엣지를 함께 삭제한다", () => {
    stateMock.current = buildStateWithEdge();

    const { result } = renderHook(() => useNodeDeletion());
    act(() => result.current.requestDeleteNode("n1"));

    // 즉시 삭제되지 않고 다이얼로그가 열린다.
    expect(deleteElements).not.toHaveBeenCalled();
    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.connectedEdgeCount).toBe(1);

    act(() => result.current.dialogProps.onConfirm());
    expect(deleteElements).toHaveBeenCalledWith({ nodeIds: ["n1"], edgeIds: ["e1"] });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it("취소하면 삭제하지 않고 다이얼로그를 닫는다", () => {
    stateMock.current = buildStateWithEdge();

    const { result } = renderHook(() => useNodeDeletion());
    act(() => result.current.requestDeleteNode("n1"));
    act(() => result.current.dialogProps.onCancel());

    expect(deleteElements).not.toHaveBeenCalled();
    expect(result.current.dialogProps.open).toBe(false);
  });
});
