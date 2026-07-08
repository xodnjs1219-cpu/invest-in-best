import { describe, expect, it } from "vitest";
import { createJobLock } from "./job-lock";

describe("createJobLock", () => {
  it("acquires on first try and refuses re-acquisition before release", () => {
    const lock = createJobLock();
    expect(lock.tryAcquire("collect_quotes")).toBe(true);
    expect(lock.tryAcquire("collect_quotes")).toBe(false);
  });

  it("allows re-acquisition after release", () => {
    const lock = createJobLock();
    expect(lock.tryAcquire("collect_quotes")).toBe(true);
    lock.release("collect_quotes");
    expect(lock.tryAcquire("collect_quotes")).toBe(true);
  });

  it("does not interfere across different job types", () => {
    const lock = createJobLock();
    expect(lock.tryAcquire("collect_quotes")).toBe(true);
    expect(lock.tryAcquire("collect_financials")).toBe(true);
    lock.release("collect_quotes");
    expect(lock.tryAcquire("collect_financials")).toBe(false);
  });
});
