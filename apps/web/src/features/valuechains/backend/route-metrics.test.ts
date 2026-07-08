import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const getDailyMetricsMock = vi.hoisted(() => vi.fn());
const getQuarterlyMetricsMock = vi.hoisted(() => vi.fn());
const getNodeDetailMock = vi.hoisted(() => vi.fn());
const getChainTimelineMetaMock = vi.hoisted(() => vi.fn());
const getChainSnapshotAtMock = vi.hoisted(() => vi.fn());
const getChainViewMock = vi.hoisted(() => vi.fn());
const listOfficialChainCardsMock = vi.hoisted(() => vi.fn());
const listMyChainCardsMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/valuechains/backend/service", () => ({
  getDailyMetrics: getDailyMetricsMock,
  getQuarterlyMetrics: getQuarterlyMetricsMock,
  getNodeDetail: getNodeDetailMock,
  getChainTimelineMeta: getChainTimelineMetaMock,
  getChainSnapshotAt: getChainSnapshotAtMock,
  getChainView: getChainViewMock,
  listOfficialChainCards: listOfficialChainCardsMock,
  listMyChainCards: listMyChainCardsMock,
}));

vi.mock("@/features/valuechains/backend/repository", () => ({
  createValuechainsViewRepository: () => ({ findChainById: vi.fn() }),
  createChainMetricsRepository: () => ({}),
  findChainCards: vi.fn(),
  findNodeDetailRow: vi.fn(),
  findSnapshotMarkers: vi.fn(),
  findSnapshotStructureAt: vi.fn(),
  findDailyMetricAt: vi.fn(),
  findQuarterlyMetric: vi.fn(),
}));

const { registerValuechainsRoutes } = await import("@/features/valuechains/backend/route");

const VALID_CHAIN_ID = "11111111-1111-4111-8111-111111111111";
const VALID_NODE_ID = "22222222-2222-4222-8222-222222222222";

const buildApp = (user: { id: string } | null = null) => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", { mocked: "supabase" } as never);
    c.set("supabaseAuth", {} as never);
    c.set("user", user);
    c.set("logger", { debug() {}, info() {}, warn() {}, error() {} });
    c.set("config", {
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
      supabaseServiceRoleKey: "service-role",
      adminSeedEmails: [],
      origin: "https://app.example.com",
    });
    await next();
  });
  registerValuechainsRoutes(app);
  return app;
};

describe("GET /valuechains/:chainId/metrics/daily", () => {
  beforeEach(() => {
    getDailyMetricsMock.mockReset();
  });

  it("정상 요청 → 200, service 호출", async () => {
    getDailyMetricsMock.mockResolvedValue({ ok: true, status: 200, data: { chainId: VALID_CHAIN_ID } });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/metrics/daily`);

    expect(res.status).toBe(200);
    expect(getDailyMetricsMock).toHaveBeenCalled();
  });

  it("chainId UUID 형식 오류 → 400, service 미호출", async () => {
    const app = buildApp();

    const res = await app.request("/valuechains/not-a-uuid/metrics/daily");

    expect(res.status).toBe(400);
    expect(getDailyMetricsMock).not.toHaveBeenCalled();
  });

  it("from > to 형식 오류 쿼리 → 400 (형식 오류 자체 검증)", async () => {
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/metrics/daily?from=2026/01/01`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("서비스 404 응답을 그대로 전달한다", async () => {
    getDailyMetricsMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: "CHAIN_NOT_FOUND", message: "체인을 찾을 수 없습니다." },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/metrics/daily`);

    expect(res.status).toBe(404);
  });
});

describe("GET /valuechains/:chainId/metrics/quarterly", () => {
  beforeEach(() => {
    getQuarterlyMetricsMock.mockReset();
  });

  it("정상 요청 → 200", async () => {
    getQuarterlyMetricsMock.mockResolvedValue({ ok: true, status: 200, data: { chainId: VALID_CHAIN_ID } });
    const app = buildApp();

    const res = await app.request(
      `/valuechains/${VALID_CHAIN_ID}/metrics/quarterly?fromYear=2025&fromQuarter=1&toYear=2026&toQuarter=2`,
    );

    expect(res.status).toBe(200);
  });

  it("fromYear만 지정(fromQuarter 누락) → 400", async () => {
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/metrics/quarterly?fromYear=2025`);

    expect(res.status).toBe(400);
    expect(getQuarterlyMetricsMock).not.toHaveBeenCalled();
  });
});

describe("GET /valuechains/:chainId/nodes/:nodeId", () => {
  beforeEach(() => {
    getNodeDetailMock.mockReset();
  });

  it("정상 요청 → 200", async () => {
    getNodeDetailMock.mockResolvedValue({ ok: true, status: 200, data: { nodeId: VALID_NODE_ID } });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/nodes/${VALID_NODE_ID}`);

    expect(res.status).toBe(200);
    expect(getNodeDetailMock).toHaveBeenCalledWith(
      expect.anything(),
      { chainId: VALID_CHAIN_ID, nodeId: VALID_NODE_ID },
      null,
    );
  });

  it("nodeId UUID 형식 오류 → 400 INVALID_PARAMS", async () => {
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/nodes/not-a-uuid`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_PARAMS");
    expect(getNodeDetailMock).not.toHaveBeenCalled();
  });

  it("로그인 사용자면 currentUserId를 서비스에 전달한다", async () => {
    getNodeDetailMock.mockResolvedValue({ ok: true, status: 200, data: {} });
    const app = buildApp({ id: "user-1" });

    await app.request(`/valuechains/${VALID_CHAIN_ID}/nodes/${VALID_NODE_ID}`);

    expect(getNodeDetailMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), "user-1");
  });

  it("404 NODE_NOT_FOUND를 그대로 전달한다", async () => {
    getNodeDetailMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: "NODE_NOT_FOUND", message: "노드를 찾을 수 없습니다." },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/nodes/${VALID_NODE_ID}`);

    expect(res.status).toBe(404);
  });
});

describe("GET /valuechains/:chainId/timeline", () => {
  beforeEach(() => {
    getChainTimelineMetaMock.mockReset();
  });

  it("정상 요청 → 200", async () => {
    getChainTimelineMetaMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { range: { minDate: "2015-01-01", maxDate: "2026-07-06" }, markers: [] },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/timeline`);

    expect(res.status).toBe(200);
  });

  it("chainId 형식 오류 → 400 INVALID_CHAIN_ID", async () => {
    const app = buildApp();

    const res = await app.request("/valuechains/abc/timeline");

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CHAIN_ID");
  });
});

describe("GET /valuechains/:chainId/snapshot-at", () => {
  beforeEach(() => {
    getChainSnapshotAtMock.mockReset();
  });

  it("정상 요청(date=2026-05-02) → 200", async () => {
    getChainSnapshotAtMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { snapshot: {}, metrics: { daily: null, quarterly: null } },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshot-at?date=2026-05-02`);

    expect(res.status).toBe(200);
  });

  it("date 형식 오류(2026/05/02) → 400 INVALID_DATE", async () => {
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshot-at?date=2026/05/02`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_DATE");
    expect(getChainSnapshotAtMock).not.toHaveBeenCalled();
  });

  it("date 누락 → 400 INVALID_DATE", async () => {
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshot-at`);

    expect(res.status).toBe(400);
  });

  it("2015-01-01 이전 날짜 → 400 DATE_OUT_OF_RANGE", async () => {
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshot-at?date=2014-12-31`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("DATE_OUT_OF_RANGE");
    expect(getChainSnapshotAtMock).not.toHaveBeenCalled();
  });

  it("미래 날짜 → 400 DATE_OUT_OF_RANGE", async () => {
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshot-at?date=2099-01-01`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("DATE_OUT_OF_RANGE");
  });

  it("404 SNAPSHOT_NOT_FOUND를 그대로 전달한다", async () => {
    getChainSnapshotAtMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: "SNAPSHOT_NOT_FOUND", message: "스냅샷을 찾을 수 없습니다." },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshot-at?date=2020-01-01`);

    expect(res.status).toBe(404);
  });

  it("응답 body에 details를 노출하지 않는다", async () => {
    getChainSnapshotAtMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: { code: "TIMELINE_QUERY_FAILED", message: "오류", details: { secret: 1 } },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshot-at?date=2020-01-01`);

    const body = (await res.json()) as { error: { details?: unknown } };
    expect(body.error.details).toBeUndefined();
  });
});
