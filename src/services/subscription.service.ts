import {
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";
import { collectionData, docData } from "rxfire/firestore";
import {
  catchFirebaseError,
  collectionGroupRef,
  collectionRef,
  docExists,
  docRef,
} from "~/firestore.service";
import {
  ASSERT_CURRENT_USER$,
  catchNoCurrentUserError,
  getAndAssertCurrentUser,
} from "./user.service";
import { useObservable } from "~/utils/useObservable";
import {
  ISubscriptionDoc,
  IThreadDoc,
  IWorkspaceMemberDoc,
  WithLocalData,
} from "@libs/firestore-models";
import { isEqual } from "@libs/utils/isEqual";
import {
  observeThread,
  removeCurrentUserFromThreadParticipants,
} from "./post.service";
import { validateNewSubscription } from "~/utils/decoders";
import {
  query,
  serverTimestamp,
  setDoc,
  where,
  WithFieldValue,
} from "firebase/firestore";
import { withPendingUpdate } from "./loading.service";
import { throttle } from "lodash-es";
import { ALL_MEMBERS_OF_USERS_WORKSPACES$ } from "./workspace.service";

export const createSubscription = withPendingUpdate(
  async (args: {
    type: ISubscriptionDoc["type"];
    subjectId: string;
    preference: ISubscriptionDoc["preference"];
  }) => {
    const currentUser = getAndAssertCurrentUser();

    if (args.type === "channel") {
      if (!(await docExists(docRef("channels", args.subjectId)))) {
        return;
      }
    } else if (args.type === "thread") {
      if (!(await docExists(docRef("threads", args.subjectId)))) {
        return;
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = `Unexpected subscription type: ${(args as any).type}.`;
      alert(msg);
      console.error(msg, args);
      return;
    }

    const subscriptionDoc: WithFieldValue<ISubscriptionDoc> = {
      id: args.subjectId,
      type: args.type,
      userId: currentUser.id,
      preference: args.preference,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const subscription = validateNewSubscription(subscriptionDoc);

    console.debug("createSubscription", subscription);

    // The `setDoc` promise never resolves until the update has been committed
    // on the server. When offline, the promise never resolves.
    await setDoc(
      docRef("users", currentUser.id, "subscriptions", subscription.id),
      subscription,
    );
  },
);

const USER_CHANNEL_SUBSCRIPTIONS$ = ASSERT_CURRENT_USER$.pipe(
  switchMap((currentUser) =>
    collectionData(
      query(
        collectionRef("users", currentUser.id, "subscriptions"),
        where("type", "==", "channel"),
      ),
    ),
  ),
  distinctUntilChanged(isEqual),
  shareReplay(1),
  catchNoCurrentUserError(),
);

export function observeChannelSubscription(channelId: string) {
  return USER_CHANNEL_SUBSCRIPTIONS$.pipe(
    map(
      (subscriptions) =>
        subscriptions.find((sub) => sub.id === channelId) ?? null,
    ),
    distinctUntilChanged(),
  );
}

export function useChannelSubscription(channelId?: string) {
  return useObservable(
    () => {
      if (!channelId) return of(null);

      return observeChannelSubscription(channelId);
    },
    {
      deps: [channelId],
    },
  );
}

export function observeCurrentUserThreadSubscription(threadId: string) {
  return ASSERT_CURRENT_USER$.pipe(
    switchMap((userDoc) =>
      observeThread(threadId).pipe(
        switchMap((threadDoc) => {
          if (!threadDoc) return of([]);

          if (threadDoc.permittedChannelIds.length === 0) {
            return docData(
              docRef("users", userDoc.id, "subscriptions", threadId),
            ).pipe(
              catchFirebaseError(() => null),
              map((threadSub) => [threadSub] as const),
            );
          }

          return combineLatest([
            docData(
              docRef("users", userDoc.id, "subscriptions", threadId),
            ).pipe(catchFirebaseError(() => null)),
            USER_CHANNEL_SUBSCRIPTIONS$.pipe(
              map((subscriptions) =>
                subscriptions.filter((sub) =>
                  threadDoc.permittedChannelIds.includes(sub.id),
                ),
              ),
            ),
          ] as const);
        }),
        map(([threadSub, channelSubs]) => {
          if (threadSub) return threadSub;
          if (!channelSubs || channelSubs.length === 0) return null;
          if (channelSubs.length === 1) return channelSubs[0] ?? null;

          const channelSub = channelSubs.reduce((prev, curr) => {
            const prevPriority = getPreferencePriority(prev.preference);
            const currPriority = getPreferencePriority(curr.preference);

            if (prevPriority < currPriority) {
              return prev;
            } else {
              return curr;
            }
          });

          return channelSub ?? null;
        }),
      ),
    ),
    catchNoCurrentUserError(() => null),
  );
}

export function useCurrentUserThreadSubscription(threadId?: string) {
  return useObservable(
    () => {
      if (!threadId) return of(null);

      return observeCurrentUserThreadSubscription(threadId);
    },
    {
      deps: [threadId],
    },
  );
}

export type IThreadSubscriptionsDoc = WithLocalData<
  ISubscriptionDoc,
  "ISubscriptionDoc",
  {
    fromWorkspaceMember: IWorkspaceMemberDoc["user"];
  }
>;

export function observeThreadSubscriptions(
  threadId: string,
): Observable<IThreadSubscriptionsDoc[]> {
  return combineLatest([
    ALL_MEMBERS_OF_USERS_WORKSPACES$,
    ASSERT_CURRENT_USER$,
  ]).pipe(
    switchMap(([workspaceMembers, currentUser]) =>
      collectionData(
        query(
          collectionGroupRef("subscriptions"),
          where("id", "==", threadId),
          where("type", "==", "thread"),
        ),
      ).pipe(
        distinctUntilChanged(isEqual),
        map((subscriptions) => {
          return subscriptions.map((sub) => {
            const member =
              sub.userId === currentUser.id
                ? {
                    user: {
                      name: currentUser.name,
                      email: currentUser.email,
                      photoURL: currentUser.photoURL,
                      phoneNumber: currentUser.phoneNumber,
                    },
                  }
                : workspaceMembers.find((member) => sub.userId === member.id);

            return {
              ...sub,
              __docType: "ISubscriptionDoc" as const,
              __local: {
                fromWorkspaceMember: member?.user || null,
              },
            };
          });
        }),
      ),
    ),
    catchNoCurrentUserError(),
  );
}

export function useThreadSubscriptions(threadId?: string) {
  return useObservable(
    () => {
      if (!threadId) return of([]);

      return observeThreadSubscriptions(threadId);
    },
    {
      deps: [threadId],
    },
  );
}

// TODO WIP
// export function useUserRecipientsForThread(threadId?: string) {
//   return useObservable(
//     () => {
//       if (!threadId) return of([]);

//       return combineLatest([
//         ALL_MEMBERS_OF_USERS_WORKSPACES$,
//         observeThread(threadId),
//         observeThreadSubscriptions(threadId),
//       ]).pipe(
//         switchMap(([workspaceMembers, thread, threadSubscriptions]) => {
//           if (!thread) return of([]);

//           const knownUserIds = thread.participatingUserIds.filter((userId) =>
//             workspaceMembers.some((member) => member.id === userId),
//           );

//           const recipientSubscriptions = threadSubscriptions
//             .filter((sub) => {
//               return getPreferencePriority(sub.preference) < 3;
//             })
//             .map((sub) => ({
//               key: sub.id + sub.userId,
//               id: sub.id,
//               name: sub.__local.fromWorkspaceMember?.name ?? null,
//             }));

//           const ignoreSubscriptions = threadSubscriptions.filter((sub) => {
//             return getPreferencePriority(sub.preference) >= 3;
//           });

//           if (knownUserIds.length === 0) {
//             return of(recipientSubscriptions);
//           }

//           if (thread.permittedChannelIds.length === 0) {
//             const ignoreUserIds = thread.participatingUserIds.filter((userId) =>
//               ignoreSubscriptions.some((sub) => sub.userId === userId),
//             );

//           }

//           return combineLatest(
//             knownUserIds.map((userId) => {
//               return combineLatest(
//                 thread.permittedChannelIds.map((channelId) =>
//                   docData(docRef("users", userId, "subscriptions", channelId)),
//                 ),
//               ).pipe(
//                 map((subscriptions) => {
//                   if (subscriptions.length === 0) {
//                     return { id: userId, preference: "involved" as const };
//                   }

//                   const preference = subscriptions
//                     .filter(isNonNullable)
//                     .reduce((prev, curr) => {
//                       const a = getPreferencePriority(prev);
//                       const b = getPreferencePriority(curr.preference);

//                       if (a > b) return curr.preference;
//                       return prev;
//                     }, "ignore" as ISubscriptionDoc["preference"]);

//                   return { id: userId, preference };
//                 }),
//               );
//             }),
//           ).pipe(
//             map((results) => {
//               return results
//                 .filter((r) => {
//                   const priority = getPreferencePriority(r.preference);

//                   return priority < 3;
//                 })
//                 .map((r) => {
//                   return {
//                     id: r.id,
//                     ...thread.participatingUsers[r.id],
//                   };
//                 });
//             }),
//           );
//         }),
//       );
//     },
//     {
//       deps: [threadId],
//     },
//   );
// }

function getPreferencePriority(preference?: ISubscriptionDoc["preference"]) {
  switch (preference) {
    case "all": {
      return 1;
    }
    case "involved": {
      return 2;
    }
    case "mentioned": {
      return 3;
    }
    case "ignore": {
      return 4;
    }
    default: {
      return 5;
    }
  }
}

/**
 * If the user is currently getting "all" notifications,
 * change their preference to "mentioned". If the user is currently
 * getting "involved" notifications, change their preference to
 * "mentioned" if they are a participant in the thread or "all" if
 * they are not a participant. If they are at "mentioned" or "ignore"
 * notification level, change their preference to "all".
 */
export const toggleThreadSubscription = throttle(
  async (thread: IThreadDoc) => {
    const currentUser = getAndAssertCurrentUser();

    const subscription = await firstValueFrom(
      observeCurrentUserThreadSubscription(thread.id),
    );

    const preference = !subscription ? "involved" : subscription.preference;

    let newPreference: ISubscriptionDoc["preference"];

    const updates: Promise<unknown>[] = [];

    if (preference === "all") {
      newPreference = "mentioned";
    } else if (preference === "involved") {
      if (thread.participatingUserIds.includes(currentUser.id)) {
        updates.push(
          removeCurrentUserFromThreadParticipants(thread.id).then(
            () => `Thread participants update successful`,
          ),
        );

        newPreference = "mentioned";
      } else {
        newPreference = "all";
      }
    } else {
      newPreference = "all";
    }

    updates.push(
      createSubscription({
        type: "thread",
        subjectId: thread.id,
        preference: newPreference,
      }).then(() => console.debug("Subscription update successful")),
    );

    await Promise.all(updates);
  },
  500,
  {
    leading: true,
    trailing: false,
  },
) as (thread: IThreadDoc) => Promise<void>;
