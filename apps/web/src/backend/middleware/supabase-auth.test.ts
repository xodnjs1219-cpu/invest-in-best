import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "@/backend/hono/context";

const createRouteAuthClientMock = vi.fn(() => ({ mocked: "auth-client" }));

vi.mock("@/lib/supabase/route-client", () => ({
  createRouteAuthClient: (...args: unknown[]) => createRouteAuthClientMock(...(args as [])),
}));

describe("withSupabaseAuth", () => {
  it("컨텍스트에 쿠키 바인딩 인증 클라이언트를 주입한다", async () => {
    // Arrange
    const { withSupabaseAuth } = await import("@/backend/middleware/supabase-auth");
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("config", {
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon-key",
        supabaseServiceRoleKey: "service-role",
        adminSeedEmails: [],
        origin: "https://app.example.com",
      });
      await next();
    });
    app.use("*", withSupabaseAuth());
    let captured: unknown;
    app.get("/test", (c) => {
      captured = c.get("supabaseAuth" as never);
      return c.text("ok");
    });

    // Act
    await app.request("/test");

    // Assert
    expect(captured).toEqual({ mocked: "auth-client" });
    expect(createRouteAuthClientMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon-key" }),
    );
  });
});
