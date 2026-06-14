/** Deadline / source freshness helpers (pure, unit-tested). */

export const DEFAULT_STALE_DAYS = 30;

export function isStale(
  lastCheckedAt: string | Date | null | undefined,
  now: Date = new Date(),
  staleDays = DEFAULT_STALE_DAYS,
): boolean {
  if (!lastCheckedAt) return true;
  const checked = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(checked)) return true;
  const ageDays = (now.getTime() - checked) / 86_400_000;
  return ageDays > staleDays;
}

/** Revive re-scoring: new evidence raises the score modestly, capped at 100. */
export function reviveScore(currentScore: number, boost = 5): number {
  return Math.min(100, Math.max(0, currentScore) + boost);
}
