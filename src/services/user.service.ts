import { auth, getTypedCallableFn } from "~/firebase";
import { user } from "rxfire/auth";
import {
  switchMap,
  of,
  shareReplay,
  map,
  Observable,
  catchError,
  throwError,
  NEVER,
} from "rxjs";
import { docData } from "rxfire/firestore";
import { catchFirebaseError, docRef } from "~/firestore.service";
import { useObservable } from "~/utils/useObservable";
import { IUserDoc } from "@libs/firestore-models";
import { startWith } from "~/utils/rxjs-operators";

export const FIREBASE_USER$ = user(auth).pipe(shareReplay(1));

export const CURRENT_USER$ = FIREBASE_USER$.pipe(
  switchMap((user) =>
    !user
      ? of(null)
      : docData(docRef("users", user.uid)).pipe(
          catchFirebaseError(() => null),
          map((doc) => doc || null),
        ),
  ),
  shareReplay(1),
);

let currentUser: IUserDoc | null = null;

// we maintain one subscription to the current user state
// for speedier retrieval
CURRENT_USER$.subscribe((user) => {
  currentUser = user;
});

class NoCurrentUserError extends Error {}

export const ASSERT_CURRENT_USER$ = CURRENT_USER$.pipe(
  switchMap((user) =>
    !user ? throwError(() => new NoCurrentUserError()) : of(user),
  ),
);

/**
 * The `catchNoCurrentUserError` is intended to be used in
 * conjunction with the `ASSERT_CURRENT_USER$` observable.
 * Together, they allow us to subscribe to the current user
 * and pretend like it will always be non-null in observables
 * that should only be called while the user is logged in.
 *
 * See https://github.com/ReactiveX/rxjs/discussions/6992#discussioncomment-2936961
 */
export function catchNoCurrentUserError<I>(): (
  source: Observable<I>,
) => Observable<I>;
export function catchNoCurrentUserError<I, T>(
  defaultValue: () => T,
): (
  source: Observable<I>,
) => I extends unknown[]
  ? T extends never[]
    ? Observable<I>
    : Observable<I | T>
  : Observable<I | T>;
export function catchNoCurrentUserError<I, T>(
  defaultValue?: () => T,
): (source: Observable<I>) => Observable<I | T> {
  return (source$: Observable<I>) => {
    function handleError(err: unknown): Observable<I | T> {
      if (err instanceof NoCurrentUserError) {
        return defaultValue
          ? CURRENT_USER$.pipe(
              switchMap((currentUser) => (!currentUser ? NEVER : source$)),
              startWith(defaultValue),
              catchError(handleError),
            )
          : CURRENT_USER$.pipe(
              switchMap((currentUser) => (!currentUser ? NEVER : source$)),
              catchError(handleError),
            );
      }

      throw err;
    }

    return source$.pipe(catchError(handleError));
  };
}

export function useCurrentUser() {
  return useObservable(() => CURRENT_USER$, {
    initialValue: null,
  });
}

export const createUser = getTypedCallableFn("userCreate");

export function signout() {
  return auth.signOut();
}

export function getCurrentUser() {
  return currentUser;
}

export function getAndAssertCurrentUser() {
  if (!currentUser) {
    throw new Error("Expected current user to be signed in but they are not.");
  }

  return currentUser;
}
