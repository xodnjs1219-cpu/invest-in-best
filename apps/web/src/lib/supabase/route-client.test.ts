import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const createServerClientMock = vi.fn((..._args: unknown[]) => ({ mocked: true }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...(args as [])),
}));

describe("createRouteAuthClient", () => {
  afterEach(() => {
    vi.resetModules();
    createServerClientMock.mockClear();
  });

  it("anon key로 @supabase/ssr createServerClient를 생성한다", async () => {
    // Arrange
    const { createRouteAuthClient } = await import("@/lib/supabase/route-client");
    const app = new Hono();
    let capturedContext: unknown;
    app.get("/test", (c) => {
      capturedContext = c;
      createRouteAuthClient(c, {
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon-key",
      });
      return c.text("ok");
    });

    // Act
    await app.request("/test", { headers: { cookie: "sb-access-token=abc; sb-refresh-token=def" } });

    // Assert
    expect(capturedContext).toBeDefined();
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createServerClientMock.mock.calls[0] as unknown as [
      string,
      string,
      { cookies: { getAll: () => { name: string; value: string }[]; setAll: (arg: unknown) => void } },
    ];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("anon-key");
    expect(typeof options.cookies.getAll).toBe("function");
    expect(typeof options.cookies.setAll).toBe("function");
  });

  it("getAll이 요청 쿠키를 정확히 파싱한다", async () => {
    // Arrange
    const { createRouteAuthClient } = await import("@/lib/supabase/route-client");
    const app = new Hono();
    let getAllResult: { name: string; value: string }[] = [];
    app.get("/test", (c) => {
      createRouteAuthClient(c, {
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon-key",
      });
      const options = createServerClientMock.mock.calls[0][2] as {
        cookies: { getAll: () => { name: string; value: string }[] };
      };
      getAllResult = options.cookies.getAll();
      return c.text("ok");
    });

    // Act
    await app.request("/test", { headers: { cookie: "sb-access-token=abc; sb-refresh-token=def" } });

    // Assert
    expect(getAllResult).toEqual(
      expect.arrayContaining([
        { name: "sb-access-token", value: "abc" },
        { name: "sb-refresh-token", value: "def" },
      ]),
    );
  });

  it("setAll이 호출되면 응답에 Set-Cookie가 append 된다", async () => {
    // Arrange
    const { createRouteAuthClient } = await import("@/lib/supabase/route-client");
    const app = new Hono();
    app.get("/test", (c) => {
      createRouteAuthClient(c, {
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon-key",
      });
      const options = createServerClientMock.mock.calls[0][2] as {
        cookies: {
          setAll: (
            cookies: { name: string; value: string; options?: Record<string, unknown> }[],
          ) => void;
        };
      };
      options.cookies.setAll([
        { name: "sb-access-token", value: "new-token", options: { httpOnly: true, path: "/" } },
        { name: "sb-refresh-token", value: "new-refresh", options: { httpOnly: true, path: "/" } },
      ]);
      return c.text("ok");
    });

    // Act
    const res = await app.request("/test");

    // Assert
    const setCookieHeaders = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];
    expect(setCookieHeaders.some((h) => h.includes("sb-access-token=new-token"))).toBe(true);
    expect(setCookieHeaders.some((h) => h.includes("sb-refresh-token=new-refresh"))).toBe(true);
  });
});
