import { describe, expect, it } from "vitest";
import type { IsoDate } from "@iib/domain";
import {
  selectDailyMetricsParams,
  selectQuarterlyMetricsParams,
  buildDailyMetricsView,
  buildQuarterlyMetricsView,
  buildNodePanelView,
} from "@/features/valuechains/state/chain-view.selectors";
import type { MetricsRange } from "@/features/valuechains/state/chain-view.reducer";
import type { DailyMetricsResponse, QuarterlyMetricsResponse, NodeDetailResponse } from "@/features/valuechains/lib/dto";

const TODAY = "2026-07-06" as IsoDate;

describe("selectDailyMetricsParams", () => {
  it("preset '1Y' → 1년 전부터 오늘까지(C-5 기본)", () => {
    expect(selectDailyMetricsParams({ kind: "preset", preset: "1Y" }, TODAY)).toEqual({
      from: "2025-07-06",
      to: TODAY,
    });
  });

  it("preset 'MAX' → 시계열 하한 클램프(E8)", () => {
    expect(selectDailyMetricsParams({ kind: "preset", preset: "MAX" }, TODAY)).toEqual({
      from: "2015-01-01",
      to: TODAY,
    });
  });

  it("custom 범위가 하한 이전이면 클램프", () => {
    const range: MetricsRange = { kind: "custom", from: "2013-01-01" as IsoDate, to: "2020-01-01" as IsoDate };
    const result = selectDailyMetricsParams(range, TODAY);
    expect(result.from).toBe("2015-01-01");
  });
});

describe("selectQuarterlyMetricsParams", () => {
  it("preset 기본값 → 최근 분기 범위", () => {
    const result = selectQuarterlyMetricsParams({ kind: "preset", preset: "1Y" }, TODAY);
    expect(result.toYear).toBe(2026);
    expect(result.toQuarter).toBe(3);
  });
});

describe("buildDailyMetricsView", () => {
  const READY_DATA: DailyMetricsResponse = {
    chainId: "chain-1",
    current: {
      metricDate: "2026-07-01",
      totalMarketCapKrw: 1000,
      coveredNodeCount: 3,
      totalNodeCount: 5,
      isCarriedForward: false,
      basedOnSnapshotId: "s1",
    },
    series: [
      {
        metricDate: "2026-07-01",
        totalMarketCapKrw: 1000,
        coveredNodeCount: 3,
        totalNodeCount: 5,
        isCarriedForward: false,
      },
    ],
    annotations: {
      baseCurrency: "KRW",
      fxBasis: "daily",
      sharesAsOfDateMin: "2026-01-01",
      sharesAsOfDateMax: "2026-06-01",
      isClosingConfirmed: true,
    },
  };

  it("error 쿼리 → status:'error'", () => {
    expect(buildDailyMetricsView({ query: { status: "error" }, highlightedDate: null })).toEqual({
      status: "error",
    });
  });

  it("pending 쿼리 → status:'loading'", () => {
    expect(buildDailyMetricsView({ query: { status: "pending" }, highlightedDate: null })).toEqual({
      status: "loading",
    });
  });

  it("빈 시계열 → status:'empty'(E12)", () => {
    const emptyData = { ...READY_DATA, series: [] };
    expect(
      buildDailyMetricsView({ query: { status: "success", data: emptyData }, highlightedDate: null }),
    ).toEqual({ status: "empty" });
  });

  it("정상 데이터 → status:'ready' + highlightedDate 반영(C-7)", () => {
    const result = buildDailyMetricsView({
      query: { status: "success", data: READY_DATA },
      highlightedDate: "2026-07-01" as IsoDate,
    });
    expect(result).toEqual({
      status: "ready",
      current: READY_DATA.current,
      series: READY_DATA.series,
      highlightedDate: "2026-07-01",
      annotations: READY_DATA.annotations,
    });
  });

  it("current.totalMarketCapKrw:null → ready 유지 + null 그대로(E1)", () => {
    const nullCurrentData = { ...READY_DATA, current: { ...READY_DATA.current!, totalMarketCapKrw: null } };
    const result = buildDailyMetricsView({
      query: { status: "success", data: nullCurrentData },
      highlightedDate: null,
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.current?.totalMarketCapKrw).toBeNull();
    }
  });
});

describe("buildQuarterlyMetricsView", () => {
  const READY_DATA: QuarterlyMetricsResponse = {
    chainId: "chain-1",
    current: null,
    series: [
      {
        calendarYear: 2026,
        calendarQuarter: 2,
        totalRevenueKrw: 5000,
        coveredNodeCount: 3,
        totalNodeCount: 5,
        excludedUnmappedCount: 1,
      },
    ],
    annotations: { baseCurrency: "KRW", fxBasis: "quarter_end", revenueOverlapNotice: true },
  };

  it("current:null → ready + current null(C-8 미제공)", () => {
    const result = buildQuarterlyMetricsView({
      query: { status: "success", data: READY_DATA },
      highlightedDate: null,
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.current).toBeNull();
    }
  });
});

describe("buildNodePanelView", () => {
  it("selectedNodeId null → closed(쿼리 상태 무관)", () => {
    expect(buildNodePanelView({ selectedNodeId: null, query: { status: "success" } })).toEqual({
      status: "closed",
    });
  });

  it("pending → loading + nodeId", () => {
    expect(buildNodePanelView({ selectedNodeId: "n1", query: { status: "pending" } })).toEqual({
      status: "loading",
      nodeId: "n1",
    });
  });

  it("error → error + nodeId", () => {
    expect(buildNodePanelView({ selectedNodeId: "n1", query: { status: "error" } })).toEqual({
      status: "error",
      nodeId: "n1",
    });
  });

  it("free_subject 성공(그룹 소속) → free-subject + groupName", () => {
    const data: NodeDetailResponse = {
      nodeId: "n1",
      snapshotId: "s1",
      nodeKind: "free_subject",
      group: { groupId: "g1", name: "소재" },
      freeSubject: { name: "소비자", subjectType: "consumer", memo: "메모" },
      security: null,
      securityResolved: true,
    };
    expect(buildNodePanelView({ selectedNodeId: "n1", query: { status: "success", data } })).toEqual({
      status: "free-subject",
      data: { name: "소비자", subjectType: "consumer", memo: "메모", groupName: "소재" },
    });
  });

  it("free_subject(그룹 미소속, memo null) → groupName:null, memo:null(E8)", () => {
    const data: NodeDetailResponse = {
      nodeId: "n1",
      snapshotId: "s1",
      nodeKind: "free_subject",
      group: null,
      freeSubject: { name: "정부", subjectType: "government", memo: null },
      security: null,
      securityResolved: true,
    };
    const result = buildNodePanelView({ selectedNodeId: "n1", query: { status: "success", data } });
    expect(result).toEqual({
      status: "free-subject",
      data: { name: "정부", subjectType: "government", memo: null, groupName: null },
    });
  });

  it("listed_company + securityResolved=false → security-fallback(E1)", () => {
    const data: NodeDetailResponse = {
      nodeId: "n1",
      snapshotId: "s1",
      nodeKind: "listed_company",
      group: null,
      freeSubject: null,
      security: null,
      securityResolved: false,
    };
    expect(buildNodePanelView({ selectedNodeId: "n1", query: { status: "success", data } })).toEqual({
      status: "security-fallback",
      nodeId: "n1",
    });
  });

  it("listed_company + securityResolved=true → routing", () => {
    const data: NodeDetailResponse = {
      nodeId: "n1",
      snapshotId: "s1",
      nodeKind: "listed_company",
      group: null,
      freeSubject: null,
      security: { securityId: "sec1", ticker: "005930", market: "KRX", name: "삼성전자", listingStatus: "listed" },
      securityResolved: true,
    };
    expect(buildNodePanelView({ selectedNodeId: "n1", query: { status: "success", data } })).toEqual({
      status: "routing",
    });
  });

  it("입력 불변성 — 원본 객체 비변이", () => {
    const data: NodeDetailResponse = {
      nodeId: "n1",
      snapshotId: "s1",
      nodeKind: "free_subject",
      group: null,
      freeSubject: { name: "소비자", subjectType: "consumer", memo: null },
      security: null,
      securityResolved: true,
    };
    const frozen = Object.freeze({ ...data });
    expect(() => buildNodePanelView({ selectedNodeId: "n1", query: { status: "success", data: frozen } })).not.toThrow();
  });
});
