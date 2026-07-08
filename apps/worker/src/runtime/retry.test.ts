import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry";

describe("withRetry", () => {
  it("returns the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { sleep: async () => {} });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries until success within the retry budget", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { retries: 3, sleep: async () => {} });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, { retries: 2, sleep: async () => {} })).rejects.toThrow(
      "always fails",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops immediately after one call when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("stock-not-found"));
    const sleep = vi.fn(async () => {});
    await expect(
      withRetry(fn, { retries: 3, sleep, shouldRetry: () => false }),
    ).rejects.toThrow("stock-not-found");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits retryAfterMs instead of exponential backoff when the error exposes it", async () => {
    const rateLimitError = Object.assign(new Error("rate-limit-exceeded"), {
      retryAfterMs: 5_000,
    });
    const fn = vi.fn().mockRejectedValueOnce(rateLimitError).mockResolvedValue("ok");
    const sleeps: number[] = [];
    const result = await withRetry(fn, {
      retries: 3,
      baseDelayMs: 100,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(result).toBe("ok");
    expect(sleeps).toEqual([5_000]);
  });

  it("increases the delay per attempt (exponential backoff within jitter bounds)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"))
      .mockResolvedValue("ok");
    const sleeps: number[] = [];
    await withRetry(fn, {
      retries: 3,
      baseDelayMs: 1_000,
      random: () => 1, // jitter 상한 고정
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(sleeps).toEqual([1_000, 2_000, 4_000]);
  });

  it("keeps jittered delays within (0, base*2^n]", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");
    const sleeps: number[] = [];
    await withRetry(fn, {
      retries: 3,
      baseDelayMs: 1_000,
      random: () => 0.5,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(sleeps[0]).toBeGreaterThan(0);
    expect(sleeps[0]).toBeLessThanOrEqual(1_000);
    expect(sleeps[1]).toBeGreaterThan(0);
    expect(sleeps[1]).toBeLessThanOrEqual(2_000);
  });

  it("invokes onRetry with the attempt number and error", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail 1")).mockResolvedValue("ok");
    const onRetry = vi.fn();
    await withRetry(fn, { retries: 3, sleep: async () => {}, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});
