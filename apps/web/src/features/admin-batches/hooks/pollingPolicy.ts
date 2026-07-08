import { BATCH_RUNS_POLL_INTERVAL_MS } from "@iib/domain";
import type {
  BackfillProgressResponse,
  BatchRunsListResponse,
} from "@/features/admin-batches/backend/schema";

/** running 상태 실행이 목록에 존재하는지 판정(순수 함수). */
export const hasRunningRun = (runs: BatchRunsListResponse["runs"]): boolean =>
  runs.some((run) => run.status === "running");

/**
 * 목록 조회 훅의 `refetchInterval` 파생 함수(R-6). running 행 존재 시 폴링 주기,
 * 없거나 데이터 미도착(로딩/오류)이면 `false`(폴링 중단 — E1·E2·E12·Main 7).
 */
export const resolveRunsRefetchInterval = (
  data: BatchRunsListResponse | undefined,
): number | false => {
  if (!data) {
    return false;
  }
  return hasRunningRun(data.runs) ? BATCH_RUNS_POLL_INTERVAL_MS : false;
};

/** 백필 진행 카드 폴링 정책 — 최신 실행이 running일 때만 폴링(R-6). */
export const resolveBackfillRefetchInterval = (
  data: BackfillProgressResponse | undefined,
): number | false => {
  if (!data || !data.latestRun) {
    return false;
  }
  return data.latestRun.status === "running" ? BATCH_RUNS_POLL_INTERVAL_MS : false;
};
