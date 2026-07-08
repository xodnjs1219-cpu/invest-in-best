import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "@/backend/hono/context";

type GetUserResult = { data: { user: { id: string; email?: string | null } | null }; error: unknown };
type ProfileResult = { data: { role: string } | null; error: unknown };

const buildApp = (getUserImpl: () => Promise<GetUserResult>, profileImpl: () => Promise<ProfileResult>) => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabaseAuth", { auth: { getUser: getUserImpl } } as never);
    c.set("supabase", {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: profileImpl,
          })),
        })),
      })),
    } as never);
    c.set("logger", { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
    await next();
  });
  return app;
};

describe("withAdminAuth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("세션이 없으면 401 UNAUTHORIZED를 반환하고 후속 핸들러를 실행하지 않는다", async () => {
    // Arrange
    const { withAdminAuth } = await import("@/backend/middleware/admin");
    const handler = vi.fn((c: import("hono").Context) => c.text("should not reach"));
    const app = buildApp(
      async () => ({ data: { user: null }, error: null }),
      async () => ({ data: null, error: null }),
    );
    app.use("*", withAdminAuth());
    app.get("/test", handler);

    // Act
    const res = await app.request("/test");
    const body = (await res.json()) as { error: { code: string } };

    // Assert
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("세션 조회 오류가 나면 401 UNAUTHORIZED를 반환한다", async () => {
    // Arrange
    const { withAdminAuth } = await import("@/backend/middleware/admin");
    const app = buildApp(
      async () => ({ data: { user: null }, error: { message: "invalid token" } }),
      async () => ({ data: null, error: null }),
    );
    app.use("*", withAdminAuth());
    app.get("/test", (c) => c.text("ok"));

    // Act
    const res = await app.request("/test");

    // Assert
    expect(res.status).toBe(401);
  });

  it("role='user'이면 403 ADMIN_ONLY를 반환한다", async () => {
    // Arrange
    const { withAdminAuth } = await import("@/backend/middleware/admin");
    const handler = vi.fn((c: import("hono").Context) => c.text("should not reach"));
    const app = buildApp(
      async () => ({ data: { user: { id: "user-1", email: "user@example.com" } }, error: null }),
      async () => ({ data: { role: "user" }, error: null }),
    );
    app.use("*", withAdminAuth());
    app.get("/test", handler);

    // Act
    const res = await app.request("/test");
    const body = (await res.json()) as { error: { code: string } };

    // Assert
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("ADMIN_ONLY");
    expect(handler).not.toHaveBeenCalled();
  });

  it("role='admin'이면 next()로 진행하고 adminUser를 주입한다", async () => {
    // Arrange
    const { withAdminAuth } = await import("@/backend/middleware/admin");
    const app = buildApp(
      async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } }, error: null }),
      async () => ({ data: { role: "admin" }, error: null }),
    );
    app.use("*", withAdminAuth());
    app.get("/test", (c) => {
      const adminUser = c.get("adminUser" as never);
      return c.json({ adminUser });
    });

    // Act
    const res = await app.request("/test");

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      adminUser: { id: "admin-1", email: "admin@example.com" },
    });
  });

  it("profiles 조회 실패(DB 오류) 시 500으로 fail-closed 한다(관대한 통과 금지)", async () => {
    // Arrange
    const { withAdminAuth } = await import("@/backend/middleware/admin");
    const handler = vi.fn((c: import("hono").Context) => c.text("should not reach"));
    const app = buildApp(
      async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } }, error: null }),
      async () => ({ data: null, error: { message: "db down" } }),
    );
    app.use("*", withAdminAuth());
    app.get("/test", handler);

    // Act
    const res = await app.request("/test");

    // Assert
    expect(res.status).toBe(500);
    expect(handler).not.toHaveBeenCalled();
  });

  it("profiles 행이 없으면(프로필 미존재) 403 ADMIN_ONLY를 반환한다", async () => {
    // Arrange
    const { withAdminAuth } = await import("@/backend/middleware/admin");
    const app = buildApp(
      async () => ({ data: { user: { id: "user-1", email: "user@example.com" } }, error: null }),
      async () => ({ data: null, error: null }),
    );
    app.use("*", withAdminAuth());
    app.get("/test", (c) => c.text("ok"));

    // Act
    const res = await app.request("/test");
    const body = (await res.json()) as { error: { code: string } };

    // Assert
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("ADMIN_ONLY");
  });
});
