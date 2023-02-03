/**
 * Accepts a function returning a promise and wraps it so that
 * repeated calls are ignored until the first call resolves.
 */
export function onlyCallFnOnceWhilePreviousCallIsPending<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends (...args: any[]) => Promise<unknown>,
>(fn: T): T {
  let isPreviousCallPending = false;

  return ((...args: unknown[]) => {
    if (isPreviousCallPending) return;

    isPreviousCallPending = true;

    return fn(...args).finally(() => {
      isPreviousCallPending = false;
    });
  }) as T;
}
