import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/service-client", () => ({
  createServiceClient: vi.fn(() => ({ mockedSupabase: true })),
}));

describe("createHonoApp (미들웨어 체인 통합)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const loadApp = async () => {
    const { createHonoApp } = await import("@/backend/hono/app");
    return createHonoApp();
  };

  it("존재하지 않는 /api/unknown 호출 시 404 JSON을 반환한다 (HTML 아님)", async () => {
    // Arrange
    const app = await loadApp();

    // Act
    const res = await app.request("/api/unknown");

    // Assert
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("라우트 핸들러 내부 예외 발생 시 errorBoundary가 500 통일 JSON을 반환한다", async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = await loadApp();
    // basePath('/api')가 적용된 앱이므로 상대 경로로 등록한다.
    app.get("/__test-throw", () => {
      throw new Error("boom");
    });

    // Act
    const res = await app.request("/api/__test-throw");

    // Assert
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("등록된 라우트에서 컨텍스트(supabase/logger/config)에 접근할 수 있다", async () => {
    // Arrange
    const app = await loadApp();
    app.get("/__test-context", (c) => {
      const supabase = c.get("supabase");
      const logger = c.get("logger");
      const config = c.get("config");
      return c.json({
        hasSupabase: Boolean(supabase),
        hasLogger: typeof logger?.error === "function",
        origin: config?.origin,
        hasAdminSeedEmails: Array.isArray(config?.adminSeedEmails),
      });
    });

    // Act
    const res = await app.request("http://localhost:3000/api/__test-context");

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      hasSupabase: true,
      hasLogger: true,
      origin: "http://localhost:3000",
      hasAdminSeedEmails: true,
    });
  });
});
