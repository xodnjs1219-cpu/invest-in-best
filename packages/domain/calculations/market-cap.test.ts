import { describe, expect, it } from "vitest";
import { calculateMarketCap } from "./market-cap";

describe("calculateMarketCap", () => {
  it("multiplies close price by shares outstanding", () => {
    expect(calculateMarketCap(1000, 500)).toBe(500000);
  });

  it("throws on negative input", () => {
    expect(() => calculateMarketCap(-1, 500)).toThrow(RangeError);
  });
});
