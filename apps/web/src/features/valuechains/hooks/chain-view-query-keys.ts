import type { IsoDate } from "@iib/domain";

/**
 * chain-view 페이지 전체(UC-009~012)의 쿼리 키 단일 정의 (state_management.md §6, plan 모듈 C2).
 * UC-009는 `structure`만 사용하지만, 키 체계는 페이지 단일 계약이므로 최초 1회 완성 정의한다.
 * UC-010~012 plan은 이 파일을 참조만 하고 수정하지 않는다.
 */

export type QuarterlyParams = {
  fromYear: number;
  fromQuarter: number;
  toYear: number;
  toQuarter: number;
};

export const chainViewQueryKeys = {
  structure: (chainId: string) => ["valuechains", chainId, "structure"] as const,
  snapshotAt: (chainId: string, date: IsoDate) =>
    ["valuechains", chainId, "snapshot-at", date] as const,
  timeline: (chainId: string) => ["valuechains", chainId, "timeline"] as const,
  dailyMetrics: (chainId: string, p: { from: IsoDate; to: IsoDate; at: IsoDate | null }) =>
    ["valuechains", chainId, "metrics", "daily", p] as const,
  quarterlyMetrics: (chainId: string, p: QuarterlyParams & { at: IsoDate | null }) =>
    ["valuechains", chainId, "metrics", "quarterly", p] as const,
  nodeDetail: (chainId: string, nodeId: string) => ["valuechains", chainId, "nodes", nodeId] as const,
};
