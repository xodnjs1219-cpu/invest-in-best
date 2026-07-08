/**
 * FE 재노출 (plan 모듈 C1) — FE(훅·셀렉터·컴포넌트)는 이 경로만 import한다.
 * backend `schema.ts`의 Response 타입을 재수출해 FE가 backend 내부 구조에 직접 결합하지 않도록 한다.
 * UC-010~012 DTO도 이후 이 파일에 추가한다.
 */
export type {
  ChainViewResponse,
  ChainViewChain,
  ChainViewSnapshot,
  ChainViewGroup,
  ChainViewNode,
  ChainViewEdge,
  DataFreshness,
} from "@/features/valuechains/backend/schema";

/** UC-007 메인/탐색 페이지 체인 카드 목록 DTO (plan 모듈 D-1). */
export type {
  ChainCard,
  ChainCardMetric,
  ChainCardListResponse,
} from "@/features/valuechains/backend/schema";
export { ChainCardListResponseSchema } from "@/features/valuechains/backend/schema";

/** UC-010(대시보드 지표)·UC-011(노드 상세)·UC-012(타임라인/스냅샷 복원) DTO. */
export type {
  DailyMetricsQuery,
  DailyMetricsResponse,
  DailyMetricCurrent,
  DailyMetricPoint,
  DailyAnnotations,
  QuarterlyMetricsQuery,
  QuarterlyMetricsResponse,
  QuarterlyMetricCurrent,
  QuarterlyMetricPoint,
  QuarterlyAnnotations,
  NodeDetailResponse,
  TimelineMetaResponse,
  SnapshotAtResponse,
} from "@/features/valuechains/backend/schema";
