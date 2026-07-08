/**
 * 프레임워크 독립 공용 타입 (docs/usecases/009/plan.md 모듈 A7).
 * web/worker가 공유하는 순수 타입만 포함한다 — Supabase/React/Next 등 프레임워크 의존 금지.
 */

/** `YYYY-MM-DD` 형식의 브랜드 문자열 — 타임라인·지표 조회의 날짜 파라미터(state_management.md S1 등). */
export type IsoDate = string & { readonly __brand: "IsoDate" };

/** 마인드맵 캔버스 노드 좌표. */
export type NodePosition = {
  readonly x: number;
  readonly y: number;
};
