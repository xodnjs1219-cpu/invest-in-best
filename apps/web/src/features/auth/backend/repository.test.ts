import { describe, expect, it, vi } from "vitest";
import {
  discardSession,
  findProfileById,
  getRecoverySessionUser,
  insertTermsAgreements,
  listTermsAgreementDocTypes,
  sendPasswordResetEmail,
  signInWithPassword,
  signOutCurrentSession,
  signUpWithEmail,
  updatePasswordAndRevokeAllSessions,
  updateProfileRole,
  verifyRecoveryToken,
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

describe("signInWithPassword (UC-002)", () => {
  const createAuthClient = (result: {
    data: { user: { id: string; email: string } | null };
    error: { status?: number; code?: string; message: string } | null;
  }) => ({
    auth: { signInWithPassword: vi.fn(async () => result) },
  });

  it("성공 시 {kind:'success', userId, email}을 반환한다", async () => {
    // Arrange
    const client = createAuthClient({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    });

    // Act
    const result = await signInWithPassword(client as never, "a@b.com", "abcd1234");

    // Assert
    expect(result).toEqual({ kind: "success", userId: "user-1", email: "a@b.com" });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "abcd1234",
    });
  });

  it("invalid_credentials 오류 시 {kind:'invalid_credentials'}를 반환한다", async () => {
    // Arrange
    const client = createAuthClient({
      data: { user: null },
      error: { status: 400, code: "invalid_credentials", message: "invalid" },
    });

    // Act
    const result = await signInWithPassword(client as never, "a@b.com", "wrong");

    // Assert
    expect(result).toEqual({ kind: "invalid_credentials" });
  });

  it("email_not_confirmed 오류 시 {kind:'email_not_confirmed'}를 반환한다", async () => {
    // Arrange
    const client = createAuthClient({
      data: { user: null },
      error: { status: 400, code: "email_not_confirmed", message: "not confirmed" },
    });

    // Act
    const result = await signInWithPassword(client as never, "a@b.com", "abcd1234");

    // Assert
    expect(result).toEqual({ kind: "email_not_confirmed" });
  });

  it("429 오류 시 {kind:'rate_limited'}를 반환한다", async () => {
    // Arrange
    const client = createAuthClient({
      data: { user: null },
      error: { status: 429, code: "over_request_rate_limit", message: "rate limited" },
    });

    // Act
    const result = await signInWithPassword(client as never, "a@b.com", "abcd1234");

    // Assert
    expect(result).toEqual({ kind: "rate_limited" });
  });

  it("기타 오류 시 {kind:'service_error'}를 반환한다 (예외 미전파)", async () => {
    // Arrange
    const client = createAuthClient({
      data: { user: null },
      error: { status: 500, code: "unexpected_failure", message: "boom" },
    });

    // Act
    const result = await signInWithPassword(client as never, "a@b.com", "abcd1234");

    // Assert
    expect(result).toEqual({ kind: "service_error", message: "boom" });
  });

  it("호출 자체가 throw해도 {kind:'service_error'}로 흡수한다", async () => {
    // Arrange
    const client = {
      auth: {
        signInWithPassword: vi.fn(async () => {
          throw new Error("network down");
        }),
      },
    };

    // Act
    const result = await signInWithPassword(client as never, "a@b.com", "abcd1234");

    // Assert
    expect(result).toEqual({ kind: "service_error", message: "network down" });
  });
});

describe("findProfileById (UC-002)", () => {
  it("행 존재 시 {kind:'found', row}를 반환한다", async () => {
    // Arrange
    const maybeSingleMock = vi.fn(async () => ({
      data: { id: "user-1", email: "a@b.com", role: "user" },
      error: null,
    }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })),
      })),
    };

    // Act
    const result = await findProfileById(client as never, "user-1");

    // Assert
    expect(result).toEqual({
      kind: "found",
      row: { id: "user-1", email: "a@b.com", role: "user" },
    });
  });

  it("행 없음(null) 시 {kind:'not_found'}를 반환한다", async () => {
    // Arrange
    const maybeSingleMock = vi.fn(async () => ({ data: null, error: null }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })),
      })),
    };

    // Act
    const result = await findProfileById(client as never, "user-1");

    // Assert
    expect(result).toEqual({ kind: "not_found" });
  });

  it("쿼리 오류 시 {kind:'error'}를 반환한다", async () => {
    // Arrange
    const maybeSingleMock = vi.fn(async () => ({ data: null, error: { message: "db error" } }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })),
      })),
    };

    // Act
    const result = await findProfileById(client as never, "user-1");

    // Assert
    expect(result).toEqual({ kind: "error", message: "db error" });
  });
});

describe("discardSession (UC-002)", () => {
  it("signOut 실패(throw)해도 예외를 전파하지 않는다", async () => {
    // Arrange
    const client = {
      auth: {
        signOut: vi.fn(async () => {
          throw new Error("signOut failed");
        }),
      },
    };

    // Act & Assert
    await expect(discardSession(client as never)).resolves.toBeUndefined();
  });

  it("정상 signOut을 호출한다", async () => {
    // Arrange
    const signOutMock = vi.fn(async () => ({ error: null }));
    const client = { auth: { signOut: signOutMock } };

    // Act
    await discardSession(client as never);

    // Assert
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});

describe("listTermsAgreementDocTypes (UC-003)", () => {
  it("user_id + doc_type IN 필터로 이미 동의한 docType 목록을 반환한다", async () => {
    // Arrange
    const inMock = vi.fn(async () => ({
      data: [{ doc_type: "terms_of_service" }],
      error: null,
    }));
    const eqMock = vi.fn(() => ({ in: inMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const client = { from: vi.fn(() => ({ select: selectMock })) };

    // Act
    const result = await listTermsAgreementDocTypes(client as never, "user-1", [
      "terms_of_service",
      "privacy_policy",
    ]);

    // Assert
    expect(result).toEqual({ kind: "found", docTypes: ["terms_of_service"] });
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(inMock).toHaveBeenCalledWith("doc_type", ["terms_of_service", "privacy_policy"]);
  });

  it("쿼리 오류 시 {kind:'error'}를 반환한다", async () => {
    // Arrange
    const inMock = vi.fn(async () => ({ data: null, error: { message: "db error" } }));
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ in: inMock })) })) })),
    };

    // Act
    const result = await listTermsAgreementDocTypes(client as never, "user-1", [
      "terms_of_service",
    ]);

    // Assert
    expect(result).toEqual({ kind: "error", message: "db error" });
  });
});

describe("sendPasswordResetEmail (UC-004)", () => {
  it("정상 응답 → {ok:true}", async () => {
    // Arrange
    const resetPasswordForEmailMock = vi.fn(async () => ({ data: {}, error: null }));
    const client = { auth: { resetPasswordForEmail: resetPasswordForEmailMock } };

    // Act
    const result = await sendPasswordResetEmail(
      client as never,
      "user@example.com",
      "https://app.example.com/auth/reset-password",
    );

    // Assert
    expect(result).toEqual({ ok: true });
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "https://app.example.com/auth/reset-password",
    });
  });

  it("user not found 계열 오류 → {ok:true}로 정규화한다(열거 방지)", async () => {
    // Arrange
    const client = {
      auth: {
        resetPasswordForEmail: vi.fn(async () => ({
          data: null,
          error: { status: 400, code: "user_not_found", message: "not found" },
        })),
      },
    };

    // Act
    const result = await sendPasswordResetEmail(
      client as never,
      "nobody@example.com",
      "https://app.example.com/auth/reset-password",
    );

    // Assert
    expect(result).toEqual({ ok: true });
  });

  it("429/over_email_send_rate_limit → {ok:false, reason:'rate_limited'}", async () => {
    // Arrange
    const client = {
      auth: {
        resetPasswordForEmail: vi.fn(async () => ({
          data: null,
          error: { status: 429, code: "over_email_send_rate_limit", message: "rate limited" },
        })),
      },
    };

    // Act
    const result = await sendPasswordResetEmail(
      client as never,
      "user@example.com",
      "https://app.example.com/auth/reset-password",
    );

    // Assert
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("네트워크 오류/예외 → {ok:false, reason:'send_failed'}", async () => {
    // Arrange
    const client = {
      auth: {
        resetPasswordForEmail: vi.fn(async () => {
          throw new Error("network down");
        }),
      },
    };

    // Act
    const result = await sendPasswordResetEmail(
      client as never,
      "user@example.com",
      "https://app.example.com/auth/reset-password",
    );

    // Assert
    expect(result).toEqual({ ok: false, reason: "send_failed" });
  });
});

describe("verifyRecoveryToken (UC-004)", () => {
  it("유효 토큰 → {ok:true}, verifyOtp가 type:'recovery'로 호출됨", async () => {
    // Arrange
    const verifyOtpMock = vi.fn(async () => ({ data: {}, error: null }));
    const client = { auth: { verifyOtp: verifyOtpMock } };

    // Act
    const result = await verifyRecoveryToken(client as never, "token-hash-abc");

    // Assert
    expect(result).toEqual({ ok: true });
    expect(verifyOtpMock).toHaveBeenCalledWith({ type: "recovery", token_hash: "token-hash-abc" });
  });

  it("만료/사용됨/위조 오류는 모두 {ok:false, reason:'token_invalid'}로 통일된다", async () => {
    // Arrange
    const expiredClient = {
      auth: {
        verifyOtp: vi.fn(async () => ({
          data: null,
          error: { status: 400, code: "otp_expired", message: "expired" },
        })),
      },
    };
    const usedClient = {
      auth: {
        verifyOtp: vi.fn(async () => ({
          data: null,
          error: { status: 403, code: "otp_disabled", message: "used" },
        })),
      },
    };

    // Act
    const expiredResult = await verifyRecoveryToken(expiredClient as never, "expired-token");
    const usedResult = await verifyRecoveryToken(usedClient as never, "used-token");

    // Assert
    expect(expiredResult).toEqual({ ok: false, reason: "token_invalid" });
    expect(usedResult).toEqual({ ok: false, reason: "token_invalid" });
  });

  it("GoTrue 5xx → {ok:false, reason:'verify_failed'}", async () => {
    // Arrange
    const client = {
      auth: {
        verifyOtp: vi.fn(async () => ({
          data: null,
          error: { status: 500, message: "gotrue down" },
        })),
      },
    };

    // Act
    const result = await verifyRecoveryToken(client as never, "token");

    // Assert
    expect(result).toEqual({ ok: false, reason: "verify_failed" });
  });
});

describe("getRecoverySessionUser (UC-004)", () => {
  it("세션 사용자 존재 시 반환한다", async () => {
    // Arrange
    const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) } };

    // Act
    const result = await getRecoverySessionUser(client as never);

    // Assert
    expect(result).toEqual({ id: "user-1" });
  });

  it("세션 없으면 null을 반환한다", async () => {
    // Arrange
    const client = { auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } };

    // Act
    const result = await getRecoverySessionUser(client as never);

    // Assert
    expect(result).toBeNull();
  });
});

describe("updatePasswordAndRevokeAllSessions (UC-004)", () => {
  it("갱신+전역 signOut 모두 성공 → {ok:true}, signOut이 scope:'global'로 호출됨", async () => {
    // Arrange
    const updateUserMock = vi.fn(async () => ({ data: {}, error: null }));
    const signOutMock = vi.fn(async () => ({ error: null }));
    const client = { auth: { updateUser: updateUserMock, signOut: signOutMock } };

    // Act
    const result = await updatePasswordAndRevokeAllSessions(client as never, "newpass123");

    // Assert
    expect(result).toEqual({ ok: true });
    expect(updateUserMock).toHaveBeenCalledWith({ password: "newpass123" });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "global" });
  });

  it("세션 없음(401 계열) → {ok:false, reason:'session_invalid'}", async () => {
    // Arrange
    const client = {
      auth: {
        updateUser: vi.fn(async () => ({
          data: null,
          error: { status: 401, message: "no session" },
        })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    };

    // Act
    const result = await updatePasswordAndRevokeAllSessions(client as never, "newpass123");

    // Assert
    expect(result).toEqual({ ok: false, reason: "session_invalid" });
  });

  it("updateUser 성공 후 signOut 실패 → {ok:false, reason:'update_failed'}", async () => {
    // Arrange
    const client = {
      auth: {
        updateUser: vi.fn(async () => ({ data: {}, error: null })),
        signOut: vi.fn(async () => ({ error: { message: "signout failed" } })),
      },
    };

    // Act
    const result = await updatePasswordAndRevokeAllSessions(client as never, "newpass123");

    // Assert
    expect(result).toEqual({ ok: false, reason: "update_failed" });
  });
});

describe("signOutCurrentSession (UC-005)", () => {
  it("signOut이 정확히 {scope:'local'} 인자로 1회 호출되고 성공 시 {kind:'revoked'}를 반환한다", async () => {
    // Arrange
    const signOutMock = vi.fn(async () => ({ error: null }));
    const client = { auth: { signOut: signOutMock } };

    // Act
    const result = await signOutCurrentSession(client as never);

    // Assert
    expect(result).toEqual({ kind: "revoked" });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
  });

  it("세션 부재 오류(session_not_found) → {kind:'session_missing'}", async () => {
    // Arrange
    const client = {
      auth: {
        signOut: vi.fn(async () => ({
          error: { message: "session not found", code: "session_not_found" },
        })),
      },
    };

    // Act
    const result = await signOutCurrentSession(client as never);

    // Assert
    expect(result).toEqual({ kind: "session_missing" });
  });

  it("기타 오류(5xx/네트워크) → {kind:'provider_error', message}", async () => {
    // Arrange
    const client = {
      auth: {
        signOut: vi.fn(async () => ({ error: { message: "gotrue down", status: 500 } })),
      },
    };

    // Act
    const result = await signOutCurrentSession(client as never);

    // Assert
    expect(result).toEqual({ kind: "provider_error", message: "gotrue down" });
  });

  it("예외(타임아웃 Abort 포함)를 던져도 {kind:'provider_error'}로 흡수한다", async () => {
    // Arrange
    const client = {
      auth: {
        signOut: vi.fn(async () => {
          throw new Error("aborted");
        }),
      },
    };

    // Act
    const result = await signOutCurrentSession(client as never);

    // Assert
    expect(result).toEqual({ kind: "provider_error", message: "aborted" });
  });
});
