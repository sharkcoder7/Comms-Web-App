import { distinctUntilChanged, map, shareReplay, switchMap } from "rxjs";
import { collectionData, docData } from "rxfire/firestore";
import { catchFirebaseError, collectionRef, docRef } from "~/firestore.service";
import {
  query,
  where,
  updateDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import {
  ASSERT_CURRENT_USER$,
  catchNoCurrentUserError,
  getAndAssertCurrentUser,
} from "./user.service";
import { useObservable } from "~/utils/useObservable";
import { groupBy, memoize } from "lodash-es";
import { isEqual } from "@libs/utils/isEqual";
import { PendingUpdates } from "./loading.service";
import { SetNonNullable } from "@libs/utils/type-helpers";
import { INotificationDoc, WithLocalData } from "@libs/firestore-models";

export function useInboxNotification(notificationId: string) {
  return useObservable(
    () =>
      ASSERT_CURRENT_USER$.pipe(
        switchMap((userDoc) =>
          docData(docRef("users", userDoc.id, "inbox", notificationId)).pipe(
            catchFirebaseError(() => null),
          ),
        ),
        catchFirebaseError(() => null),
        distinctUntilChanged(isEqual),
        catchNoCurrentUserError(),
      ),
    {
      deps: [notificationId],
    },
  );
}

const ALL_INBOX_NOTIFICATIONS$ = ASSERT_CURRENT_USER$.pipe(
  switchMap((userDoc) =>
    collectionData(
      query(
        collectionRef("users", userDoc.id, "inbox"),
        where("done", "==", false),
        where("triaged", "==", false),
        orderBy("sentAt", "desc"),
        orderBy("scheduledToBeSentAt", "desc"),
      ),
    ),
  ),
  // If refCount is true, the source will be unsubscribed from once the
  // subscriber reference count drops to zero
  // shareReplay({ bufferSize: 1, refCount: true }),
  catchNoCurrentUserError(),
);

export type ITriagedNotificationDoc = SetNonNullable<
  INotificationDoc,
  "triagedUntil"
> & {
  triaged: true;
};

const ALL_TRIAGED_NOTIFICATIONS$ = ASSERT_CURRENT_USER$.pipe(
  switchMap((userDoc) =>
    collectionData(
      query(
        collectionRef<ITriagedNotificationDoc>("users", userDoc.id, "inbox"),
        where("triaged", "==", true),
        orderBy("triagedUntil", "asc"),
        orderBy("sentAt", "desc"),
        orderBy("scheduledToBeSentAt", "desc"),
      ),
    ),
  ),
  distinctUntilChanged(isEqual),
  // If refCount is true, the source will be unsubscribed from once the
  // subscriber reference count drops to zero
  shareReplay({ bufferSize: 1, refCount: true }),
  catchNoCurrentUserError(() => []),
);

const ALL_DONE_NOTIFICATIONS$ = ASSERT_CURRENT_USER$.pipe(
  switchMap((userDoc) =>
    collectionData(
      query(
        collectionRef("users", userDoc.id, "inbox"),
        where("done", "==", true),
        orderBy("sentAt", "desc"),
        orderBy("scheduledToBeSentAt", "desc"),
      ),
    ),
  ),
  distinctUntilChanged(isEqual),
  // If refCount is true, the source will be unsubscribed from once the
  // subscriber reference count drops to zero
  shareReplay({ bufferSize: 1, refCount: true }),
  catchNoCurrentUserError(() => []),
);

export type INotificationDocWithLocalData = WithLocalData<
  INotificationDoc,
  "INotificationDoc",
  {}
>;

export function observeInboxNotifications() {
  return ALL_INBOX_NOTIFICATIONS$.pipe(
    map((notificationDocs) => {
      const groups = groupBy(notificationDocs, (doc) => {
        if (300 <= doc.priority && 400 >= doc.priority) return 300;
        return doc.priority;
      });

      if ("100" in groups) return groups["100"];
      if ("200" in groups) return groups["200"];
      if ("300" in groups) return groups["300"];

      return notificationDocs;
    }),
    map((notificationDocs) => {
      return notificationDocs.map((doc) => {
        const localDoc: INotificationDocWithLocalData = {
          ...doc,
          __docType: "INotificationDoc",
          __local: {},
        };

        return localDoc;
      });
    }),
    distinctUntilChanged(isEqual),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}

export function useInboxNotifications() {
  return useObservable(() => observeInboxNotifications());
}

export function useDoneNotifications() {
  return useObservable(() => ALL_DONE_NOTIFICATIONS$);
}

export function useTriagedNotifications() {
  return useObservable(() => ALL_TRIAGED_NOTIFICATIONS$);
}

/**
 * If `true`, mark the inbox post as done. If `false`,
 * mark it as "not done" and also mark it as "not triaged"
 * if it was triaged.
 */
export const markNotificationAsDone = memoize(
  async (notificationId: string, isDone: boolean) => {
    const currentUser = getAndAssertCurrentUser();

    const onUpdateComplete = PendingUpdates.add();

    try {
      return await updateDoc(
        docRef("users", currentUser.id, "inbox", notificationId),
        {
          done: isDone,
          triaged: false,
          triagedUntil: null,
          updatedAt: serverTimestamp(),
        },
      );
    } finally {
      onUpdateComplete();
      markNotificationAsDone.cache.delete(notificationId + isDone);
    }
  },
  (notificationId, isDone) => notificationId + isDone,
);

export const triageNotification = memoize(
  async (notificationId: string, triagedUntil: Date | null) => {
    const currentUser = getAndAssertCurrentUser();
    const isTriaged = !!triagedUntil;

    const onUpdateComplete = PendingUpdates.add();

    try {
      return await updateDoc(
        docRef("users", currentUser.id, "inbox", notificationId),
        {
          done: false,
          triaged: isTriaged,
          triagedUntil,
          updatedAt: serverTimestamp(),
        },
      );
    } finally {
      onUpdateComplete();
      triageNotification.cache.delete(notificationId + triagedUntil);
    }
  },
  (notificationId, triagedUntil) => notificationId + triagedUntil,
);
