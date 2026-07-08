import { validateChainNameFormat } from "@iib/domain";
import type { ChainEditorState } from "./chainEditorReducer";

/**
 * chain-editor 파생 셀렉터 (UC-013 plan 모듈 6, state_management.md §4.4).
 * 상태로 두지 않는 파생값을 렌더 시 계산한다 — React 비의존 순수 함수.
 * 본 파일은 UC-013 분량(노드 수·이름 이슈)만 구현하고, 나머지(잔여 노드 수·상한 근접·
 * React Flow props 매핑 등)는 UC-015~018 plan이 이 파일에 함수를 추가한다.
 */

/** 캔버스 노드 수 — 툴바 배지용. */
export function selectNodeCount(state: ChainEditorState): number {
  return Object.keys(state.nodes).length;
}

/** 메타 패널 이름 필드 오류 표시용. */
export function selectNameIssue(state: ChainEditorState): "NAME_REQUIRED" | null {
  return validateChainNameFormat(state.name);
}
