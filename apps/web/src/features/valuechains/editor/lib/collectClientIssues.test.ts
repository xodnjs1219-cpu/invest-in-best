import { describe, expect, it } from "vitest";
import type { RelationType } from "@iib/domain";
import { CHAIN_EDITOR_INITIAL_STATE, chainEditorReducer } from "@/features/valuechains/editor/state/chainEditorReducer";
import { collectClientIssues } from "./collectClientIssues";

function initEditor() {
  return chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
    type: "EDITOR_INITIALIZED",
    payload: {
      chainId: null,
      baseSnapshotId: null,
      name: "",
      focusType: "industry",
      focusSecurity: null,
      nodes: {},
      edges: {},
      groups: {},
    },
  });
}

const relationTypeById = new Map<string, RelationType>([
  ["rt1", { id: "rt1", name: "공급", isDirected: true, isActive: true }],
]);

describe("collectClientIssues", () => {
  it("이름 공백 + 노드 0개 → NAME_REQUIRED 1건만", () => {
    const state = initEditor();
    const issues = collectClientIssues(state, relationTypeById);
    expect(issues).toEqual([
      { code: "NAME_REQUIRED", message: expect.any(String), targets: { field: "name" } },
    ]);
  });

  it("정상 상태 → []", () => {
    let state = initEditor();
    state = chainEditorReducer(state, { type: "CHAIN_NAME_CHANGED", payload: { name: "체인" } });
    const issues = collectClientIssues(state, relationTypeById);
    expect(issues).toEqual([]);
  });

  it("그룹 이름 공백 → INVALID_GROUP + 해당 clientGroupIds", () => {
    let state = initEditor();
    state = chainEditorReducer(state, { type: "CHAIN_NAME_CHANGED", payload: { name: "체인" } });
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n1", subjectType: "consumer", subjectName: "a", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "  ", memberNodeIds: ["n1"] },
    });
    const issues = collectClientIssues(state, relationTypeById);
    expect(issues.some((i) => i.code === "INVALID_GROUP" && i.targets.clientGroupIds?.includes("g1"))).toBe(true);
  });

  it("복수 이슈 혼재 → 전부 수집", () => {
    const state = initEditor();
    const issues = collectClientIssues(state, relationTypeById);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });
});
