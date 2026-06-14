import { describe, it, expect } from "vitest";
import { isStale, reviveScore } from "@/lib/freshness";

describe("deadline source freshness", () => {
  const now = new Date("2026-06-14T00:00:00Z");

  it("flags a null last-checked as stale", () => {
    expect(isStale(null, now)).toBe(true);
  });

  it("flags data older than 30 days as stale", () => {
    expect(isStale("2026-05-01T00:00:00Z", now)).toBe(true);
  });

  it("treats recent data as fresh", () => {
    expect(isStale("2026-06-10T00:00:00Z", now)).toBe(false);
  });

  it("flags an unparseable date as stale", () => {
    expect(isStale("not-a-date", now)).toBe(true);
  });
});

describe("revive re-scoring", () => {
  it("boosts the score but caps at 100", () => {
    expect(reviveScore(50)).toBe(55);
    expect(reviveScore(98)).toBe(100);
  });

  it("never returns below 0", () => {
    expect(reviveScore(-10)).toBe(5);
  });
});
