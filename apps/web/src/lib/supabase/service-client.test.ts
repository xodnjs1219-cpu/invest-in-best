import { afterEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn(() => ({ mocked: true }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...(args as [])),
}));

describe("createServiceClient", () => {
  afterEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    vi.unstubAllEnvs();
  });

  it("persistSession:false, autoRefreshToken:false 옵션으로 생성된다", async () => {
    // Arrange
    const { createServiceClient } = await import("@/lib/supabase/service-client");

    // Act
    createServiceClient({
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceRoleKey: "service-role-key",
    });

    // Assert
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createClientMock.mock.calls[0] as unknown as [
      string,
      string,
      { auth: { persistSession: boolean; autoRefreshToken: boolean }; global: { fetch: unknown } },
    ];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("service-role-key");
    expect(options.auth).toEqual({ persistSession: false, autoRefreshToken: false });
    expect(typeof options.global.fetch).toBe("function");
  });

  it("환경변수 누락 시 명확한 오류 메시지로 실패한다 (팩토리 생성 시점)", async () => {
    // Arrange
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { resetAppConfigCacheForTest } = await import("@/backend/config");
    resetAppConfigCacheForTest();
    const { createServiceClient } = await import("@/lib/supabase/service-client");

    // Act & Assert: 인자 미지정 시 환경변수 기반 config 파싱이 실패해야 한다
    expect(() => createServiceClient()).toThrowError(/환경변수 검증 실패/);
    resetAppConfigCacheForTest();
  });
});
