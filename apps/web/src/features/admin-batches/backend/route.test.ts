import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const listBatchRunsMock = vi.hoisted(() => vi.fn());
const getBatchRunDetailMock = vi.hoisted(() => vi.fn());
const listBatchRunFailuresMock = vi.hoisted(() => vi.fn());
const getBackfillProgressMock = vi.hoisted(() => vi.fn());
const withAdminAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/admin-batches/backend/service", () => ({
  listBatchRuns: listBatchRunsMock,
  getBatchRunDetail: getBatchRunDetailMock,
  listBatchRunFailures: listBatchRunFailuresMock,
  getBackfillProgress: getBackfillProgressMock,
}));

const ADMIN_USER = { id: "admin-1", email: "admin@example.com" };

vi.mock("@/backend/middleware/admin", () => ({
  withAdminAuth: () => withAdminAuthMock,
  adminAuthErrorCodes: { unauthorized: "UNAUTHORIZED", adminOnly: "ADMIN_ONLY" },
}));

const { registerAdminBatchRoutes } = await import("@/features/admin-batches/backend/route");

const RUN_ID = "11111111-1111-4111-8111-111111111111";

const buildApp = (options?: { adminUser?: typeof ADMIN_USER | null }) => {
  const adminUser = options?.adminUser === undefined ? ADMIN_USER : options.adminUser;
  withAdminAuthMock.mockImplementation(async (c, next) => {
    if (!adminUser) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }, 401);
    }
    c.set("adminUser", adminUser);
    await next();
  });

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", {} as never);
    c.set("supabaseAuth", {} as never);
    c.set("logger", { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
    c.set("config", {
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
      supabaseServiceRoleKey: "service-role",
      adminSeedEmails: [],
      origin: "https://app.example.com",
    });
    await next();
  });
  registerAdminBatchRoutes(app);
  return app;
};

describe("GET /admin/batches/runs", () => {
  beforeEach(() => {
    listBatchRunsMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("유효 쿼리로 요청 시 listBatchRuns 결과를 200으로 응답한다", async () => {
    listBatchRunsMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { runs: [], pagination: { page: 1, pageSize: 20, totalCount: 0 } },
    });
    const app = buildApp();

    const res = await app.request("/admin/batches/runs?jobType=collect_financials&status=partial_success");

    expect(res.status).toBe(200);
    expect(listBatchRunsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ jobType: "collect_financials", status: "partial_success" }),
      expect.any(Date),
    );
  });

  it("정의되지 않은 jobType이면 400 VALIDATION_ERROR를 반환하고 서비스는 호출하지 않는다(E9)", async () => {
    const app = buildApp();

    const res = await app.request("/admin/batches/runs?jobType=banana");
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(listBatchRunsMock).not.toHaveBeenCalled();
  });

  it("from > to면 400을 반환한다(E9)", async () => {
    const app = buildApp();

    const res = await app.request(
      "/admin/batches/runs?from=2026-07-05T00:00:00%2B09:00&to=2026-07-01T00:00:00%2B09:00",
    );

    expect(res.status).toBe(400);
  });

  it("page=0이면 400을 반환한다(E9)", async () => {
    const app = buildApp();

    const res = await app.request("/admin/batches/runs?page=0");

    expect(res.status).toBe(400);
  });

  it("withAdminAuth 미들웨어가 그룹 레벨로 적용되어 비인증 요청은 401을 반환한다(E6)", async () => {
    const app = buildApp({ adminUser: null });

    const res = await app.request("/admin/batches/runs");
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(listBatchRunsMock).not.toHaveBeenCalled();
  });
});

describe("GET /admin/batches/runs/:runId", () => {
  beforeEach(() => {
    getBatchRunDetailMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("유효 runId로 요청 시 200을 반환한다", async () => {
    getBatchRunDetailMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { run: { id: RUN_ID } },
    });
    const app = buildApp();

    const res = await app.request(`/admin/batches/runs/${RUN_ID}`);

    expect(res.status).toBe(200);
    expect(getBatchRunDetailMock).toHaveBeenCalledWith(expect.anything(), RUN_ID);
  });

  it("uuid 형식이 아니면 400을 반환한다", async () => {
    const app = buildApp();

    const res = await app.request("/admin/batches/runs/not-a-uuid");

    expect(res.status).toBe(400);
    expect(getBatchRunDetailMock).not.toHaveBeenCalled();
  });

  it("서비스가 404 RUN_NOT_FOUND를 반환하면 그대로 전달한다(E8)", async () => {
    getBatchRunDetailMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: "RUN_NOT_FOUND", message: "실행 이력을 찾을 수 없습니다." },
    });
    const app = buildApp();

    const res = await app.request(`/admin/batches/runs/${RUN_ID}`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "RUN_NOT_FOUND", message: "실행 이력을 찾을 수 없습니다." } });
  });
});

describe("GET /admin/batches/runs/:runId/failures", () => {
  beforeEach(() => {
    listBatchRunFailuresMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("유효 요청 시 200을 반환한다", async () => {
    listBatchRunFailuresMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { failures: [], pagination: { page: 1, pageSize: 20, totalCount: 0 } },
    });
    const app = buildApp();

    const res = await app.request(`/admin/batches/runs/${RUN_ID}/failures`);

    expect(res.status).toBe(200);
    expect(listBatchRunFailuresMock).toHaveBeenCalledWith(
      expect.anything(),
      RUN_ID,
      expect.objectContaining({ page: 1 }),
    );
  });

  it("uuid 형식이 아닌 runId는 400을 반환한다", async () => {
    const app = buildApp();

    const res = await app.request("/admin/batches/runs/not-a-uuid/failures");

    expect(res.status).toBe(400);
    expect(listBatchRunFailuresMock).not.toHaveBeenCalled();
  });

  it("서비스가 404를 반환하면 그대로 전달한다", async () => {
    listBatchRunFailuresMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: "RUN_NOT_FOUND", message: "실행 이력을 찾을 수 없습니다." },
    });
    const app = buildApp();

    const res = await app.request(`/admin/batches/runs/${RUN_ID}/failures`);

    expect(res.status).toBe(404);
  });
});

describe("GET /admin/batches/backfill/progress", () => {
  beforeEach(() => {
    getBackfillProgressMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("파라미터 없이 요청 시 200을 반환한다", async () => {
    getBackfillProgressMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { totalCheckpoints: 0, completedCheckpoints: 0, isCompleted: false, latestRun: null },
    });
    const app = buildApp();

    const res = await app.request("/admin/batches/backfill/progress");

    expect(res.status).toBe(200);
    expect(getBackfillProgressMock).toHaveBeenCalledWith(expect.anything());
  });

  it("비로그인 요청은 401을 반환한다", async () => {
    const app = buildApp({ adminUser: null });

    const res = await app.request("/admin/batches/backfill/progress");

    expect(res.status).toBe(401);
    expect(getBackfillProgressMock).not.toHaveBeenCalled();
  });
});

describe("쓰기 메서드 미등록(E7)", () => {
  beforeEach(() => {
    withAdminAuthMock.mockReset();
  });

  it("POST /admin/batches/runs/:runId/rerun 등 임의 쓰기 호출은 404를 반환한다", async () => {
    const app = buildApp();

    const res = await app.request(`/admin/batches/runs/${RUN_ID}/rerun`, { method: "POST" });

    expect(res.status).toBe(404);
  });
});
