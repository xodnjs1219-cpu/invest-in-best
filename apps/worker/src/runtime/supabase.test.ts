import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWorkerClientOptions, createTimeoutFetch } from "./supabase";

describe("buildWorkerClientOptions", () => {
  it("disables session persistence and token auto-refresh (worker process)", () => {
    const fetchImpl = vi.fn();
    const options = buildWorkerClientOptions(fetchImpl);
    expect(options.auth).toEqual({ persistSession: false, autoRefreshToken: false });
    expect(options.global.fetch).toBe(fetchImpl);
  });
});

describe("createTimeoutFetch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts the request when the timeout elapses (fake timer)", async () => {
    vi.useFakeTimers();
    const baseFetch = vi.fn(
      (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const timeoutFetch = createTimeoutFetch(5_000, baseFetch as unknown as typeof fetch);

    const pending = timeoutFetch("https://example.com");
    const assertion = expect(pending).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it("resolves normally within the timeout and clears the timer", async () => {
    vi.useFakeTimers();
    const response = new Response("ok");
    const baseFetch = vi.fn(async () => response);
    const timeoutFetch = createTimeoutFetch(5_000, baseFetch as unknown as typeof fetch);

    await expect(timeoutFetch("https://example.com")).resolves.toBe(response);
    expect(vi.getTimerCount()).toBe(0);
  });
});
