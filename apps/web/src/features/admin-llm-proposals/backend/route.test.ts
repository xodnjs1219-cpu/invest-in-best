import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const listProposalsMock = vi.hoisted(() => vi.fn());
const approveProposalMock = vi.hoisted(() => vi.fn());
const rejectProposalMock = vi.hoisted(() => vi.fn());
const withAdminAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/admin-llm-proposals/backend/service", () => ({
  listProposals: listProposalsMock,
  approveProposal: approveProposalMock,
  rejectProposal: rejectProposalMock,
}));

const ADMIN_USER = { id: "admin-1", email: "admin@example.com" };

vi.mock("@/backend/middleware/admin", () => ({
  withAdminAuth: () => withAdminAuthMock,
  adminAuthErrorCodes: { unauthorized: "UNAUTHORIZED", adminOnly: "ADMIN_ONLY" },
}));

const { registerAdminLlmProposalRoutes } = await import(
  "@/features/admin-llm-proposals/backend/route"
);

const PROPOSAL_ID = "11111111-1111-4111-8111-111111111111";

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
  registerAdminLlmProposalRoutes(app);
  return app;
};

describe("GET /admin/llm-proposals", () => {
  beforeEach(() => {
    listProposalsMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("유효 쿼리로 요청 시 listProposals 결과를 200으로 응답한다", async () => {
    // Arrange
    listProposalsMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], page: 1, pageSize: 20, hasMore: false },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/admin/llm-proposals?status=pending&page=1");

    // Assert
    expect(res.status).toBe(200);
    expect(listProposalsMock).toHaveBeenCalledWith(
      expect.anything(),
      { status: "pending", page: 1 },
    );
  });

  it("잘못된 status 값이면 400 ADMIN_LLM.INVALID_REQUEST를 반환하고 서비스는 호출하지 않는다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/admin/llm-proposals?status=banana");
    const body = (await res.json()) as { error: { code: string } };

    // Assert
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("ADMIN_LLM.INVALID_REQUEST");
    expect(listProposalsMock).not.toHaveBeenCalled();
  });

  it("page=0이면 400을 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/admin/llm-proposals?page=0");

    // Assert
    expect(res.status).toBe(400);
  });

  it("withAdminAuth 미들웨어가 그룹 레벨로 적용되어 비인증 요청은 401을 반환한다", async () => {
    // Arrange
    const app = buildApp({ adminUser: null });

    // Act
    const res = await app.request("/admin/llm-proposals");
    const body = (await res.json()) as { error: { code: string } };

    // Assert
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(listProposalsMock).not.toHaveBeenCalled();
  });
});

describe("POST /admin/llm-proposals/:proposalId/approve", () => {
  beforeEach(() => {
    approveProposalMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("유효 proposalId로 승인 요청 시 200을 반환한다", async () => {
    // Arrange
    approveProposalMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { proposalId: PROPOSAL_ID, status: "approved", resultingSnapshotId: "snap-1", effectiveAt: "2026-07-08T00:00:00.000Z" },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/llm-proposals/${PROPOSAL_ID}/approve`, { method: "POST" });

    // Assert
    expect(res.status).toBe(200);
    expect(approveProposalMock).toHaveBeenCalledWith(
      expect.anything(),
      { proposalId: PROPOSAL_ID, reviewerId: ADMIN_USER.id },
    );
  });

  it("uuid 형식이 아닌 proposalId는 400을 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/admin/llm-proposals/not-a-uuid/approve", { method: "POST" });

    // Assert
    expect(res.status).toBe(400);
    expect(approveProposalMock).not.toHaveBeenCalled();
  });

  it("서비스가 409 PROPOSAL_CONFLICT를 반환하면 그대로 전달한다", async () => {
    // Arrange
    approveProposalMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: { code: "ADMIN_LLM.PROPOSAL_CONFLICT", message: "충돌" },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/llm-proposals/${PROPOSAL_ID}/approve`, { method: "POST" });

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: "ADMIN_LLM.PROPOSAL_CONFLICT", message: "충돌" } });
  });
});

describe("POST /admin/llm-proposals/:proposalId/reject", () => {
  beforeEach(() => {
    rejectProposalMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("유효 body로 거부 요청 시 200을 반환한다", async () => {
    // Arrange
    rejectProposalMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { proposalId: PROPOSAL_ID, status: "rejected", reviewedAt: "2026-07-08T00:00:00.000Z" },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/llm-proposals/${PROPOSAL_ID}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "테스트 사유" }),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(rejectProposalMock).toHaveBeenCalledWith(
      expect.anything(),
      { proposalId: PROPOSAL_ID, reviewerId: ADMIN_USER.id, reason: "테스트 사유" },
    );
  });

  it("body가 없어도(빈 객체 취급) 통과한다", async () => {
    // Arrange
    rejectProposalMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { proposalId: PROPOSAL_ID, status: "rejected", reviewedAt: "2026-07-08T00:00:00.000Z" },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/llm-proposals/${PROPOSAL_ID}/reject`, { method: "POST" });

    // Assert
    expect(res.status).toBe(200);
  });

  it("reason이 501자면 400을 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/llm-proposals/${PROPOSAL_ID}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "a".repeat(501) }),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(rejectProposalMock).not.toHaveBeenCalled();
  });

  it("uuid 형식이 아닌 proposalId는 400을 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/admin/llm-proposals/not-a-uuid/reject", { method: "POST" });

    // Assert
    expect(res.status).toBe(400);
    expect(rejectProposalMock).not.toHaveBeenCalled();
  });

  it("서비스가 409 PROPOSAL_ALREADY_PROCESSED를 반환하면 그대로 전달한다", async () => {
    // Arrange
    rejectProposalMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: { code: "ADMIN_LLM.PROPOSAL_ALREADY_PROCESSED", message: "이미 처리됨" },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/llm-proposals/${PROPOSAL_ID}/reject`, { method: "POST" });

    // Assert
    expect(res.status).toBe(409);
  });
});
