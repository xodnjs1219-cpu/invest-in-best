import { describe, expect, it } from "vitest";
import { loadWorkerConfig, tryLoadEnvFiles } from "./config";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  TOSSINVEST_CLIENT_ID: "client-id",
  TOSSINVEST_CLIENT_SECRET: "client-secret",
  OPENDART_API_KEY: "a".repeat(40),
  SEC_EDGAR_USER_AGENT: "InvestInBest admin@example.com",
};

describe("loadWorkerConfig", () => {
  it("parses successfully when all required keys exist", () => {
    const config = loadWorkerConfig(validEnv);
    expect(config).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceRoleKey: "service-role-key",
      tossClientId: "client-id",
      tossClientSecret: "client-secret",
      opendartApiKey: "a".repeat(40),
      secEdgarUserAgent: "InvestInBest admin@example.com",
      workerTmpDir: undefined,
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

  it("fails when OPENDART_API_KEY is not exactly 40 characters (E7-adjacent config gate)", () => {
    expect(() =>
      loadWorkerConfig({ ...validEnv, OPENDART_API_KEY: "a".repeat(39) }),
    ).toThrowError(/OPENDART_API_KEY/);
  });

  it("fails when SEC_EDGAR_USER_AGENT does not include an '@' email (E7 startup gate)", () => {
    expect(() =>
      loadWorkerConfig({ ...validEnv, SEC_EDGAR_USER_AGENT: "NoEmailHere" }),
    ).toThrowError(/SEC_EDGAR_USER_AGENT/);
  });

  it("accepts an optional WORKER_TMP_DIR override", () => {
    const config = loadWorkerConfig({ ...validEnv, WORKER_TMP_DIR: "/tmp/custom" });
    expect(config.workerTmpDir).toBe("/tmp/custom");
  });
});

describe("tryLoadEnvFiles", () => {
  it("does not throw when the .env file does not exist", () => {
    expect(() => tryLoadEnvFiles(["/nonexistent/path/.env"])).not.toThrow();
  });
});
