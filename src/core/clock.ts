let last = 0;

/**
 * Current time as an ISO string, strictly increasing within the process:
 * children are ordered by createdAt, so two threads created in the same
 * millisecond must not share it.
 */
export function nowIso(): string {
  last = Math.max(Date.now(), last + 1);
  return new Date(last).toISOString();
}
