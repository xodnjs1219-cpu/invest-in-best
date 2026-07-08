import { describe, expect, it } from "vitest";
import { CHAIN_EDITOR_INITIAL_STATE, chainEditorReducer } from "./chainEditorReducer";
import { selectNameIssue, selectNodeCount } from "./chainEditorSelectors";

describe("chainEditorSelectors", () => {
  it("빈 문서 → selectNodeCount=0", () => {
    expect(selectNodeCount(CHAIN_EDITOR_INITIAL_STATE)).toBe(0);
  });

  it("name='' → selectNameIssue='NAME_REQUIRED', name='ABC' → null", () => {
    const emptyName = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
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
    expect(selectNameIssue(emptyName)).toBe("NAME_REQUIRED");

    const withName = chainEditorReducer(emptyName, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "ABC" },
    });
    expect(selectNameIssue(withName)).toBeNull();
  });
});
