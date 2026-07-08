import { describe, expect, it } from "vitest";
import {
  adminBatchesReducer,
  initialAdminBatchesState,
} from "@/features/admin-batches/hooks/adminBatchesReducer";

describe("initialAdminBatchesState", () => {
  it("필터 null·page 1·선택 null 초기 상태를 갖는다", () => {
    expect(initialAdminBatchesState).toEqual({
      jobType: null,
      status: null,
      from: null,
      to: null,
      page: 1,
      selectedRunId: null,
      failuresPage: 1,
    });
  });
});

describe("FILTER_CHANGED", () => {
  it("status만 교체하고 page 1 리셋 + selectedRunId 해제한다", () => {
    const prev = { ...initialAdminBatchesState, page: 3, selectedRunId: "run-1", failuresPage: 2 };

    const next = adminBatchesReducer(prev, { type: "FILTER_CHANGED", status: "failed" });

    expect(next.status).toBe("failed");
    expect(next.page).toBe(1);
    expect(next.selectedRunId).toBeNull();
    expect(next.failuresPage).toBe(1);
  });

  it("부분 갱신 — jobType만 지정하면 status는 유지된다", () => {
    const prev = { ...initialAdminBatchesState, status: "success" as const };

    const next = adminBatchesReducer(prev, { type: "FILTER_CHANGED", jobType: "collect_quotes" });

    expect(next.jobType).toBe("collect_quotes");
    expect(next.status).toBe("success");
  });
});

describe("PAGE_CHANGED", () => {
  it("1 미만 페이지는 무시하고 동일 참조를 반환한다", () => {
    const prev = initialAdminBatchesState;

    const next = adminBatchesReducer(prev, { type: "PAGE_CHANGED", page: 0 });

    expect(next).toBe(prev);
  });

  it("유효 페이지로 변경 시 page 갱신 + 상세 닫힘", () => {
    const prev = { ...initialAdminBatchesState, selectedRunId: "run-1" };

    const next = adminBatchesReducer(prev, { type: "PAGE_CHANGED", page: 2 });

    expect(next.page).toBe(2);
    expect(next.selectedRunId).toBeNull();
  });
});

describe("RUN_SELECTED", () => {
  it("동일 ID 재선택은 동일 참조를 반환한다", () => {
    const prev = { ...initialAdminBatchesState, selectedRunId: "run-1" };

    const next = adminBatchesReducer(prev, { type: "RUN_SELECTED", runId: "run-1" });

    expect(next).toBe(prev);
  });

  it("새 ID 선택 시 교체 + failuresPage 1로 리셋", () => {
    const prev = { ...initialAdminBatchesState, selectedRunId: "run-1", failuresPage: 3 };

    const next = adminBatchesReducer(prev, { type: "RUN_SELECTED", runId: "run-2" });

    expect(next.selectedRunId).toBe("run-2");
    expect(next.failuresPage).toBe(1);
  });
});

describe("DETAIL_CLOSED", () => {
  it("선택 해제한다", () => {
    const prev = { ...initialAdminBatchesState, selectedRunId: "run-1" };

    const next = adminBatchesReducer(prev, { type: "DETAIL_CLOSED" });

    expect(next.selectedRunId).toBeNull();
  });

  it("이미 닫혀있으면 동일 참조를 반환한다", () => {
    const prev = initialAdminBatchesState;

    const next = adminBatchesReducer(prev, { type: "DETAIL_CLOSED" });

    expect(next).toBe(prev);
  });
});

describe("FAILURES_PAGE_CHANGED", () => {
  it("상세가 열려 있지 않으면 무시한다(지연 이벤트 방어)", () => {
    const prev = initialAdminBatchesState;

    const next = adminBatchesReducer(prev, { type: "FAILURES_PAGE_CHANGED", page: 2 });

    expect(next).toBe(prev);
  });

  it("상세가 열려 있으면 failuresPage를 갱신한다", () => {
    const prev = { ...initialAdminBatchesState, selectedRunId: "run-1" };

    const next = adminBatchesReducer(prev, { type: "FAILURES_PAGE_CHANGED", page: 2 });

    expect(next.failuresPage).toBe(2);
  });
});

describe("불변성", () => {
  it("모든 액션에서 입력 state를 변이하지 않는다", () => {
    const prev = { ...initialAdminBatchesState, selectedRunId: "run-1" };
    const snapshot = { ...prev };

    adminBatchesReducer(prev, { type: "FILTER_CHANGED", status: "failed" });
    adminBatchesReducer(prev, { type: "PAGE_CHANGED", page: 2 });
    adminBatchesReducer(prev, { type: "RUN_SELECTED", runId: "run-2" });
    adminBatchesReducer(prev, { type: "DETAIL_CLOSED" });
    adminBatchesReducer(prev, { type: "FAILURES_PAGE_CHANGED", page: 2 });

    expect(prev).toEqual(snapshot);
  });
});
