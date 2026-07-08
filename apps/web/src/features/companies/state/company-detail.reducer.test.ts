import { describe, expect, it } from "vitest";
import {
  companyDetailReducer,
  createInitialCompanyDetailState,
} from "@/features/companies/state/company-detail.reducer";

describe("createInitialCompanyDetailState", () => {
  it("초기 상태는 quotesPeriod='1Y', financialsPeriod='5Y', isTimelineNoticeDismissed=false", () => {
    const state = createInitialCompanyDetailState();
    expect(state).toEqual({
      quotesPeriod: "1Y",
      financialsPeriod: "5Y",
      isTimelineNoticeDismissed: false,
    });
  });
});

describe("companyDetailReducer", () => {
  it("QUOTES_PERIOD_CHANGED는 quotesPeriod만 변경하고 나머지는 불변(새 객체)이다", () => {
    const initial = createInitialCompanyDetailState();
    const next = companyDetailReducer(initial, {
      type: "QUOTES_PERIOD_CHANGED",
      payload: { period: "3M" },
    });

    expect(next.quotesPeriod).toBe("3M");
    expect(next.financialsPeriod).toBe(initial.financialsPeriod);
    expect(next.isTimelineNoticeDismissed).toBe(initial.isTimelineNoticeDismissed);
    expect(next).not.toBe(initial);
  });

  it("동일한 quotesPeriod 재선택 시 기존 state 참조를 그대로 반환한다(리렌더 방지)", () => {
    const initial = createInitialCompanyDetailState();
    const next = companyDetailReducer(initial, {
      type: "QUOTES_PERIOD_CHANGED",
      payload: { period: "1Y" },
    });

    expect(next).toBe(initial);
  });

  it("FINANCIALS_PERIOD_CHANGED는 financialsPeriod만 변경한다", () => {
    const initial = createInitialCompanyDetailState();
    const next = companyDetailReducer(initial, {
      type: "FINANCIALS_PERIOD_CHANGED",
      payload: { period: "ALL" },
    });

    expect(next.financialsPeriod).toBe("ALL");
    expect(next.quotesPeriod).toBe(initial.quotesPeriod);
  });

  it("동일한 financialsPeriod 재선택 시 기존 state 참조를 그대로 반환한다", () => {
    const initial = createInitialCompanyDetailState();
    const next = companyDetailReducer(initial, {
      type: "FINANCIALS_PERIOD_CHANGED",
      payload: { period: "5Y" },
    });

    expect(next).toBe(initial);
  });

  it("TIMELINE_NOTICE_DISMISSED는 isTimelineNoticeDismissed를 true로 만든다", () => {
    const initial = createInitialCompanyDetailState();
    const next = companyDetailReducer(initial, { type: "TIMELINE_NOTICE_DISMISSED" });

    expect(next.isTimelineNoticeDismissed).toBe(true);
  });

  it("이미 dismissed=true인 상태에서 재디스패치하면 기존 state 참조를 반환한다(멱등)", () => {
    const dismissed = companyDetailReducer(createInitialCompanyDetailState(), {
      type: "TIMELINE_NOTICE_DISMISSED",
    });
    const next = companyDetailReducer(dismissed, { type: "TIMELINE_NOTICE_DISMISSED" });

    expect(next).toBe(dismissed);
  });

  it("모든 액션에서 원본 state를 변이하지 않는다", () => {
    const initial = createInitialCompanyDetailState();
    const snapshot = { ...initial };

    companyDetailReducer(initial, { type: "QUOTES_PERIOD_CHANGED", payload: { period: "3M" } });
    companyDetailReducer(initial, { type: "FINANCIALS_PERIOD_CHANGED", payload: { period: "ALL" } });
    companyDetailReducer(initial, { type: "TIMELINE_NOTICE_DISMISSED" });

    expect(initial).toEqual(snapshot);
  });
});
