import { describe, expect, it } from "vitest";
import type { EditorBootstrap } from "./chainEditorReducer";
import {
  CHAIN_EDITOR_INITIAL_STATE,
  chainEditorReducer,
} from "./chainEditorReducer";

const emptyBootstrap: EditorBootstrap = {
  chainId: null,
  baseSnapshotId: null,
  name: "",
  focusType: "industry",
  focusSecurity: null,
  nodes: {},
  edges: {},
  groups: {},
};

describe("chainEditorReducer", () => {
  it("initialized=false 상태에서 CHAIN_NAME_CHANGED dispatch → no-op(원본 참조 동일 반환)", () => {
    const state = CHAIN_EDITOR_INITIAL_STATE;
    const next = chainEditorReducer(state, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "AI 반도체" },
    });
    expect(next).toBe(state);
  });

  it("create 부트스트랩 payload(빈 문서)로 EDITOR_INITIALIZED → initialized=true, chainId=null, baseSnapshotId=null, isDirty=false", () => {
    const next = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    expect(next.initialized).toBe(true);
    expect(next.chainId).toBeNull();
    expect(next.baseSnapshotId).toBeNull();
    expect(next.isDirty).toBe(false);
    expect(next.serverIssues).toEqual([]);
    expect(next.selection).toEqual({ nodeIds: [], edgeIds: [] });
  });

  it("CHAIN_NAME_CHANGED → name 반영 + isDirty=true + serverIssues=[], 원본 객체 비변이(불변성)", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const next = chainEditorReducer(initialized, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "2차전지 밸류체인" },
    });
    expect(next.name).toBe("2차전지 밸류체인");
    expect(next.isDirty).toBe(true);
    expect(next.serverIssues).toEqual([]);
    expect(initialized.name).toBe(""); // 원본 비변이
  });

  it("focusSecurity 설정 상태에서 FOCUS_TYPE_CHANGED('industry') → focusSecurity=null", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const withCompany = chainEditorReducer(initialized, {
      type: "FOCUS_TYPE_CHANGED",
      payload: { focusType: "company" },
    });
    const withSecurity = chainEditorReducer(withCompany, {
      type: "FOCUS_SECURITY_SET",
      payload: {
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
      },
    });
    expect(withSecurity.focusSecurity).not.toBeNull();

    const backToIndustry = chainEditorReducer(withSecurity, {
      type: "FOCUS_TYPE_CHANGED",
      payload: { focusType: "industry" },
    });
    expect(backToIndustry.focusType).toBe("industry");
    expect(backToIndustry.focusSecurity).toBeNull();
  });

  it("focusType='industry' 상태에서 FOCUS_SECURITY_SET → no-op 가드(상태 불변)", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const next = chainEditorReducer(initialized, {
      type: "FOCUS_SECURITY_SET",
      payload: {
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
      },
    });
    expect(next).toBe(initialized);
    expect(next.focusSecurity).toBeNull();
  });

  it("FOCUS_TYPE_CHANGED('company') 후 FOCUS_SECURITY_SET → focusSecurity 반영 + dirty", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const withCompany = chainEditorReducer(initialized, {
      type: "FOCUS_TYPE_CHANGED",
      payload: { focusType: "company" },
    });
    const security = { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" as const };
    const next = chainEditorReducer(withCompany, {
      type: "FOCUS_SECURITY_SET",
      payload: { security },
    });
    expect(next.focusSecurity).toEqual(security);
    expect(next.isDirty).toBe(true);
  });

  it("FOCUS_SECURITY_CLEARED → focusSecurity=null + dirty", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const withCompany = chainEditorReducer(initialized, {
      type: "FOCUS_TYPE_CHANGED",
      payload: { focusType: "company" },
    });
    const withSecurity = chainEditorReducer(withCompany, {
      type: "FOCUS_SECURITY_SET",
      payload: {
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
      },
    });
    const next = chainEditorReducer(withSecurity, { type: "FOCUS_SECURITY_CLEARED" });
    expect(next.focusSecurity).toBeNull();
    expect(next.isDirty).toBe(true);
  });

  it("동일 값 재입력(name 불변) → 원본 반환(dirty 미발생)", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: { ...emptyBootstrap, name: "AI 반도체" },
    });
    const next = chainEditorReducer(initialized, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "AI 반도체" },
    });
    expect(next).toBe(initialized);
    expect(next.isDirty).toBe(false);
  });

  it("미구현 액션 타입(LISTED_NODE_ADDED 등) dispatch → no-op(후속 plan 확장 전 안전성)", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const next = chainEditorReducer(initialized, {
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n1",
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
        position: { x: 0, y: 0 },
      },
    });
    expect(next).toBe(initialized);
  });

  it("SELECTION_CHANGED → isDirty/serverIssues 불변", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const next = chainEditorReducer(initialized, {
      type: "SELECTION_CHANGED",
      payload: { nodeIds: ["n1"], edgeIds: [] },
    });
    expect(next.selection).toEqual({ nodeIds: ["n1"], edgeIds: [] });
    expect(next.isDirty).toBe(false);
  });

  it("SAVE_SUCCEEDED → chainId/baseSnapshotId 갱신, isDirty=false", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const dirty = chainEditorReducer(initialized, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "AI 반도체" },
    });
    const saved = chainEditorReducer(dirty, {
      type: "SAVE_SUCCEEDED",
      payload: { chainId: "c1", snapshotId: "snap1" },
    });
    expect(saved.chainId).toBe("c1");
    expect(saved.baseSnapshotId).toBe("snap1");
    expect(saved.isDirty).toBe(false);
  });
});
