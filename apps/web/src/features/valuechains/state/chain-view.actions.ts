import type { IsoDate, NodePosition } from "@iib/domain";
import type { MetricsRange } from "@/features/valuechains/state/chain-view.reducer";

/**
 * chain-view 페이지 Action 판별 유니온 (state_management.md §3, plan 모듈 C4).
 * `<도메인>_<사건(과거형)>` 네이밍 — 명령이 아닌 사건 서술. payload는 최소 필드만.
 */
export type ChainViewAction =
  | { type: "TIMELINE_DATE_SELECTED"; payload: { date: IsoDate } }
  | { type: "TIMELINE_RETURNED_TO_LATEST" }
  | { type: "TIMELINE_RESTORE_SUCCEEDED"; payload: { date: IsoDate | null } }
  | { type: "TIMELINE_RESTORE_FAILED"; payload: { failedDate: IsoDate } }
  | { type: "NODE_SELECTED"; payload: { nodeId: string } }
  | { type: "NODE_PANEL_CLOSED" }
  | { type: "DASHBOARD_RANGE_CHANGED"; payload: { range: MetricsRange } }
  | { type: "NODE_DRAG_ENDED"; payload: { nodeId: string; position: NodePosition } }
  | { type: "GROUP_COLLAPSE_TOGGLED"; payload: { groupId: string } };
