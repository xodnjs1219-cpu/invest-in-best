import { describe, expect, it } from "vitest";
import { createCarryForwardResolver } from "./carry-forward";
import type { IsoDate } from "../types/common";

const d = (s: string) => s as IsoDate;

describe("createCarryForwardResolver", () => {
  it("resolves the exact observation when the date matches (no carry)", () => {
    const resolver = createCarryForwardResolver([
      { date: d("2026-05-01"), value: 100 },
      { date: d("2026-05-03"), value: 300 },
    ]);

    const result = resolver.resolve(d("2026-05-03"));
    expect(result).toEqual({ value: 300, observedDate: d("2026-05-03"), isCarried: false });
  });

  it("carries the last observation forward through a gap (E2 — holiday carry-forward)", () => {
    const resolver = createCarryForwardResolver([
      { date: d("2026-05-01"), value: 100 },
      { date: d("2026-05-03"), value: 300 },
    ]);

    const result = resolver.resolve(d("2026-05-02"));
    expect(result).toEqual({ value: 100, observedDate: d("2026-05-01"), isCarried: true });
  });

  it("returns null before the first observation when no seed is given (E3)", () => {
    const resolver = createCarryForwardResolver([
      { date: d("2026-05-01"), value: 100 },
      { date: d("2026-05-03"), value: 300 },
    ]);

    const result = resolver.resolve(d("2026-04-30"));
    expect(result).toBeNull();
  });

  it("carries the seed value forward when queried before the first observation with a seed present", () => {
    const resolver = createCarryForwardResolver(
      [
        { date: d("2026-05-01"), value: 100 },
        { date: d("2026-05-03"), value: 300 },
      ],
      { date: d("2026-04-28"), value: 50 },
    );

    const result = resolver.resolve(d("2026-04-30"));
    expect(result).toEqual({ value: 50, observedDate: d("2026-04-28"), isCarried: true });
  });

  it("produces the same results under ascending sequential calls as individual calls (cursor optimization integrity)", () => {
    const observations = [
      { date: d("2026-05-01"), value: 100 },
      { date: d("2026-05-03"), value: 300 },
      { date: d("2026-05-06"), value: 600 },
    ];
    const queryDates = [
      d("2026-04-30"),
      d("2026-05-01"),
      d("2026-05-02"),
      d("2026-05-03"),
      d("2026-05-04"),
      d("2026-05-05"),
      d("2026-05-06"),
      d("2026-05-07"),
    ];

    const sequential = createCarryForwardResolver(observations);
    const sequentialResults = queryDates.map((date) => sequential.resolve(date));

    const isolatedResults = queryDates.map((date) => createCarryForwardResolver(observations).resolve(date));

    expect(sequentialResults).toEqual(isolatedResults);
  });

  it("carries the seed forward for every date when there are zero observations", () => {
    const resolver = createCarryForwardResolver([], { date: d("2026-01-01"), value: 42 });

    expect(resolver.resolve(d("2026-06-01"))).toEqual({
      value: 42,
      observedDate: d("2026-01-01"),
      isCarried: true,
    });
    expect(resolver.resolve(d("2026-07-01"))).toEqual({
      value: 42,
      observedDate: d("2026-01-01"),
      isCarried: true,
    });
  });

  it("returns null for every date when there are zero observations and no seed", () => {
    const resolver = createCarryForwardResolver<number>([]);
    expect(resolver.resolve(d("2026-06-01"))).toBeNull();
  });
});
