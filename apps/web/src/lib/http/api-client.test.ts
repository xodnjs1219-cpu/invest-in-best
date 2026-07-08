import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "@/lib/http/api-client";

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 응답 시 data를 반환한다", async () => {
    // Arrange
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { email: "a@b.com" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Act
    const result = await apiFetch<{ email: string }>("/auth/signup", { method: "POST" });

    // Assert
    expect(result).toEqual({ email: "a@b.com" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });

  it("4xx 응답 시 ApiError(code, status, message)를 throw 한다", async () => {
    // Arrange
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { code: "INVALID_REQUEST", message: "잘못된 요청" } }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Act & Assert
    await expect(apiFetch("/auth/signup", { method: "POST" })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      status: 400,
      message: "잘못된 요청",
    });
    await expect(apiFetch("/auth/signup")).rejects.toBeInstanceOf(ApiError);
  });

  it("5xx 응답 시 ApiError를 throw 한다", async () => {
    // Arrange
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: "AUTH_SIGNUP_FAILED", message: "실패" } }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Act & Assert
    await expect(apiFetch("/auth/signup")).rejects.toMatchObject({
      code: "AUTH_SIGNUP_FAILED",
      status: 502,
    });
  });

  it("네트워크 실패 시 일반 오류로 래핑되어 throw 된다", async () => {
    // Arrange
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    // Act & Assert
    await expect(apiFetch("/auth/signup")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("타임아웃(abort) 시 일반 오류로 래핑되어 throw 된다", async () => {
    // Arrange
    const fetchMock = vi.fn(async () => {
      const err = new DOMException("timeout", "TimeoutError");
      throw err;
    });
    vi.stubGlobal("fetch", fetchMock);

    // Act & Assert
    await expect(apiFetch("/auth/signup")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});
