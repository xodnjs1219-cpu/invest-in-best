import { describe, expect, it } from "vitest";
import {
  ADMIN_BATCH_RUNS_PAGE_SIZE_DEFAULT,
  ADMIN_BATCH_RUNS_PAGE_SIZE_MAX,
} from "@iib/domain";
import {
  BackfillLatestRunRowSchema,
  BatchFailuresQuerySchema,
  BatchItemFailureRowSchema,
  BatchRunDetailRowSchema,
  BatchRunsListQuerySchema,
  BatchRunSummaryRowSchema,
  RunIdParamSchema,
} from "@/features/admin-batches/backend/schema";

describe("BatchRunsListQuerySchema", () => {
  it("모든 파라미터 미지정 시 기본값(page=1, pageSize=기본값)을 적용하고 필터는 undefined다", () => {
    const parsed = BatchRunsListQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.page).toBe(1);
    expect(parsed.data.pageSize).toBe(ADMIN_BATCH_RUNS_PAGE_SIZE_DEFAULT);
    expect(parsed.data.jobType).toBeUndefined();
    expect(parsed.data.status).toBeUndefined();
  });

  it("정의되지 않은 jobType 값은 실패한다(E9·BR-4)", () => {
    const parsed = BatchRunsListQuerySchema.safeParse({ jobType: "unknown_job" });
    expect(parsed.success).toBe(false);
  });

  it("정의되지 않은 status 값은 실패한다(E9·BR-3)", () => {
    const parsed = BatchRunsListQuerySchema.safeParse({ status: "paused" });
    expect(parsed.success).toBe(false);
  });

  it("from > to면 refine에서 실패한다(E9)", () => {
    const parsed = BatchRunsListQuerySchema.safeParse({
      from: "2026-07-05T00:00:00+09:00",
      to: "2026-07-01T00:00:00+09:00",
    });
    expect(parsed.success).toBe(false);
  });

  it("from <= to면 통과한다", () => {
    const parsed = BatchRunsListQuerySchema.safeParse({
      from: "2026-07-01T00:00:00+09:00",
      to: "2026-07-05T00:00:00+09:00",
    });
    expect(parsed.success).toBe(true);
  });

  it("page=0은 실패한다(E9)", () => {
    const parsed = BatchRunsListQuerySchema.safeParse({ page: 0 });
    expect(parsed.success).toBe(false);
  });

  it("pageSize가 최대값을 초과하면 실패한다(E9)", () => {
    const parsed = BatchRunsListQuerySchema.safeParse({
      pageSize: ADMIN_BATCH_RUNS_PAGE_SIZE_MAX + 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("pageSize=abc(숫자 아님)은 실패한다(E9)", () => {
    const parsed = BatchRunsListQuerySchema.safeParse({ pageSize: "abc" });
    expect(parsed.success).toBe(false);
  });
});

describe("RunIdParamSchema", () => {
  it("uuid 형식이면 통과한다", () => {
    const parsed = RunIdParamSchema.safeParse("123e4567-e89b-12d3-a456-426614174000");
    expect(parsed.success).toBe(true);
  });

  it("uuid 형식이 아니면 실패한다", () => {
    const parsed = RunIdParamSchema.safeParse("not-a-uuid");
    expect(parsed.success).toBe(false);
  });
});

describe("BatchFailuresQuerySchema", () => {
  it("미지정 시 기본 페이지 값을 적용한다", () => {
    const parsed = BatchFailuresQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.page).toBe(1);
  });
});

describe("BatchItemFailureRowSchema", () => {
  it("securities: null 행(비종목 실패)을 통과시킨다(BR-8)", () => {
    const parsed = BatchItemFailureRowSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      attempt_count: 1,
      last_error: "환율 응답 스키마 불일치",
      is_resolved: true,
      updated_at: "2026-07-05T02:40:58+09:00",
      securities: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("securities 존재 행(종목 실패)을 통과시킨다", () => {
    const parsed = BatchItemFailureRowSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      attempt_count: 3,
      last_error: "HTTP 429 rate limited",
      is_resolved: false,
      updated_at: "2026-07-05T02:40:58+09:00",
      securities: { id: "223e4567-e89b-12d3-a456-426614174000", ticker: "005930", name: "삼성전자", market: "KRX" },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("BatchRunSummaryRowSchema", () => {
  it("finished_at: null(running) 행을 통과시킨다(E2)", () => {
    const parsed = BatchRunSummaryRowSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      job_type: "backfill_all",
      status: "running",
      started_at: "2026-07-05T02:00:00+09:00",
      finished_at: null,
      processed_count: 500,
      failed_count: 0,
      is_carried_over: false,
      target_market: null,
      has_error_log: false,
      created_at: "2026-07-05T02:00:00+09:00",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("BatchRunDetailRowSchema", () => {
  it("error_log 본문을 포함한 행을 통과시킨다", () => {
    const parsed = BatchRunDetailRowSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      job_type: "collect_financials",
      status: "partial_success",
      started_at: "2026-07-05T02:00:00+09:00",
      finished_at: "2026-07-05T02:41:12+09:00",
      processed_count: 2480,
      failed_count: 12,
      is_carried_over: true,
      target_market: "KRX",
      error_log: "OpenDART 일일 한도 도달로 214건 이월",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("BackfillLatestRunRowSchema", () => {
  it("최신 백필 실행 행을 통과시킨다", () => {
    const parsed = BackfillLatestRunRowSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      status: "partial_success",
      started_at: "2026-07-04T09:00:00+09:00",
      finished_at: "2026-07-04T18:20:00+09:00",
    });
    expect(parsed.success).toBe(true);
  });
});
