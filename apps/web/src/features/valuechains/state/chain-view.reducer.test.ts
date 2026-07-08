import { describe, expect, it } from "vitest";
import type { IsoDate } from "@iib/domain";
import {
  chainViewReducer,
  createInitialChainViewState,
  parseAtParam,
  type ChainViewState,
} from "@/features/valuechains/state/chain-view.reducer";

const TODAY = "2026-07-08" as IsoDate;
const D1 = "2026-05-02" as IsoDate;
const D2 = "2026-06-01" as IsoDate;

describe("parseAtParam", () => {
  it("유효한 날짜 형식은 그대로 반환한다", () => {
    expect(parseAtParam("2026-05-02", TODAY)).toBe("2026-05-02");
  });

  it("형식 오류는 null을 반환한다", () => {
    expect(parseAtParam("2026/05/02", TODAY)).toBeNull();
    expect(parseAtParam("not-a-date", TODAY)).toBeNull();
  });

  it("미래 날짜는 null을 반환한다", () => {
    expect(parseAtParam("2099-01-01", TODAY)).toBeNull();
  });

  it("TIMESERIES_MIN_START_DATE(2015-01-01) 이전은 null을 반환한다", () => {
    expect(parseAtParam("2014-12-31", TODAY)).toBeNull();
  });

  it("null 입력은 null을 반환한다", () => {
    expect(parseAtParam(null, TODAY)).toBeNull();
  });

  it("경계값(오늘·최소일)은 유효하다", () => {
    expect(parseAtParam(TODAY, TODAY)).toBe(TODAY);
    expect(parseAtParam("2015-01-01", TODAY)).toBe("2015-01-01");
  });
});

describe("createInitialChainViewState", () => {
  it("atParam이 유효하면 S1에 반영된다", () => {
    const state = createInitialChainViewState({ atParam: D1, today: TODAY });
    expect(state.timeline.selectedDate).toBe(D1);
  });

  it("atParam이 무효/null이면 S1은 null이다", () => {
    const state = createInitialChainViewState({ atParam: null, today: TODAY });
    expect(state.timeline.selectedDate).toBeNull();
  });

  it("S2~S6 초기값이 올바르다", () => {
    const state = createInitialChainViewState({ atParam: null, today: TODAY });
    expect(state.timeline.lastAppliedDate).toBeNull();
    expect(state.nodePanel.selectedNodeId).toBeNull();
    expect(state.dashboard.range).toEqual({ kind: "preset", preset: "1Y" });
    expect(state.canvas.localNodePositions).toEqual({});
    expect(state.canvas.collapsedGroupIds).toEqual([]);
  });
});

describe("chainViewReducer", () => {
  const baseState: ChainViewState = createInitialChainViewState({ atParam: null, today: TODAY });

  describe("TIMELINE_DATE_SELECTED", () => {
    it("S1=D + S3=null·S5={}·S6=[] 동시 초기화, S2·S4는 불변", () => {
      const dirtyState: ChainViewState = {
        ...baseState,
        nodePanel: { selectedNodeId: "n1" },
        canvas: { localNodePositions: { n1: { x: 1, y: 2 } }, collapsedGroupIds: ["g1"] },
        timeline: { selectedDate: null, lastAppliedDate: D2 },
      };

      const next = chainViewReducer(dirtyState, {
        type: "TIMELINE_DATE_SELECTED",
        payload: { date: D1 },
      });

      expect(next.timeline.selectedDate).toBe(D1);
      expect(next.nodePanel.selectedNodeId).toBeNull();
      expect(next.canvas.localNodePositions).toEqual({});
      expect(next.canvas.collapsedGroupIds).toEqual([]);
      expect(next.timeline.lastAppliedDate).toBe(D2);
      expect(next.dashboard.range).toEqual(dirtyState.dashboard.range);
    });

    it("동일 D 재선택이면 기존 state 참조를 그대로 반환한다(no-op)", () => {
      const state: ChainViewState = {
        ...baseState,
        timeline: { selectedDate: D1, lastAppliedDate: null },
      };

      const next = chainViewReducer(state, {
        type: "TIMELINE_DATE_SELECTED",
        payload: { date: D1 },
      });

      expect(next).toBe(state);
    });
  });

  describe("TIMELINE_RESTORE_SUCCEEDED / FAILED", () => {
    it("성공 시 S1과 일치하면 S2=payload.date", () => {
      const state: ChainViewState = {
        ...baseState,
        timeline: { selectedDate: D1, lastAppliedDate: null },
      };

      const next = chainViewReducer(state, {
        type: "TIMELINE_RESTORE_SUCCEEDED",
        payload: { date: D1 },
      });

      expect(next.timeline.lastAppliedDate).toBe(D1);
    });

    it("경합 가드: payload.date !== S1이면 기존 state를 그대로 반환한다", () => {
      const state: ChainViewState = {
        ...baseState,
        timeline: { selectedDate: D2, lastAppliedDate: null },
      };

      const next = chainViewReducer(state, {
        type: "TIMELINE_RESTORE_SUCCEEDED",
        payload: { date: D1 },
      });

      expect(next).toBe(state);
    });

    it("실패 시 S1과 일치하면 S1←S2(직전 성공 시점)로 되돌린다", () => {
      const state: ChainViewState = {
        ...baseState,
        timeline: { selectedDate: D1, lastAppliedDate: D2 },
      };

      const next = chainViewReducer(state, {
        type: "TIMELINE_RESTORE_FAILED",
        payload: { failedDate: D1 },
      });

      expect(next.timeline.selectedDate).toBe(D2);
    });

    it("실패 경합 가드: failedDate !== S1이면 기존 state를 그대로 반환한다", () => {
      const state: ChainViewState = {
        ...baseState,
        timeline: { selectedDate: D2, lastAppliedDate: null },
      };

      const next = chainViewReducer(state, {
        type: "TIMELINE_RESTORE_FAILED",
        payload: { failedDate: D1 },
      });

      expect(next).toBe(state);
    });
  });

  describe("TIMELINE_RETURNED_TO_LATEST", () => {
    it("S1=null + S3/S5/S6 초기화, S4 유지", () => {
      const state: ChainViewState = {
        ...baseState,
        timeline: { selectedDate: D1, lastAppliedDate: D1 },
        nodePanel: { selectedNodeId: "n1" },
        canvas: { localNodePositions: { n1: { x: 1, y: 2 } }, collapsedGroupIds: ["g1"] },
        dashboard: { range: { kind: "preset", preset: "3M" } },
      };

      const next = chainViewReducer(state, { type: "TIMELINE_RETURNED_TO_LATEST" });

      expect(next.timeline.selectedDate).toBeNull();
      expect(next.nodePanel.selectedNodeId).toBeNull();
      expect(next.canvas.localNodePositions).toEqual({});
      expect(next.canvas.collapsedGroupIds).toEqual([]);
      expect(next.dashboard.range).toEqual({ kind: "preset", preset: "3M" });
    });

    it("이미 null이면 no-op(기존 state 참조 반환)", () => {
      const state: ChainViewState = {
        ...baseState,
        timeline: { selectedDate: null, lastAppliedDate: null },
      };

      const next = chainViewReducer(state, { type: "TIMELINE_RETURNED_TO_LATEST" });

      expect(next).toBe(state);
    });
  });

  describe("NODE_SELECTED / NODE_PANEL_CLOSED", () => {
    it("NODE_SELECTED는 selectedNodeId를 갱신한다", () => {
      const next = chainViewReducer(baseState, {
        type: "NODE_SELECTED",
        payload: { nodeId: "n1" },
      });
      expect(next.nodePanel.selectedNodeId).toBe("n1");
    });

    it("동일 노드 재클릭이면 기존 state를 그대로 반환한다", () => {
      const state: ChainViewState = { ...baseState, nodePanel: { selectedNodeId: "n1" } };
      const next = chainViewReducer(state, { type: "NODE_SELECTED", payload: { nodeId: "n1" } });
      expect(next).toBe(state);
    });

    it("NODE_PANEL_CLOSED는 selectedNodeId를 null로 만든다(멱등)", () => {
      const state: ChainViewState = { ...baseState, nodePanel: { selectedNodeId: "n1" } };
      const next = chainViewReducer(state, { type: "NODE_PANEL_CLOSED" });
      expect(next.nodePanel.selectedNodeId).toBeNull();
    });
  });

  describe("DASHBOARD_RANGE_CHANGED", () => {
    it("range를 갱신한다", () => {
      const next = chainViewReducer(baseState, {
        type: "DASHBOARD_RANGE_CHANGED",
        payload: { range: { kind: "preset", preset: "3M" } },
      });
      expect(next.dashboard.range).toEqual({ kind: "preset", preset: "3M" });
    });

    it("동등 값이면 기존 state를 그대로 반환한다", () => {
      const state: ChainViewState = {
        ...baseState,
        dashboard: { range: { kind: "preset", preset: "1Y" } },
      };
      const next = chainViewReducer(state, {
        type: "DASHBOARD_RANGE_CHANGED",
        payload: { range: { kind: "preset", preset: "1Y" } },
      });
      expect(next).toBe(state);
    });
  });

  describe("NODE_DRAG_ENDED / GROUP_COLLAPSE_TOGGLED", () => {
    it("NODE_DRAG_ENDED 2회 누적 병합, 원본 비변이", () => {
      const first = chainViewReducer(baseState, {
        type: "NODE_DRAG_ENDED",
        payload: { nodeId: "n1", position: { x: 1, y: 2 } },
      });
      const second = chainViewReducer(first, {
        type: "NODE_DRAG_ENDED",
        payload: { nodeId: "n2", position: { x: 3, y: 4 } },
      });

      expect(second.canvas.localNodePositions).toEqual({
        n1: { x: 1, y: 2 },
        n2: { x: 3, y: 4 },
      });
      expect(baseState.canvas.localNodePositions).toEqual({});
      expect(first.canvas.localNodePositions).not.toBe(second.canvas.localNodePositions);
    });

    it("GROUP_COLLAPSE_TOGGLED 추가↔제거 왕복, 원본 비변이", () => {
      const collapsed = chainViewReducer(baseState, {
        type: "GROUP_COLLAPSE_TOGGLED",
        payload: { groupId: "g1" },
      });
      expect(collapsed.canvas.collapsedGroupIds).toEqual(["g1"]);
      expect(baseState.canvas.collapsedGroupIds).toEqual([]);

      const expanded = chainViewReducer(collapsed, {
        type: "GROUP_COLLAPSE_TOGGLED",
        payload: { groupId: "g1" },
      });
      expect(expanded.canvas.collapsedGroupIds).toEqual([]);
    });
  });

  it("모든 액션에서 입력 state는 변이되지 않는다(참조 불변)", () => {
    const state = createInitialChainViewState({ atParam: null, today: TODAY });
    const snapshot = JSON.parse(JSON.stringify(state));

    chainViewReducer(state, { type: "TIMELINE_DATE_SELECTED", payload: { date: D1 } });
    chainViewReducer(state, { type: "NODE_SELECTED", payload: { nodeId: "n1" } });
    chainViewReducer(state, {
      type: "NODE_DRAG_ENDED",
      payload: { nodeId: "n1", position: { x: 1, y: 1 } },
    });
    chainViewReducer(state, { type: "GROUP_COLLAPSE_TOGGLED", payload: { groupId: "g1" } });

    expect(state).toEqual(snapshot);
  });
});
