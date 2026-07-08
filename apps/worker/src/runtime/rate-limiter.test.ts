import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limiter";

function createFakeClock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    clock: {
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        now += ms;
      },
    },
    sleeps,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("createRateLimiter", () => {
  it("makes the 3rd acquire within 1s wait for the next refill when tps=2", async () => {
    const { clock, sleeps } = createFakeClock();
    const limiter = createRateLimiter({ groups: { MARKET_DATA: { tps: 2 } }, clock });

    await limiter.acquire("MARKET_DATA");
    await limiter.acquire("MARKET_DATA");
    expect(sleeps).toEqual([]);

    await limiter.acquire("MARKET_DATA");
    expect(sleeps.length).toBeGreaterThan(0);
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(500);
  });

  it("keeps buckets independent per group", async () => {
    const { clock, sleeps } = createFakeClock();
    const limiter = createRateLimiter({
      groups: { A: { tps: 1 }, B: { tps: 1 } },
      clock,
    });

    await limiter.acquire("A");
    await limiter.acquire("B"); // B is untouched by A's consumption
    expect(sleeps).toEqual([]);
  });

  it("waits for the reset window after feedback(remaining:0, reset:3)", async () => {
    const { clock, sleeps } = createFakeClock();
    const limiter = createRateLimiter({ groups: { MARKET_DATA: { tps: 10 } }, clock });

    limiter.feedback("MARKET_DATA", { remaining: 0, reset: 3 });
    await limiter.acquire("MARKET_DATA");
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(3_000);
  });

  it("updates bucket capacity after feedback(limit:5)", async () => {
    const { clock, sleeps, advance } = createFakeClock();
    const limiter = createRateLimiter({ groups: { MARKET_DATA: { tps: 2 } }, clock });

    limiter.feedback("MARKET_DATA", { limit: 5 });
    advance(1_000); // full refill at the new rate
    for (let i = 0; i < 5; i += 1) {
      await limiter.acquire("MARKET_DATA");
    }
    expect(sleeps).toEqual([]);
  });

  it("lets an undefined group pass immediately (safe default)", async () => {
    const { clock, sleeps } = createFakeClock();
    const limiter = createRateLimiter({ groups: {}, clock });

    await limiter.acquire("UNKNOWN_GROUP");
    await limiter.acquire("UNKNOWN_GROUP");
    expect(sleeps).toEqual([]);
  });
});
