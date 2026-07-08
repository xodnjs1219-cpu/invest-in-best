import { describe, expect, it } from "vitest";
import {
  checkChainAccess,
  getChainView,
  listMyChainCards,
  listOfficialChainCards,
  type ChainCardsRepository,
} from "@/features/valuechains/backend/service";
import { valuechainListErrorCodes, valuechainsErrorCodes } from "@/features/valuechains/backend/error";
import type { ValuechainsViewRepository } from "@/features/valuechains/backend/repository";
import { RepositoryError } from "@/features/valuechains/backend/repository";

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
} as const;

const USER_CHAIN = {
  id: "22222222-2222-4222-8222-222222222222",
  chain_type: "user",
  owner_id: "33333333-3333-4333-8333-333333333333",
  name: "내 체인",
  focus_type: "company",
  focus_security_id: "55555555-5555-4555-8555-555555555555",
  is_archived: false,
  source_chain_id: null,
  focus_security: {
    id: "55555555-5555-4555-8555-555555555555",
    ticker: "005930",
    name: "삼성전자",
    market: "KRX",
  },
} as const;

const SNAPSHOT = {
  id: "66666666-6666-4666-8666-666666666666",
  chain_id: "11111111-1111-4111-8111-111111111111",
  effective_at: "2026-07-01T09:30:00+09:00",
  change_source: "admin_edit",
};

const GROUPS = [{ id: "77777777-7777-4777-8777-777777777777", name: "소재" }];

const NODES = [
  {
    id: "88888888-8888-4888-8888-888888888888",
    group_id: "77777777-7777-4777-8777-777777777777",
    node_kind: "listed_company",
    security_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    subject_name: null,
    subject_type: null,
    subject_memo: null,
    position_x: 120.5,
    position_y: -80,
    security: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ticker: "005930", name: "삼성전자", market: "KRX", listing_status: "listed" },
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    group_id: null,
    node_kind: "free_subject",
    security_id: null,
    subject_name: "소비자",
    subject_type: "consumer",
    subject_memo: "최종 수요층",
    position_x: null,
    position_y: null,
    security: null,
  },
];

const EDGES = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    source_node_id: "88888888-8888-4888-8888-888888888888",
    target_node_id: "99999999-9999-4999-8999-999999999999",
    relation_type: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "공급", is_directed: true, is_active: true },
  },
];

type RepoOverrides = Partial<{
  [K in keyof ValuechainsViewRepository]: ValuechainsViewRepository[K];
}>;

const createRepo = (overrides: RepoOverrides = {}): ValuechainsViewRepository => ({
  findChainById: async () => OFFICIAL_CHAIN,
  findLatestSnapshot: async () => SNAPSHOT,
  findSnapshotGroups: async () => GROUPS,
  findSnapshotNodes: async () => NODES,
  findSnapshotEdges: async () => EDGES,
  findLatestBatchSuccessAt: async () => null,
  ...overrides,
});

describe("checkChainAccess", () => {
  it("보관된 체인은 official이어도 불허한다", () => {
    const result = checkChainAccess({ ...OFFICIAL_CHAIN, is_archived: true }, null);
    expect(result).toEqual({ allowed: false });
  });

  it("official 체인은 비로그인도 허용하고 isOwner=false", () => {
    const result = checkChainAccess(OFFICIAL_CHAIN, null);
    expect(result).toEqual({ allowed: true, isOwner: false });
  });

  it("official 체인은 로그인 사용자도 허용하고 isOwner=false", () => {
    const result = checkChainAccess(OFFICIAL_CHAIN, "12121212-1212-4212-8212-121212121212");
    expect(result).toEqual({ allowed: true, isOwner: false });
  });

  it("user 체인 + 비로그인은 불허한다 (C-2)", () => {
    const result = checkChainAccess(USER_CHAIN, null);
    expect(result).toEqual({ allowed: false });
  });

  it("user 체인 + 비소유자 로그인은 불허한다 (C-2)", () => {
    const result = checkChainAccess(USER_CHAIN, "44444444-4444-4444-8444-444444444444");
    expect(result).toEqual({ allowed: false });
  });

  it("user 체인 + 소유자는 허용하고 isOwner=true", () => {
    const result = checkChainAccess(USER_CHAIN, "33333333-3333-4333-8333-333333333333");
    expect(result).toEqual({ allowed: true, isOwner: true });
  });
});

describe("getChainView", () => {
  it("공식 체인 + Guest → 200 성공, chain.isOwner=false", async () => {
    const repo = createRepo();

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chain.isOwner).toBe(false);
      expect(result.data.chain.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(result.data.groups).toEqual([{ id: "77777777-7777-4777-8777-777777777777", name: "소재" }]);
    }
  });

  it("보관된 공식 체인 → 404 CHAIN_NOT_FOUND (E1/BR-1)", async () => {
    const repo = createRepo({
      findChainById: async () => ({ ...OFFICIAL_CHAIN, is_archived: true }),
    });

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainNotFound);
    }
  });

  it("미존재 체인 → 404 CHAIN_NOT_FOUND (E1)", async () => {
    const repo = createRepo({ findChainById: async () => null });

    const result = await getChainView(repo, "00000000-0000-4000-8000-000000000000", null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainNotFound);
    }
  });

  it("사용자 체인 + 비로그인 → 404 CHAIN_NOT_FOUND (C-2, 401 아님)", async () => {
    const repo = createRepo({ findChainById: async () => USER_CHAIN });

    const result = await getChainView(repo, "22222222-2222-4222-8222-222222222222", null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainNotFound);
    }
  });

  it("사용자 체인 + 비소유자 로그인 → 404 CHAIN_NOT_FOUND (C-2, 403 아님)", async () => {
    const repo = createRepo({ findChainById: async () => USER_CHAIN });

    const result = await getChainView(repo, "22222222-2222-4222-8222-222222222222", "44444444-4444-4444-8444-444444444444");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainNotFound);
    }
  });

  it("사용자 체인 + 소유자 → 200 성공, isOwner=true", async () => {
    const repo = createRepo({
      findChainById: async () => USER_CHAIN,
      findLatestSnapshot: async () => ({ ...SNAPSHOT, chain_id: "22222222-2222-4222-8222-222222222222" }),
    });

    const result = await getChainView(repo, "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chain.isOwner).toBe(true);
      expect(result.data.chain.focusSecurity).toEqual({
        id: "55555555-5555-4555-8555-555555555555",
        ticker: "005930",
        name: "삼성전자",
        market: "KRX",
      });
    }
  });

  it("스냅샷 0건 → 500 SNAPSHOT_MISSING (E9)", async () => {
    const repo = createRepo({ findLatestSnapshot: async () => null });

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.snapshotMissing);
    }
  });

  it("repository가 RepositoryError를 throw하면 500 STRUCTURE_LOAD_FAILED (E8)", async () => {
    const repo = createRepo({
      findSnapshotNodes: async () => {
        throw new RepositoryError("db down");
      },
    });

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.structureLoadFailed);
    }
  });

  it("Row 스키마 검증 실패(체인 필드 결손) → 500 STRUCTURE_LOAD_FAILED", async () => {
    const repo = createRepo({
      findChainById: async () => ({ id: "11111111-1111-4111-8111-111111111111" }), // 필수 필드 결손
    });

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.structureLoadFailed);
    }
  });

  it("snake→camel 변환 정확성: position_x/y → position.{x,y}, relation_type.is_directed → relationType.isDirected", async () => {
    const repo = createRepo();

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.nodes.find((n) => n.id === "88888888-8888-4888-8888-888888888888");
      expect(node?.position).toEqual({ x: 120.5, y: -80 });
      const edge = result.data.edges[0];
      expect(edge?.relationType.isDirected).toBe(true);
      expect(edge?.sourceNodeId).toBe("88888888-8888-4888-8888-888888888888");
      expect(edge?.targetNodeId).toBe("99999999-9999-4999-8999-999999999999");
    }
  });

  it("position_x만 있고 position_y=null인 노드 → position: null (E11 방어)", async () => {
    const repo = createRepo({
      findSnapshotNodes: async () => [
        { ...NODES[0], position_x: 10, position_y: null },
      ],
    });

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.nodes[0]?.position).toBeNull();
    }
  });

  it("focus_type='industry' → focusSecurity: null", async () => {
    const repo = createRepo();

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chain.focusSecurity).toBeNull();
    }
  });

  it("비활성 관계 종류 엣지 → 응답에 포함되고 relationType.isActive=false (E5)", async () => {
    const repo = createRepo({
      findSnapshotEdges: async () => [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          source_node_id: "88888888-8888-4888-8888-888888888888",
          target_node_id: "99999999-9999-4999-8999-999999999999",
          relation_type: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", name: "구경쟁", is_directed: false, is_active: false },
        },
      ],
    });

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.edges[0]?.relationType.isActive).toBe(false);
    }
  });

  it("빈 그룹·고립 노드·그룹 미소속 노드 → 응답에 그대로 포함 (E6/E7)", async () => {
    const repo = createRepo({
      findSnapshotGroups: async () => [{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "빈 그룹" }],
      findSnapshotEdges: async () => [],
    });

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.groups).toEqual([{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "빈 그룹" }]);
      expect(result.data.edges).toEqual([]);
      expect(result.data.nodes).toHaveLength(2);
    }
  });

  it("batch_runs 이력 전무 → lastCollectedAt 3필드 모두 null, 나머지 응답 정상 (E13)", async () => {
    const repo = createRepo({ findLatestBatchSuccessAt: async () => null });

    const result = await getChainView(repo, "11111111-1111-4111-8111-111111111111", null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dataFreshness.lastCollectedAt).toEqual({
        quotes: null,
        financials: null,
        fxAndMarketHours: null,
      });
      expect(result.data.dataFreshness.sources).toEqual([
        "금융감독원 DART",
        "SEC EDGAR",
        "토스증권",
      ]);
    }
  });
});

describe("listOfficialChainCards / listMyChainCards (UC-007)", () => {
  const VALID_ROW = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "반도체 밸류체인",
    chain_type: "official",
    focus_type: "company",
    focus_company_name: "삼성전자",
    node_count: 3,
    metric_date: "2026-07-08",
    total_market_cap_krw: "123456789012345.67",
    covered_node_count: 2,
    total_node_count: 3,
    is_carried_forward: false,
    updated_at: "2026-07-08T00:00:00Z",
    total_count: 2,
  };

  const createCardsRepo = (
    impl: (params: {
      chainType: "official" | "user";
      ownerId: string | null;
      limit: number;
      offset: number;
    }) => Promise<{ rows: unknown[]; error: string | null }>,
  ): ChainCardsRepository => ({ findChainCards: impl });

  it("정상 2행 → 200 success, snake_case→camelCase 전 필드 매핑이 정확하다", async () => {
    const repo = createCardsRepo(async () => ({
      rows: [VALID_ROW, { ...VALID_ROW, id: "22222222-2222-4222-8222-222222222222" }],
      error: null,
    }));

    const result = await listOfficialChainCards(repo, { page: 1, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0]).toEqual({
        id: VALID_ROW.id,
        name: "반도체 밸류체인",
        chainType: "official",
        focusType: "company",
        focusCompanyName: "삼성전자",
        nodeCount: 3,
        latestMetric: {
          metricDate: "2026-07-08",
          totalMarketCapKrw: "123456789012345.67",
          coveredNodeCount: 2,
          totalNodeCount: 3,
          isCarriedForward: false,
        },
        updatedAt: "2026-07-08T00:00:00Z",
      });
    }
  });

  it("0행 → items:[], totalCount:0, hasMore:false (엣지 1)", async () => {
    const repo = createCardsRepo(async () => ({ rows: [], error: null }));

    const result = await listOfficialChainCards(repo, { page: 1, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual([]);
      expect(result.data.pagination).toEqual({ page: 1, limit: 20, totalCount: 0, hasMore: false });
    }
  });

  it("metric_date=null인 row → latestMetric=null(0 아님, 엣지 3)", async () => {
    const repo = createCardsRepo(async () => ({
      rows: [{ ...VALID_ROW, metric_date: null, total_market_cap_krw: null, covered_node_count: null, total_node_count: null, is_carried_forward: null }],
      error: null,
    }));

    const result = await listOfficialChainCards(repo, { page: 1, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].latestMetric).toBeNull();
    }
  });

  it("metric_date는 있으나 total_market_cap_krw가 null이면 latestMetric=null(방어 규칙)", async () => {
    const repo = createCardsRepo(async () => ({
      rows: [{ ...VALID_ROW, total_market_cap_krw: null }],
      error: null,
    }));

    const result = await listOfficialChainCards(repo, { page: 1, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].latestMetric).toBeNull();
    }
  });

  it("is_carried_forward=true인 row → latestMetric.isCarriedForward=true", async () => {
    const repo = createCardsRepo(async () => ({
      rows: [{ ...VALID_ROW, is_carried_forward: true }],
      error: null,
    }));

    const result = await listOfficialChainCards(repo, { page: 1, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].latestMetric?.isCarriedForward).toBe(true);
    }
  });

  it("node_count=0인 row → nodeCount=0으로 카드 정상 생성(엣지 9)", async () => {
    const repo = createCardsRepo(async () => ({
      rows: [{ ...VALID_ROW, node_count: 0, metric_date: null, total_market_cap_krw: null, covered_node_count: null, total_node_count: null, is_carried_forward: null }],
      error: null,
    }));

    const result = await listOfficialChainCards(repo, { page: 1, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].nodeCount).toBe(0);
    }
  });

  it("repository error → failure(500, VALUECHAIN_LIST_FETCH_FAILED)", async () => {
    const repo = createCardsRepo(async () => ({ rows: [], error: "db down" }));

    const result = await listOfficialChainCards(repo, { page: 1, limit: 20 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainListErrorCodes.fetchFailed);
    }
  });

  it("Row 스키마 위반(id가 uuid 아님) → failure(500, VALUECHAIN_LIST_VALIDATION_ERROR)", async () => {
    const repo = createCardsRepo(async () => ({
      rows: [{ ...VALID_ROW, id: "not-a-uuid" }],
      error: null,
    }));

    const result = await listOfficialChainCards(repo, { page: 1, limit: 20 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainListErrorCodes.validationError);
    }
  });

  it("page=2, limit=20 → repository에 offset=20이 전달된다", async () => {
    let capturedOffset: number | undefined;
    const repo = createCardsRepo(async (params) => {
      capturedOffset = params.offset;
      return { rows: [], error: null };
    });

    await listOfficialChainCards(repo, { page: 2, limit: 20 });

    expect(capturedOffset).toBe(20);
  });

  it("totalCount=41, page=2, limit=20 → hasMore=true", async () => {
    const repo = createCardsRepo(async () => ({
      rows: [{ ...VALID_ROW, total_count: 41 }],
      error: null,
    }));

    const result = await listOfficialChainCards(repo, { page: 2, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pagination.hasMore).toBe(true);
    }
  });

  it("totalCount=40, page=2, limit=20 → hasMore=false", async () => {
    const repo = createCardsRepo(async () => ({
      rows: [{ ...VALID_ROW, total_count: 40 }],
      error: null,
    }));

    const result = await listOfficialChainCards(repo, { page: 2, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pagination.hasMore).toBe(false);
    }
  });

  it("listMyChainCards는 ownerId와 chainType='user'를 repository에 정확히 전달한다", async () => {
    let capturedParams: { chainType: string; ownerId: string | null } | undefined;
    const repo = createCardsRepo(async (params) => {
      capturedParams = params;
      return { rows: [], error: null };
    });

    await listMyChainCards(repo, "user-123", { page: 1, limit: 20 });

    expect(capturedParams).toEqual(
      expect.objectContaining({ chainType: "user", ownerId: "user-123" }),
    );
  });

  it("listMyChainCards 정상 응답의 chainType은 'user'다", async () => {
    const repo = createCardsRepo(async () => ({
      rows: [{ ...VALID_ROW, chain_type: "user" }],
      error: null,
    }));

    const result = await listMyChainCards(repo, "user-123", { page: 1, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].chainType).toBe("user");
    }
  });
});
