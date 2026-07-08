import { describe, expect, it, vi } from "vitest";
import {
  insertTermsAgreements,
  signUpWithEmail,
  updateProfileRole,
} from "@/features/auth/backend/repository";

type SignUpAuthResult = {
  data: { user: { id: string; identities?: { id: string }[] } | null; session: null };
  error: { status?: number; code?: string; message: string } | null;
};

type SignUpMock = {
  auth: { signUp: ReturnType<typeof vi.fn<() => Promise<SignUpAuthResult>>> };
};

const createSupabaseSignUpMock = (result: SignUpAuthResult): SignUpMock => ({
  auth: { signUp: vi.fn(async () => result) },
});

describe("signUpWithEmail", () => {
  it("signUp 성공 + identities 존재 시 {kind:'created', userId}를 반환한다", async () => {
    // Arrange
    const client = createSupabaseSignUpMock({
      data: { user: { id: "user-1", identities: [{ id: "identity-1" }] }, session: null },
      error: null,
    });

    // Act
    const result = await signUpWithEmail(client as never, {
      email: "a@b.com",
      password: "abcd1234",
      emailRedirectTo: "https://app.example.com/auth/callback",
    });

    // Assert
    expect(result).toEqual({ kind: "created", userId: "user-1" });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "abcd1234",
      options: { emailRedirectTo: "https://app.example.com/auth/callback" },
    });
  });

  it("signUp 성공 + identities:[] 이면 {kind:'existing'}을 반환한다 (E1)", async () => {
    // Arrange
    const client = createSupabaseSignUpMock({
      data: { user: { id: "user-existing", identities: [] }, session: null },
      error: null,
    });

    // Act
    const result = await signUpWithEmail(client as never, {
      email: "existing@b.com",
      password: "abcd1234",
      emailRedirectTo: "https://app.example.com/auth/callback",
    });

    // Assert
    expect(result).toEqual({ kind: "existing" });
  });

  it("signUp이 429 오류를 반환하면 {kind:'rate_limited'}를 반환한다", async () => {
    // Arrange
    const client = createSupabaseSignUpMock({
      data: { user: null, session: null },
      error: { status: 429, code: "over_request_rate_limit", message: "rate limited" },
    });

    // Act
    const result = await signUpWithEmail(client as never, {
      email: "a@b.com",
      password: "abcd1234",
      emailRedirectTo: "https://app.example.com/auth/callback",
    });

    // Assert
    expect(result).toEqual({ kind: "rate_limited" });
  });

  it("signUp이 기타 오류를 반환하면 {kind:'error'}를 반환한다", async () => {
    // Arrange
    const client = createSupabaseSignUpMock({
      data: { user: null, session: null },
      error: { status: 500, code: "unexpected_failure", message: "boom" },
    });

    // Act
    const result = await signUpWithEmail(client as never, {
      email: "a@b.com",
      password: "abcd1234",
      emailRedirectTo: "https://app.example.com/auth/callback",
    });

    // Assert
    expect(result).toEqual({ kind: "error", message: "boom" });
  });
});

describe("insertTermsAgreements", () => {
  it("camelCase 입력을 snake_case 행 2개로 변환해 insert 한다", async () => {
    // Arrange
    const insertMock = vi.fn(async () => ({ error: null }));
    const fromMock = vi.fn(() => ({ insert: insertMock }));
    const client = { from: fromMock };
    const agreedAt = "2026-07-08T00:00:00.000Z";

    // Act
    const result = await insertTermsAgreements(client as never, "user-1", [
      { docType: "terms_of_service", docVersion: "v1.0", agreedAt },
      { docType: "privacy_policy", docVersion: "v1.0", agreedAt },
    ]);

    // Assert
    expect(result).toEqual({ ok: true });
    expect(fromMock).toHaveBeenCalledWith("terms_agreements");
    expect(insertMock).toHaveBeenCalledWith([
      { user_id: "user-1", doc_type: "terms_of_service", doc_version: "v1.0", agreed_at: agreedAt },
      { user_id: "user-1", doc_type: "privacy_policy", doc_version: "v1.0", agreed_at: agreedAt },
    ]);
  });

  it("insert 오류 시 {ok:false}를 반환한다 (throw 없음)", async () => {
    // Arrange
    const insertMock = vi.fn(async () => ({ error: { message: "insert failed" } }));
    const client = { from: vi.fn(() => ({ insert: insertMock })) };

    // Act
    const result = await insertTermsAgreements(client as never, "user-1", [
      { docType: "terms_of_service", docVersion: "v1.0", agreedAt: "2026-07-08T00:00:00.000Z" },
    ]);

    // Assert
    expect(result).toEqual({ ok: false, message: "insert failed" });
  });
});

describe("updateProfileRole", () => {
  it("id = userId 조건으로 role만 갱신한다", async () => {
    // Arrange
    const eqMock = vi.fn(async () => ({ error: null }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const client = { from: vi.fn(() => ({ update: updateMock })) };

    // Act
    const result = await updateProfileRole(client as never, "user-1", "admin");

    // Assert
    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({ role: "admin" });
    expect(eqMock).toHaveBeenCalledWith("id", "user-1");
  });

  it("update 오류 시 {ok:false}를 반환한다", async () => {
    // Arrange
    const eqMock = vi.fn(async () => ({ error: { message: "update failed" } }));
    const client = { from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqMock })) })) };

    // Act
    const result = await updateProfileRole(client as never, "user-1", "admin");

    // Assert
    expect(result).toEqual({ ok: false, message: "update failed" });
  });
});
