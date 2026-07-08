import { describe, expect, it } from "vitest";
import { parseAdminSeedEmails, parseAppConfig } from "@/backend/config";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

describe("parseAdminSeedEmails", () => {
  it("콤마 구분 문자열을 trim + 소문자 정규화된 배열로 파싱한다", () => {
    // Arrange
    const raw = " A@b.com , c@d.com ";

    // Act
    const result = parseAdminSeedEmails(raw);

    // Assert
    expect(result).toEqual(["a@b.com", "c@d.com"]);
  });

  it("미설정 시 빈 배열을 반환한다", () => {
    expect(parseAdminSeedEmails(undefined)).toEqual([]);
    expect(parseAdminSeedEmails("")).toEqual([]);
  });
});

describe("parseAppConfig", () => {
  it("유효한 환경변수를 AppConfig로 파싱한다", () => {
    // Act
    const config = parseAppConfig({ ...validEnv, ADMIN_SEED_EMAILS: "Admin@Example.com" });

    // Assert
    expect(config).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      supabaseServiceRoleKey: "service-role-key",
      adminSeedEmails: ["admin@example.com"],
    });
  });

  it("ADMIN_SEED_EMAILS 미설정 시 빈 배열을 반환한다", () => {
    // Act
    const config = parseAppConfig(validEnv);

    // Assert
    expect(config.adminSeedEmails).toEqual([]);
  });

  it("필수 키(SUPABASE_SERVICE_ROLE_KEY) 누락 시 키 이름을 포함한 검증 오류가 발생한다", () => {
    // Arrange
    const env = { ...validEnv, SUPABASE_SERVICE_ROLE_KEY: undefined };

    // Act & Assert
    expect(() => parseAppConfig(env)).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
