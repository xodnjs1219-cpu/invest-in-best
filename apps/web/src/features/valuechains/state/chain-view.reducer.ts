import {
  DASHBOARD_DEFAULT_RANGE,
  TIMESERIES_MIN_START_DATE,
  type IsoDate,
  type NodePosition,
} from "@iib/domain";
import type { ChainViewAction } from "@/features/valuechains/state/chain-view.actions";

export type MetricsRangePreset = "1M" | "3M" | "6M" | "1Y" | "3Y" | "MAX";
export type MetricsRange =
  | { kind: "preset"; preset: MetricsRangePreset }
  | { kind: "custom"; from: IsoDate; to: IsoDate };

/**
 * chain-view 페이지 상태 (state_management.md §4.1 — S1~S6, plan 모듈 C4).
 * reducer는 순수 함수 — `Date.now()`/fetch/라우터 접근 금지, 항상 새 객체 반환.
 */
export interface ChainViewState {
  readonly timeline: {
    readonly selectedDate: IsoDate | null; // S1
    readonly lastAppliedDate: IsoDate | null; // S2
  };
  readonly nodePanel: {
    readonly selectedNodeId: string | null; // S3
  };
  readonly dashboard: {
    readonly range: MetricsRange; // S4
  };
  readonly canvas: {
    readonly localNodePositions: Readonly<Record<string, NodePosition>>; // S5
  };
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * URL `?at=` 원본을 검증·파싱한다 — `YYYY-MM-DD` 형식 + [TIMESERIES_MIN_START_DATE, today] 범위,
 * 무효(형식 오류·범위 밖) 시 `null`. "오늘"은 순수성 유지를 위해 인자로 주입받는다.
 */
export function parseAtParam(raw: string | null, today: IsoDate): IsoDate | null {
  if (raw === null || !ISO_DATE_PATTERN.test(raw)) {
    return null;
  }
  if (raw < TIMESERIES_MIN_START_DATE || raw > today) {
    return null;
  }
  return raw as IsoDate;
}

/** 초기 상태 팩토리 — "오늘"(Asia/Seoul)은 순수성 유지를 위해 인자로 주입한다. */
export function createInitialChainViewState(input: {
  atParam: string | null;
  today: IsoDate;
}): ChainViewState {
  const selectedDate = parseAtParam(input.atParam, input.today);
  return {
    timeline: { selectedDate, lastAppliedDate: null },
    nodePanel: { selectedNodeId: null },
    dashboard: { range: DASHBOARD_DEFAULT_RANGE },
    canvas: { localNodePositions: {} },
  };
}

const rangesEqual = (a: MetricsRange, b: MetricsRange): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === "preset" && b.kind === "preset") return a.preset === b.preset;
  if (a.kind === "custom" && b.kind === "custom") return a.from === b.from && a.to === b.to;
  return false;
};

/** state_management.md §4.2 전이 규칙표를 그대로 구현한다. */
export function chainViewReducer(state: ChainViewState, action: ChainViewAction): ChainViewState {
  switch (action.type) {
    case "TIMELINE_DATE_SELECTED": {
      if (state.timeline.selectedDate === action.payload.date) {
        return state;
      }
      return {
        ...state,
        timeline: { selectedDate: action.payload.date, lastAppliedDate: state.timeline.lastAppliedDate },
        nodePanel: { selectedNodeId: null },
        canvas: { localNodePositions: {} },
      };
    }

    case "TIMELINE_RETURNED_TO_LATEST": {
      if (state.timeline.selectedDate === null) {
        return state;
      }
      return {
        ...state,
        timeline: { selectedDate: null, lastAppliedDate: state.timeline.lastAppliedDate },
        nodePanel: { selectedNodeId: null },
        canvas: { localNodePositions: {} },
      };
    }

    case "TIMELINE_RESTORE_SUCCEEDED": {
      if (action.payload.date !== state.timeline.selectedDate) {
        return state;
      }
      return {
        ...state,
        timeline: { selectedDate: state.timeline.selectedDate, lastAppliedDate: action.payload.date },
      };
    }

    case "TIMELINE_RESTORE_FAILED": {
      if (action.payload.failedDate !== state.timeline.selectedDate) {
        return state;
      }
      return {
        ...state,
        timeline: {
          selectedDate: state.timeline.lastAppliedDate,
          lastAppliedDate: state.timeline.lastAppliedDate,
        },
      };
    }

    case "NODE_SELECTED": {
      if (state.nodePanel.selectedNodeId === action.payload.nodeId) {
        return state;
      }
      return { ...state, nodePanel: { selectedNodeId: action.payload.nodeId } };
    }

    case "NODE_PANEL_CLOSED": {
      if (state.nodePanel.selectedNodeId === null) {
        return state;
      }
      return { ...state, nodePanel: { selectedNodeId: null } };
    }

    case "DASHBOARD_RANGE_CHANGED": {
      if (rangesEqual(state.dashboard.range, action.payload.range)) {
        return state;
      }
      return { ...state, dashboard: { range: action.payload.range } };
    }

    case "NODE_DRAG_ENDED": {
      return {
        ...state,
        canvas: {
          ...state.canvas,
          localNodePositions: {
            ...state.canvas.localNodePositions,
            [action.payload.nodeId]: action.payload.position,
          },
        },
      };
    }

    default: {
      const _exhaustiveCheck: never = action;
      return _exhaustiveCheck;
    }
  }
}
