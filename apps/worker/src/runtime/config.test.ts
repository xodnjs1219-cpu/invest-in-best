import { describe, expect, it } from "vitest";
import { loadWorkerConfig, tryLoadEnvFiles } from "./config";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  TOSSINVEST_CLIENT_ID: "client-id",
  TOSSINVEST_CLIENT_SECRET: "client-secret",
};

describe("loadWorkerConfig", () => {
  it("parses successfully when all 4 required keys exist", () => {
    const config = loadWorkerConfig(validEnv);
    expect(config).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceRoleKey: "service-role-key",
      tossClientId: "client-id",
      tossClientSecret: "client-secret",
    });
  });

  it("throws an error naming the missing key (TOSSINVEST_CLIENT_SECRET)", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 구조 분해로 키 제외
    const { TOSSINVEST_CLIENT_SECRET: _omit, ...rest } = validEnv;
    expect(() => loadWorkerConfig(rest)).toThrowError(/TOSSINVEST_CLIENT_SECRET/);
  });

  it("fails when NEXT_PUBLIC_SUPABASE_URL is not a URL", () => {
    expect(() =>
      loadWorkerConfig({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("tryLoadEnvFiles", () => {
  it("does not throw when the .env file does not exist", () => {
    expect(() => tryLoadEnvFiles(["/nonexistent/path/.env"])).not.toThrow();
  });
});
