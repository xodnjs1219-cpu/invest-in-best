import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "@/backend/hono/context";

describe("withOptionalAuth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const buildApp = async (getUserImpl: () => Promise<{ data: { user: unknown }; error: unknown }>) => {
    vi.doMock("@/backend/hono/context", async () => {
      const actual =
        await vi.importActual<typeof import("@/backend/hono/context")>("@/backend/hono/context");
      return actual;
    });
    const { withOptionalAuth } = await import("@/backend/middleware/optional-auth");
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("supabaseAuth", { auth: { getUser: getUserImpl } } as never);
      c.set("logger", { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
      await next();
    });
    app.use("*", withOptionalAuth());
    app.get("/test", (c) => {
      const user = c.get("user" as never);
      return c.json({ user });
    });
    return app;
  };

  it("유효 세션이면 user.id를 컨텍스트에 주입한다", async () => {
    // Arrange
    const app = await buildApp(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    }));

    // Act
    const res = await app.request("/test");

    // Assert
    expect(await res.json()).toEqual({ user: { id: "user-1" } });
  });

  it("세션 없음(user:null)이면 user=null이고 요청은 계속 진행한다", async () => {
    // Arrange
    const app = await buildApp(async () => ({ data: { user: null }, error: null }));

    // Act
    const res = await app.request("/test");

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("세션 해석 오류가 나도 요청을 중단하지 않고 user=null로 계속 진행한다", async () => {
    // Arrange
    const app = await buildApp(async () => ({
      data: { user: null },
      error: { message: "invalid token" },
    }));

    // Act
    const res = await app.request("/test");

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("getUser 호출 자체가 throw해도 요청을 중단하지 않고 user=null로 계속 진행한다", async () => {
    // Arrange
    const app = await buildApp(async () => {
      throw new Error("network down");
    });

    // Act
    const res = await app.request("/test");

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });
});
