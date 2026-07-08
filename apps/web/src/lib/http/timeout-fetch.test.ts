import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimeoutFetch } from "@/lib/http/timeout-fetch";

describe("createTimeoutFetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("지정 시간 초과 시 abort 한다", async () => {
    // Arrange: 요청이 abort될 때까지 완료되지 않는 base fetch
    const baseFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const timeoutFetch = createTimeoutFetch({ timeoutMs: 1_000, baseFetch });

    // Act
    const pending = timeoutFetch("https://example.com");
    const assertion = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(1_001);

    // Assert
    await assertion;
  });

  it("시간 내 완료되면 응답을 그대로 반환하고 타이머를 정리한다", async () => {
    // Arrange
    const response = new Response("ok");
    const baseFetch = vi.fn(async () => response);
    const timeoutFetch = createTimeoutFetch({ timeoutMs: 1_000, baseFetch });

    // Act
    const result = await timeoutFetch("https://example.com");

    // Assert
    expect(result).toBe(response);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("호출자 signal이 abort 되면 함께 abort 된다", async () => {
    // Arrange
    const baseFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const timeoutFetch = createTimeoutFetch({ timeoutMs: 1_000, baseFetch });
    const controller = new AbortController();

    // Act
    const pending = timeoutFetch("https://example.com", { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();

    // Assert
    await assertion;
  });
});
