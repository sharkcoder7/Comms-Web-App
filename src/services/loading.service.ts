import uid from "@libs/utils/uid";
import {
  BehaviorSubject,
  filter,
  fromEvent,
  map,
  NEVER,
  switchMap,
} from "rxjs";
import {
  BeforeNavigation,
  NAVIGATION_EVENTS,
} from "~/services/navigate.service";
import { useObservable } from "~/utils/useObservable";

export const IS_LOADING$ = new BehaviorSubject(false);

// Automatically close the modal if the user starts to navigate.
// If we don't, navigation will complete before the async function's
// promise resolves. When the new route is loaded, hotkey context will
// be merged into the LoadingModal's context stack, then this promise
// will resolve and setIsLoading(false) may be called
// resulting in the LoadingModal being removed from the dom along
// with it's hotkey context. So we want to remove the LoadingModal right
// before navigation.
NAVIGATION_EVENTS.pipe(
  filter((e) => e instanceof BeforeNavigation),
  filter(() => IS_LOADING$.getValue()),
).subscribe(() => {
  if (import.meta.env.MODE === "development") {
    console.log(
      "Automatically closing LoadingModal in response to navigation.",
    );
  }

  IS_LOADING$.next(false);
});

/**
 * When called with `setIsLoading(true)`, this covers the screen with
 * a loading indicator modal that prevents user interaction until
 * loading is marked complete `setIsLoading(false)`.
 */
export function setIsLoading(value: boolean): void;
/**
 * This provides a higher order function which wraps any function
 * that returns a promise. The new function behaves identically
 * to the original except that, when it is called and while the returned
 * promise is pending, a loading indicator modal will automatically
 * be added to the screen and then automatically removed when the
 * promise is resolved.
 */
// don't know how to type this generic function without `any`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setIsLoading<T extends (...args: any[]) => Promise<any>>(
  value: T,
): T;
/**
 * Automatically adds a loading indicator modal on top of other elements
 * which is automatically removed with the promise resolves.
 */
export function setIsLoading<T extends Promise<unknown>>(value: T): T;
export function setIsLoading(
  // don't know how to type this generic function without `any`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: boolean | Promise<unknown> | ((...args: any[]) => Promise<any>),
) {
  if (value instanceof Promise) {
    IS_LOADING$.next(true);
    return value.finally(() => IS_LOADING$.next(false));
  }

  if (value instanceof Function) {
    return (...args: unknown[]) => {
      IS_LOADING$.next(true);
      return value(...args).finally(() => IS_LOADING$.next(false));
    };
  }

  IS_LOADING$.next(value);
}

const PENDING_UPDATES_STORE$ = new BehaviorSubject<Set<string>>(new Set());

export const PendingUpdates = {
  value() {
    const currentValue = PENDING_UPDATES_STORE$.getValue();
    return currentValue.size > 0;
  },

  value$: PENDING_UPDATES_STORE$.pipe(map((set) => set.size > 0)),
  /**
   * Indicates that an update is pending and associates that update
   * with a specific key. Returns a callback function that, when
   * called, will indicate that the update is no longer pending.
   */
  add(_key?: string) {
    const key = _key || uid();
    const currentValue = PENDING_UPDATES_STORE$.getValue();
    currentValue.add(key);
    PENDING_UPDATES_STORE$.next(currentValue);

    return () => {
      currentValue.delete(key);
      PENDING_UPDATES_STORE$.next(currentValue);
    };
  },

  /**
   * In general, it is preferrable to use the callback returned by
   * `PendingUpdates.add()` instead of this method to signal
   * a pending update has completed.
   */
  remove(key: string) {
    const currentValue = PENDING_UPDATES_STORE$.getValue();
    currentValue.delete(key);
    PENDING_UPDATES_STORE$.next(currentValue);
  },
} as const;

/**
 * This wraps a promise and
 * marks the comms app as "pending" until the promise resolves. If the
 * app is "pending", a user attempting to close the tab will be warned
 * and there is also a subtle loading spinner in the corner.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withPendingUpdate<T>(promise: Promise<T>): Promise<T>;
/**
 * This higher order function wraps an async function and, when called,
 * marks the comms app as "pending" until the promise resolves. If the
 * app is "pending", a user attempting to close the tab will be warned
 * and there is also a subtle loading spinner in the corner.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withPendingUpdate<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): T;
export function withPendingUpdate(
  fnOrPromise: ((...args: unknown[]) => Promise<unknown>) | Promise<unknown>,
) {
  if (fnOrPromise instanceof Promise) {
    const onComplete = PendingUpdates.add();
    return fnOrPromise.finally(onComplete);
  }

  return (...args: unknown[]) => {
    const onComplete = PendingUpdates.add();
    return fnOrPromise(...args).finally(onComplete);
  };
}

export function usePendingUpdates() {
  return useObservable(() => PendingUpdates.value$, {
    synchronous: true,
  });
}

const WINDOW_UNLOAD_EVENTS$ = fromEvent<BeforeUnloadEvent>(
  window,
  "beforeunload",
  {
    capture: true,
  },
);

// Here we show the user a warning if they have uncommitted pending
// updates with the server. Note, I think on every modern browser
// the message we provide will be ignored and they'll just say
// something like, "You have unsaved changes." But that's the best
// we've got.
//
// Taken from
// https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event#examples
PendingUpdates.value$
  .pipe(
    switchMap((hasPendingUpdates) =>
      !hasPendingUpdates ? NEVER : WINDOW_UNLOAD_EVENTS$,
    ),
  )
  .subscribe((e) => {
    e.preventDefault();
    e.returnValue =
      "Are you sure? You have changes still being uploaded to the server.";
  });
