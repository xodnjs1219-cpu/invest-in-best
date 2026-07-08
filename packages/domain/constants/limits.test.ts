import { describe, expect, it } from "vitest";
import { MAX_CHAINS_PER_USER, MAX_NODES_PER_CHAIN, NODE_LIMIT_WARNING_THRESHOLD } from "./limits";

describe("limits constants", () => {
  it("MAX_NODES_PER_CHAIN은 100이다 (BR-2)", () => {
    expect(MAX_NODES_PER_CHAIN).toBe(100);
  });

  it("MAX_CHAINS_PER_USER는 50이다 (BR-2)", () => {
    expect(MAX_CHAINS_PER_USER).toBe(50);
  });

  it("NODE_LIMIT_WARNING_THRESHOLD는 90이다 (UC-013 plan 모듈 1)", () => {
    expect(NODE_LIMIT_WARNING_THRESHOLD).toBe(90);
  });

  it("NODE_LIMIT_WARNING_THRESHOLD는 MAX_NODES_PER_CHAIN보다 작다", () => {
    expect(NODE_LIMIT_WARNING_THRESHOLD).toBeLessThan(MAX_NODES_PER_CHAIN);
  });
});
