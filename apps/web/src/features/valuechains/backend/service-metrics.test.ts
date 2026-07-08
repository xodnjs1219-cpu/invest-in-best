import { describe, expect, it } from "vitest";
import type { IsoDate } from "@iib/domain";
import {
  getDailyMetrics,
  getQuarterlyMetrics,
  getNodeDetail,
  getChainTimelineMeta,
  getChainSnapshotAt,
  type ChainHeaderRepository,
  type NodeDetailRepository,
  type SnapshotAtRepository,
} from "@/features/valuechains/backend/service";
import { valuechainsErrorCodes } from "@/features/valuechains/backend/error";
import type { ChainMetricsRepository, RepoResult } from "@/features/valuechains/backend/repository";

const TODAY = "2026-07-06" as IsoDate;

const OFFICIAL_CHAIN = {
  id: "11111111-1111-4111-8111-111111111111",
  chain_type: "official",
  owner_id: null,
  name: "2차전지",
  focus_type: "industry",
  focus_security_id: null,
  is_archived: false,
  source_chain_id: null,
  focus_security: null,
};

const USER_CHAIN = {
  ...OFFICIAL_CHAIN,
  id: "22222222-2222-4222-8222-222222222222",
  chain_type: "user",
  owner_id: "33333333-3333-4333-8333-333333333333",
};

const ok = <T>(data: T): RepoResult<T> => ({ ok: true, data });
const err = <T>(message: string): RepoResult<T> => ({ ok: false, message });

const DAILY_ROW = {
  metric_date: "2026-07-01",
  total_market_cap_krw: "1000000",
  covered_node_count: 3,
  total_node_count: 5,
  is_carried_forward: false,
  based_on_snapshot_id: "66666666-6666-4666-8666-666666666666",
};

const QUARTERLY_ROW = {
  calendar_year: 2026,
  calendar_quarter: 2,
  total_revenue_krw: "5000000",
  covered_node_count: 3,
  total_node_count: 5,
  excluded_unmapped_count: 1,
  based_on_snapshot_id: "66666666-6666-4666-8666-666666666666",
};

const ANNOTATIONS_ROW = {
  shares_as_of_min: "2026-01-01",
  shares_as_of_max: "2026-06-01",
  all_closing_confirmed: true,
};

describe("getDailyMetrics", () => {
  const createMetricsRepo = (overrides: Partial<ChainMetricsRepository> = {}): ChainMetricsRepository => ({
    findDailySeries: async () => ok([DAILY_ROW]),
    findLatestDaily: async () => ok(DAILY_ROW),
    findDailyByDate: async () => ok(DAILY_ROW),
    findQuarterlySeries: async () => ok([QUARTERLY_ROW]),
    findLatestQuarterly: async () => ok(QUARTERLY_ROW),
    findQuarterlyByQuarter: async () => ok(QUARTERLY_ROW),
    fetchDailyAnnotations: async () => ok(ANNOTATIONS_ROW),
    ...overrides,
  });

  const createAccessRepo = (chain: unknown = OFFICIAL_CHAIN): ChainHeaderRepository => ({
    findChainById: async () => chain,
  });

  it("공식 체인 + 비로그인 + 정상 데이터 → 200 성공", async () => {
    const result = await getDailyMetrics(
      { accessRepo: createAccessRepo(), metricsRepo: createMetricsRepo() },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.current?.metricDate).toBe("2026-07-01");
      expect(result.data.series).toHaveLength(1);
      expect(result.data.annotations.baseCurrency).toBe("KRW");
    }
  });

  it("사용자 체인 비소유자 → 404 CHAIN_NOT_FOUND", async () => {
    const result = await getDailyMetrics(
      { accessRepo: createAccessRepo(USER_CHAIN), metricsRepo: createMetricsRepo() },
      { chainId: USER_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainNotFound);
    }
  });

  it("보정 후 from > to → 400 INVALID_REQUEST", async () => {
    const result = await getDailyMetrics(
      { accessRepo: createAccessRepo(), metricsRepo: createMetricsRepo() },
      {
        chainId: OFFICIAL_CHAIN.id,
        currentUserId: null,
        query: { from: "2026-07-05", to: "2026-07-01" },
        today: TODAY,
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(valuechainsErrorCodes.invalidRequest);
    }
  });

  it("집계 행 0건 → 200 + series:[] + current:null (E12)", async () => {
    const result = await getDailyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({
          findDailySeries: async () => ok([]),
          findLatestDaily: async () => ok(null),
        }),
      },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.series).toEqual([]);
      expect(result.data.current).toBeNull();
    }
  });

  it("total_market_cap_krw null 행 → totalMarketCapKrw null 그대로(E1, 0 아님)", async () => {
    const nullCapRow = { ...DAILY_ROW, total_market_cap_krw: null, covered_node_count: 0 };
    const result = await getDailyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({
          findLatestDaily: async () => ok(nullCapRow),
        }),
      },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.current?.totalMarketCapKrw).toBeNull();
      expect(result.data.current?.coveredNodeCount).toBe(0);
    }
  });

  it("is_carried_forward true 행 → isCarriedForward true 그대로(E6)", async () => {
    const carriedRow = { ...DAILY_ROW, is_carried_forward: true };
    const result = await getDailyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({ findLatestDaily: async () => ok(carriedRow) }),
      },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.current?.isCarriedForward).toBe(true);
  });

  it("annotations RPC (null,null,true) → sharesAsOfDateMin/Max null (E1)", async () => {
    const result = await getDailyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({
          fetchDailyAnnotations: async () =>
            ok({ shares_as_of_min: null, shares_as_of_max: null, all_closing_confirmed: true }),
        }),
      },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.annotations.sharesAsOfDateMin).toBeNull();
      expect(result.data.annotations.sharesAsOfDateMax).toBeNull();
    }
  });

  it("repository db_error → 500 METRICS_FETCH_ERROR (E13)", async () => {
    const result = await getDailyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({ findDailySeries: async () => err("db down") }),
      },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.metricsFetchError);
    }
  });

  it("Row 필드 누락 → 500 METRICS_VALIDATION_ERROR", async () => {
    const result = await getDailyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({ findDailySeries: async () => ok([{ metric_date: "2026-07-01" }]) }),
      },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.metricsValidationError);
    }
  });

  it("at 지정 + 해당 일자 행 존재 → current가 그 일자 행", async () => {
    const result = await getDailyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({ findDailyByDate: async () => ok(DAILY_ROW) }),
      },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: { at: "2026-07-01" }, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.current?.basedOnSnapshotId).toBe(DAILY_ROW.based_on_snapshot_id);
  });

  it("at 지정 + 행 결측 → current:null(0과 구분)", async () => {
    const result = await getDailyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({ findDailyByDate: async () => ok(null) }),
      },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: { at: "2026-07-01" }, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.current).toBeNull();
  });
});

describe("getQuarterlyMetrics", () => {
  const createMetricsRepo = (overrides: Partial<ChainMetricsRepository> = {}): ChainMetricsRepository => ({
    findDailySeries: async () => ok([]),
    findLatestDaily: async () => ok(null),
    findDailyByDate: async () => ok(null),
    findQuarterlySeries: async () => ok([QUARTERLY_ROW]),
    findLatestQuarterly: async () => ok(QUARTERLY_ROW),
    findQuarterlyByQuarter: async () => ok(QUARTERLY_ROW),
    fetchDailyAnnotations: async () => ok(ANNOTATIONS_ROW),
    ...overrides,
  });

  const createAccessRepo = (chain: unknown = OFFICIAL_CHAIN): ChainHeaderRepository => ({
    findChainById: async () => chain,
  });

  it("정상 조회 → 200, annotations.fxBasis='quarter_end'", async () => {
    const result = await getQuarterlyMetrics(
      { accessRepo: createAccessRepo(), metricsRepo: createMetricsRepo() },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.annotations.fxBasis).toBe("quarter_end");
      expect(result.data.annotations.revenueOverlapNotice).toBe(true);
    }
  });

  it("fromYear만 지정(fromQuarter 누락) → 400 INVALID_REQUEST", async () => {
    const result = await getQuarterlyMetrics(
      { accessRepo: createAccessRepo(), metricsRepo: createMetricsRepo() },
      {
        chainId: OFFICIAL_CHAIN.id,
        currentUserId: null,
        query: { fromYear: 2025 },
        today: TODAY,
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("경계 분기 절단 필터 — 범위 밖 행은 응답에서 제외된다", async () => {
    const rows = [
      { ...QUARTERLY_ROW, calendar_year: 2024, calendar_quarter: 4 }, // 하한 이전
      { ...QUARTERLY_ROW, calendar_year: 2025, calendar_quarter: 3 },
      { ...QUARTERLY_ROW, calendar_year: 2026, calendar_quarter: 4 }, // 상한 이후
    ];
    const result = await getQuarterlyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({ findQuarterlySeries: async () => ok(rows) }),
      },
      {
        chainId: OFFICIAL_CHAIN.id,
        currentUserId: null,
        query: { fromYear: 2025, fromQuarter: 1, toYear: 2026, toQuarter: 2 },
        today: TODAY,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.series).toHaveLength(1);
      expect(result.data.series[0]).toMatchObject({ calendarYear: 2025, calendarQuarter: 3 });
    }
  });

  it("at 소속 분기 행 없음 → current:null (C-8 미제공)", async () => {
    const result = await getQuarterlyMetrics(
      {
        accessRepo: createAccessRepo(),
        metricsRepo: createMetricsRepo({ findQuarterlyByQuarter: async () => ok(null) }),
      },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: { at: "2026-05-01" }, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.current).toBeNull();
  });

  it("excluded_unmapped_count 값 전달(E5)", async () => {
    const result = await getQuarterlyMetrics(
      { accessRepo: createAccessRepo(), metricsRepo: createMetricsRepo() },
      { chainId: OFFICIAL_CHAIN.id, currentUserId: null, query: {}, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.current?.excludedUnmappedCount).toBe(1);
  });
});

describe("getNodeDetail", () => {
  const createAccessRepo = (chain: unknown = OFFICIAL_CHAIN): Pick<NodeDetailRepository, "findChainById"> => ({
    findChainById: async () => chain,
  });

  const FREE_SUBJECT_ROW = {
    id: "88888888-8888-4888-8888-888888888888",
    snapshot_id: "66666666-6666-4666-8666-666666666666",
    node_kind: "free_subject",
    group_id: "77777777-7777-4777-8777-777777777777",
    subject_name: "소비자",
    subject_type: "consumer",
    subject_memo: "최종 수요층",
    chain_snapshots: { chain_id: OFFICIAL_CHAIN.id },
    snapshot_groups: { id: "77777777-7777-4777-8777-777777777777", name: "소재" },
    securities: null,
  };

  const LISTED_ROW = {
    id: "99999999-9999-4999-8999-999999999999",
    snapshot_id: "66666666-6666-4666-8666-666666666666",
    node_kind: "listed_company",
    group_id: null,
    subject_name: null,
    subject_type: null,
    subject_memo: null,
    chain_snapshots: { chain_id: OFFICIAL_CHAIN.id },
    snapshot_groups: null,
    securities: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ticker: "005930",
      market: "KRX",
      name: "삼성전자",
      listing_status: "listed",
    },
  };

  it("자유 주체 노드 → freeSubject 3필드 + group, securityResolved=true", async () => {
    const repo: NodeDetailRepository = {
      ...createAccessRepo(),
      findNodeDetailRow: async () => ({ row: FREE_SUBJECT_ROW }),
    };

    const result = await getNodeDetail(repo, { chainId: OFFICIAL_CHAIN.id, nodeId: FREE_SUBJECT_ROW.id }, null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.freeSubject).toEqual({ name: "소비자", subjectType: "consumer", memo: "최종 수요층" });
      expect(result.data.group).toEqual({ groupId: "77777777-7777-4777-8777-777777777777", name: "소재" });
      expect(result.data.security).toBeNull();
      expect(result.data.securityResolved).toBe(true);
    }
  });

  it("그룹 미소속 자유 주체 → group:null (E8)", async () => {
    const repo: NodeDetailRepository = {
      ...createAccessRepo(),
      findNodeDetailRow: async () => ({ row: { ...FREE_SUBJECT_ROW, group_id: null, snapshot_groups: null } }),
    };

    const result = await getNodeDetail(repo, { chainId: OFFICIAL_CHAIN.id, nodeId: FREE_SUBJECT_ROW.id }, null);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.group).toBeNull();
  });

  it("상장기업 노드(종목 해석 성공) → security 포함, securityResolved=true", async () => {
    const repo: NodeDetailRepository = {
      ...createAccessRepo(),
      findNodeDetailRow: async () => ({ row: LISTED_ROW }),
    };

    const result = await getNodeDetail(repo, { chainId: OFFICIAL_CHAIN.id, nodeId: LISTED_ROW.id }, null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.security).toEqual({
        securityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ticker: "005930",
        market: "KRX",
        name: "삼성전자",
        listingStatus: "listed",
      });
      expect(result.data.securityResolved).toBe(true);
      expect(result.data.freeSubject).toBeNull();
    }
  });

  it("상장기업 노드(delisted) → listingStatus 그대로 전달(E4)", async () => {
    const repo: NodeDetailRepository = {
      ...createAccessRepo(),
      findNodeDetailRow: async () => ({
        row: { ...LISTED_ROW, securities: { ...LISTED_ROW.securities, listing_status: "delisted" } },
      }),
    };

    const result = await getNodeDetail(repo, { chainId: OFFICIAL_CHAIN.id, nodeId: LISTED_ROW.id }, null);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.security?.listingStatus).toBe("delisted");
  });

  it("상장기업 노드 + securities 임베드 null → security:null, securityResolved=false (E1)", async () => {
    const repo: NodeDetailRepository = {
      ...createAccessRepo(),
      findNodeDetailRow: async () => ({ row: { ...LISTED_ROW, securities: null } }),
    };

    const result = await getNodeDetail(repo, { chainId: OFFICIAL_CHAIN.id, nodeId: LISTED_ROW.id }, null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.security).toBeNull();
      expect(result.data.securityResolved).toBe(false);
    }
  });

  it("체인 미존재 → 404 CHAIN_NOT_FOUND", async () => {
    const repo: NodeDetailRepository = {
      findChainById: async () => null,
      findNodeDetailRow: async () => ({ row: FREE_SUBJECT_ROW }),
    };

    const result = await getNodeDetail(repo, { chainId: OFFICIAL_CHAIN.id, nodeId: FREE_SUBJECT_ROW.id }, null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainNotFound);
    }
  });

  it("사용자 체인 비소유자 → 404 CHAIN_NOT_FOUND(403 아님, C-2)", async () => {
    const repo: NodeDetailRepository = {
      findChainById: async () => USER_CHAIN,
      findNodeDetailRow: async () => ({ row: FREE_SUBJECT_ROW }),
    };

    const result = await getNodeDetail(repo, { chainId: USER_CHAIN.id, nodeId: FREE_SUBJECT_ROW.id }, null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainNotFound);
    }
  });

  it("노드 미존재/타 체인 노드 → 404 NODE_NOT_FOUND (E7)", async () => {
    const repo: NodeDetailRepository = {
      ...createAccessRepo(),
      findNodeDetailRow: async () => ({ row: null }),
    };

    const result = await getNodeDetail(repo, { chainId: OFFICIAL_CHAIN.id, nodeId: "missing" }, null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.nodeNotFound);
    }
  });

  it("repository dbError → 500 INTERNAL_ERROR", async () => {
    const repo: NodeDetailRepository = {
      ...createAccessRepo(),
      findNodeDetailRow: async () => ({ dbError: "db down" }),
    };

    const result = await getNodeDetail(repo, { chainId: OFFICIAL_CHAIN.id, nodeId: "x" }, null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.internalError);
    }
  });

  it("Row 스키마 위반 → 500 INTERNAL_ERROR", async () => {
    const repo: NodeDetailRepository = {
      ...createAccessRepo(),
      findNodeDetailRow: async () => ({ row: { id: "x" } }),
    };

    const result = await getNodeDetail(repo, { chainId: OFFICIAL_CHAIN.id, nodeId: "x" }, null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
  });
});

describe("getChainTimelineMeta", () => {
  const NOW = new Date("2026-07-06T05:00:00Z"); // KST 14:00

  const MARKERS = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      effective_at: "2026-01-01T00:00:00+09:00",
      change_source: "admin_edit",
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      effective_at: "2026-05-02T09:30:00+09:00",
      change_source: "user_save",
    },
  ];

  it("공식 체인 게스트 → 200, 마커 + range.maxDate=오늘(KST)", async () => {
    const result = await getChainTimelineMeta(
      {
        accessRepo: { findChainById: async () => OFFICIAL_CHAIN },
        findMarkers: async () => ok(MARKERS),
      },
      OFFICIAL_CHAIN.id,
      null,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.range).toEqual({ minDate: "2015-01-01", maxDate: "2026-07-06" });
      expect(result.data.markers).toHaveLength(2);
      expect(result.data.markers[0]).toEqual({
        snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        effectiveAt: "2026-01-01T00:00:00+09:00",
        changeSource: "admin_edit",
      });
    }
  });

  it("사용자 체인 비소유자 → 404 CHAIN_NOT_FOUND (C-2)", async () => {
    const result = await getChainTimelineMeta(
      {
        accessRepo: { findChainById: async () => USER_CHAIN },
        findMarkers: async () => ok(MARKERS),
      },
      USER_CHAIN.id,
      null,
      NOW,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainNotFound);
    }
  });

  it("repository 오류 → 500 TIMELINE_QUERY_FAILED", async () => {
    const result = await getChainTimelineMeta(
      {
        accessRepo: { findChainById: async () => OFFICIAL_CHAIN },
        findMarkers: async () => err("db down"),
      },
      OFFICIAL_CHAIN.id,
      null,
      NOW,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.timelineQueryFailed);
    }
  });
});

describe("getChainSnapshotAt", () => {
  const SNAPSHOT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const GROUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
  const NODE1_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
  const NODE2_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
  const SECURITY_ID = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
  const EDGE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
  const RELATION_TYPE_ID = "ffffffff-ffff-4fff-8fff-fffffffffff1";

  const SNAPSHOT_STRUCTURE = {
    snapshot: { id: SNAPSHOT_ID, effective_at: "2026-05-02T09:30:00+09:00", change_source: "admin_edit" },
    groups: [{ id: GROUP_ID, name: "소재" }],
    nodes: [
      {
        id: NODE1_ID,
        group_id: GROUP_ID,
        node_kind: "listed_company",
        subject_name: null,
        subject_type: null,
        subject_memo: null,
        position_x: 10,
        position_y: 20,
        security: {
          id: SECURITY_ID,
          ticker: "005930",
          name: "삼성전자",
          market: "KRX",
          listing_status: "listed",
        },
      },
      {
        id: NODE2_ID,
        group_id: null,
        node_kind: "free_subject",
        subject_name: "소비자",
        subject_type: "consumer",
        subject_memo: null,
        position_x: null,
        position_y: null,
        security: null,
      },
    ],
    edges: [
      {
        id: EDGE_ID,
        source_node_id: NODE1_ID,
        target_node_id: NODE2_ID,
        relation_type: { id: RELATION_TYPE_ID, name: "공급", is_directed: true, is_active: false },
      },
    ],
  };

  const createRepo = (overrides: Partial<SnapshotAtRepository> = {}): SnapshotAtRepository => ({
    findChainById: async () => OFFICIAL_CHAIN,
    findSnapshotStructureAt: async () => ok(SNAPSHOT_STRUCTURE),
    findDailyMetricAt: async () => ok(null),
    findQuarterlyMetric: async () => ok(null),
    ...overrides,
  });

  it("정상 복원 → 200, 노드/엣지/그룹 DTO 변환 정확성", async () => {
    const result = await getChainSnapshotAt(createRepo(), OFFICIAL_CHAIN.id, "2026-05-02" as IsoDate, null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.snapshot.snapshotId).toBe(SNAPSHOT_ID);
      expect(result.data.snapshot.nodes[0]).toMatchObject({
        id: NODE1_ID,
        nodeKind: "listed_company",
        security: { ticker: "005930" },
        positionX: 10,
        positionY: 20,
      });
      expect(result.data.snapshot.nodes[1]).toMatchObject({
        nodeKind: "free_subject",
        subjectName: "소비자",
        security: null,
      });
      expect(result.data.snapshot.edges[0].relationType).toEqual({
        id: RELATION_TYPE_ID,
        name: "공급",
        isDirected: true,
        isActive: false,
      });
    }
  });

  it("스냅샷 없음(RPC null) → 404 SNAPSHOT_NOT_FOUND", async () => {
    const result = await getChainSnapshotAt(
      createRepo({ findSnapshotStructureAt: async () => ok(null) }),
      OFFICIAL_CHAIN.id,
      "2014-06-01" as IsoDate,
      null,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.snapshotNotFound);
    }
  });

  it("archived 체인 → 404 CHAIN_NOT_FOUND", async () => {
    const result = await getChainSnapshotAt(
      createRepo({ findChainById: async () => ({ ...OFFICIAL_CHAIN, is_archived: true }) }),
      OFFICIAL_CHAIN.id,
      "2026-05-02" as IsoDate,
      null,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(valuechainsErrorCodes.chainNotFound);
  });

  it("일별 지표 행이 D-3일자(휴장) → isCarriedForward:true, metricDate:D-3", async () => {
    const result = await getChainSnapshotAt(
      createRepo({
        findDailyMetricAt: async () =>
          ok({
            metric_date: "2026-04-29",
            total_market_cap_krw: "1000000",
            covered_node_count: 1,
            total_node_count: 2,
            is_carried_forward: false,
            based_on_snapshot_id: SNAPSHOT_ID,
          }),
      }),
      OFFICIAL_CHAIN.id,
      "2026-05-02" as IsoDate,
      null,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.metrics.daily?.metricDate).toBe("2026-04-29");
      expect(result.data.metrics.daily?.isCarriedForward).toBe(true);
    }
  });

  it("일별/분기 지표 미존재 → daily:null / quarterly:null(0 아님, C-8)", async () => {
    const result = await getChainSnapshotAt(createRepo(), OFFICIAL_CHAIN.id, "2026-05-02" as IsoDate, null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.metrics.daily).toBeNull();
      expect(result.data.metrics.quarterly).toBeNull();
    }
  });

  it("비활성 관계 종류 엣지 → 포함 + isActive:false + 최신 이름", async () => {
    const result = await getChainSnapshotAt(createRepo(), OFFICIAL_CHAIN.id, "2026-05-02" as IsoDate, null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.snapshot.edges[0].relationType.isActive).toBe(false);
      expect(result.data.snapshot.edges[0].relationType.name).toBe("공급");
    }
  });

  it("repository ok:false → 500 TIMELINE_QUERY_FAILED", async () => {
    const result = await getChainSnapshotAt(
      createRepo({ findSnapshotStructureAt: async () => err("rpc failed") }),
      OFFICIAL_CHAIN.id,
      "2026-05-02" as IsoDate,
      null,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.timelineQueryFailed);
    }
  });

  it("position_x/y → positionX/Y snake→camel 매핑 정확성", async () => {
    const result = await getChainSnapshotAt(createRepo(), OFFICIAL_CHAIN.id, "2026-05-02" as IsoDate, null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.snapshot.nodes[0].positionX).toBe(10);
      expect(result.data.snapshot.nodes[0].positionY).toBe(20);
    }
  });
});
