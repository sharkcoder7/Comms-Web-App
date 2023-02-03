import {
  of,
  map,
  distinctUntilChanged,
  combineLatest,
  switchMap,
  Observable,
} from "rxjs";
import { collectionData, docData } from "rxfire/firestore";
import { catchFirebaseError, collectionRef, docRef } from "~/firestore.service";
import {
  IPostDoc,
  IThreadDoc,
  IThreadReadStatus,
} from "@libs/firestore-models";
import {
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  arrayRemove,
  deleteField,
  setDoc,
} from "firebase/firestore";
import { useObservable } from "~/utils/useObservable";
import { isEqual } from "@libs/utils/isEqual";
import { timestampComparer } from "~/utils/comparers";
import {} from "~/utils/decoders";
import {
  IPostDocFromUnsafeDraft,
  IThreadDocFromUnsafeDraft,
  SENT_DRAFTS_AS_POSTS$,
  SENT_DRAFTS_AS_THREADS$,
} from "./draft.service";
import {
  ASSERT_CURRENT_USER$,
  catchNoCurrentUserError,
  getAndAssertCurrentUser,
} from "./user.service";
import { withPendingUpdate } from "./loading.service";
import { debounce } from "lodash-es";
import { importModule } from "./dynamic-import.service";

export function observePost(
  postId: string,
): Observable<IPostDoc | IPostDocFromUnsafeDraft | null> {
  return ASSERT_CURRENT_USER$.pipe(
    switchMap(() => SENT_DRAFTS_AS_POSTS$),
    map((posts) => posts.find((post) => post.id === postId)),
    switchMap((post) =>
      post
        ? of(post)
        : docData(docRef("posts", postId)).pipe(catchFirebaseError(() => null)),
    ),
  ).pipe(distinctUntilChanged(isEqual), catchNoCurrentUserError());
}

export function usePost(
  postId?: string,
): (IPostDoc | IPostDocFromUnsafeDraft) | null | undefined {
  return useObservable(
    () => {
      if (!postId) return of(null);

      return observePost(postId);
    },
    {
      deps: [postId],
    },
  );
}

export function observeThread(
  threadId: string,
): Observable<IThreadDoc | IThreadDocFromUnsafeDraft | null> {
  return ASSERT_CURRENT_USER$.pipe(
    switchMap(() => SENT_DRAFTS_AS_THREADS$),
    map((threads) => threads.find((thread) => thread.id === threadId)),
    switchMap((thread) =>
      thread
        ? of(thread)
        : docData(docRef("threads", threadId)).pipe(
            catchFirebaseError(() => null),
          ),
    ),
  ).pipe(
    distinctUntilChanged(isEqual),
    switchMap(async (thread) => {
      if (!thread) return null;

      const { parsePostHTML } = await importModule("parseHTMLProse");

      const newThread: IThreadDoc | IThreadDocFromUnsafeDraft = {
        ...thread,
        firstPost: {
          ...thread.firstPost,
          bodyHTML: await parsePostHTML(thread.firstPost.bodyHTML),
        },
      };

      return newThread;
    }),
    catchNoCurrentUserError(),
  );
}

export function useThread(
  threadId?: string,
): (IThreadDoc | IThreadDocFromUnsafeDraft) | null | undefined {
  return useObservable(
    () => {
      if (!threadId) return of(null);

      return observeThread(threadId);
    },
    {
      initialValue: undefined,
      deps: [threadId],
    },
  );
}

/**
 * If `threadId` is undefined then `null` is returned. Else, returns
 * `undefined` while loading else returns an array of posts.
 */
export function useThreadPosts(
  threadId?: string,
): Array<IPostDoc | IPostDocFromUnsafeDraft> | null | undefined {
  return useObservable(
    () => {
      if (!threadId) return of(null);

      // These are drafts which the user has "sent" but which
      // haven't actually been picked up by our firebase function
      // and "sent" on the backend yet. This means that none of
      // the recipients have been notified yet.
      const postsCurrentUserHasSubmittedForSending = SENT_DRAFTS_AS_POSTS$.pipe(
        map((posts) => posts.filter((post) => post.threadId === threadId)),
      );

      // If the thread being accessed is a draft, attempting to query for
      // posts with that `threadId` will throw a security rules error. We
      // try to only query for posts if the thread isn't a draft.
      const existingThreadPosts = observeThread(threadId).pipe(
        switchMap((threadDoc) =>
          !threadDoc ||
          ("__local" in threadDoc && threadDoc.__local.fromUnsafeDraft)
            ? of([])
            : collectionData(
                query(
                  collectionRef("posts"),
                  where(`threadId`, "==", threadDoc.id),
                  orderBy("sentAt", "asc"),
                  orderBy("scheduledToBeSentAt", "asc"),
                ),
              ),
        ),
      );

      return ASSERT_CURRENT_USER$.pipe(
        switchMap(() =>
          combineLatest([
            postsCurrentUserHasSubmittedForSending,
            existingThreadPosts,
          ]),
        ),
        map(([pendingPosts, sentPosts]) => {
          return sentPosts
            .concat(
              // After a pendingPost is sent for "real", it's possible for the new
              // "real" post to sync to the client before the old draft's deletion
              // is synced to the client.
              pendingPosts.filter(
                (post) => !sentPosts.some((p) => p.id === post.id),
              ),
            )
            .sort((a, b) => {
              return (
                timestampComparer(a.sentAt, b.sentAt) ||
                timestampComparer(a.scheduledToBeSentAt, b.scheduledToBeSentAt)
              );
            });
        }),
        switchMap(async (posts) => {
          const { parsePostHTML } = await importModule("parseHTMLProse");

          return Promise.all(
            posts.map(async (post) => ({
              ...post,
              bodyHTML: await parsePostHTML(post.bodyHTML),
            })),
          );
        }),
        distinctUntilChanged(isEqual),
        catchNoCurrentUserError(),
      );
    },
    {
      deps: [threadId],
    },
  );
}

export function useSentPosts() {
  return useObservable(() =>
    ASSERT_CURRENT_USER$.pipe(
      switchMap((userDoc) => {
        // These are drafts which the user has "sent" but which
        // haven't actually been picked up by our firebase function
        // and "sent" on the backend yet. This means that none of
        // the recipients have been notified yet.
        const postsCurrentUserHasSubmittedForSending = SENT_DRAFTS_AS_POSTS$;

        const sentPosts = collectionData(
          query(
            collectionRef("posts"),
            where("creatorId", "==", userDoc.id),
            orderBy("sentAt", "desc"),
            orderBy("scheduledToBeSentAt", "desc"),
          ),
        );

        return combineLatest([
          postsCurrentUserHasSubmittedForSending,
          sentPosts,
        ]).pipe(
          map(([pendingPosts, sentPosts]) => {
            return sentPosts
              .concat(
                // After a pendingPost is sent for "real", it's possible for the new
                // "real" post to sync to the client before the old draft's deletion
                // is synced to the client.
                pendingPosts.filter(
                  (post) => !sentPosts.some((p) => p.id === post.id),
                ),
              )
              .sort((a, b) => {
                return (
                  timestampComparer(b.sentAt, a.sentAt) ||
                  timestampComparer(
                    b.scheduledToBeSentAt,
                    a.scheduledToBeSentAt,
                  )
                );
              });
          }),
          distinctUntilChanged(isEqual),
        );
      }),
      catchNoCurrentUserError(),
    ),
  );
}

export function observeThreadReadStatus(threadId: string) {
  return ASSERT_CURRENT_USER$.pipe(
    switchMap((userDoc) => {
      return docData(docRef("threads", threadId, "readStatus", userDoc.id));
    }),
    map((doc) => doc || null),
    catchNoCurrentUserError(),
  );
}

export function useThreadReadStatus(threadId?: string) {
  return useObservable(() => {
    if (!threadId) return of(null);
    return observeThreadReadStatus(threadId);
  });
}

export const removeCurrentUserFromThreadParticipants = withPendingUpdate(
  async (threadId: string) => {
    const currentUser = getAndAssertCurrentUser();

    await updateDoc(docRef("threads", threadId), {
      participatingUserIds: arrayRemove(currentUser.id),
      [`participatingUsers.${currentUser.id}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  },
);

/**
 * This should be called inside a `useMemo()` hook after a thread's
 * initial "readStatus" document has loaded and should be updated
 * whenever the thread changes.
 */
export function getThreadReadStatusUpdaterFn(
  threadId: string,
  initialThreadReadStatus: IThreadReadStatus | null,
) {
  if (
    initialThreadReadStatus &&
    initialThreadReadStatus.threadId !== threadId
  ) {
    const msg = `getPostWasReadUpdateFn: Provided an IThreadReadStatus document for the wrong thread`;
    console.error(msg, threadId, initialThreadReadStatus);
    throw new Error(msg);
  }

  let readToSentAt = initialThreadReadStatus?.readToSentAt;

  let readToScheduledToBeSentAt =
    initialThreadReadStatus?.readToScheduledToBeSentAt;

  const currentUser = getAndAssertCurrentUser();

  // We're not bothing to using PendingUpdate for read status. We don't want
  // block the browser closing just for this.
  const updateThreadReadStatus = debounce(async () => {
    if (!readToSentAt || !readToScheduledToBeSentAt) return;

    return setDoc(docRef("threads", threadId, "readStatus", currentUser.id), {
      id: currentUser.id,
      threadId,
      readToSentAt,
      readToScheduledToBeSentAt,
      updatedAt: serverTimestamp(),
    });
  }, 1500);

  return (post: IPostDoc) => {
    if (!readToSentAt || !readToScheduledToBeSentAt) {
      readToSentAt = post.sentAt;
      readToScheduledToBeSentAt = post.scheduledToBeSentAt;
      return updateThreadReadStatus();
    }

    let changed = false;

    if (readToSentAt.valueOf() < post.sentAt.valueOf()) {
      readToSentAt = post.sentAt;
      changed = true;
    }

    if (
      readToScheduledToBeSentAt.valueOf() < post.scheduledToBeSentAt.valueOf()
    ) {
      readToScheduledToBeSentAt = post.scheduledToBeSentAt;
      changed = true;
    }

    if (!changed) return;

    return updateThreadReadStatus();
  };
}
