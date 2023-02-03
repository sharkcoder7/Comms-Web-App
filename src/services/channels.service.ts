import { getTypedCallableFn } from "~/firebase";
import {
  switchMap,
  of,
  shareReplay,
  combineLatest,
  map,
  distinctUntilChanged,
} from "rxjs";
import { docData, collectionData } from "rxfire/firestore";
import { collectionRef, docRef, catchFirebaseError } from "~/firestore.service";
import {
  IChannelDoc,
  IThreadDoc,
  IUserDoc,
  WithLocalData,
} from "@libs/firestore-models";
import { query, where, orderBy } from "firebase/firestore";
import { ASSERT_CURRENT_USER$, catchNoCurrentUserError } from "./user.service";
import { useObservable } from "~/utils/useObservable";
import { isEqual } from "@libs/utils/isEqual";
import { stringComparer } from "~/utils/comparers";
import { SENT_DRAFTS_AS_THREADS$ } from "./draft.service";
import { timestampComparer } from "@libs/utils/comparers";
import { startWith } from "~/utils/rxjs-operators";
import { isNonNullable } from "@libs/utils/predicates";

type IChannelDocWithCurrentUserData = WithLocalData<
  IChannelDoc,
  "IChannelDoc",
  {
    fromCurrentUser: IUserDoc["channelPermissions"][string];
  }
>;

export const createChannel = getTypedCallableFn("channelCreate");

export const USER_CHANNELS$ = ASSERT_CURRENT_USER$.pipe(
  map((userDoc) => userDoc.channelPermissions),
  distinctUntilChanged(isEqual),
  switchMap((userChannelPermissions) => {
    const userChannelPermissionsEntries = Object.entries(
      userChannelPermissions,
    );

    if (userChannelPermissionsEntries.length === 0) return of([]);

    return combineLatest<Array<IChannelDocWithCurrentUserData | null>>(
      userChannelPermissionsEntries.map(([channelId, channelPermissions]) =>
        docData(docRef("channels", channelId)).pipe(
          map((channel) => {
            const data: IChannelDocWithCurrentUserData = {
              ...channel,
              __docType: "IChannelDoc",
              __local: {
                fromCurrentUser: channelPermissions,
              },
            };

            return data;
          }),
          catchFirebaseError(() => null),
          distinctUntilChanged(isEqual),
        ),
      ),
    );
  }),
  startWith(() => [] as Array<IChannelDocWithCurrentUserData | null>),
  map((channelDocs) =>
    channelDocs
      .filter(isNonNullable)
      .sort(
        (a, b) => stringComparer(a.name, b.name) || stringComparer(a.id, b.id),
      ),
  ),
  shareReplay(1),
  catchNoCurrentUserError(),
);

export function useChannels<T>(options: {
  /**
   * Provide a function which will be used to map the observable results
   * before they are returned. These results will be checked if they are
   * deeply equal and only cause the component to rerender if something
   * actually changes.
   */
  mapResults: (channels: IChannelDocWithCurrentUserData[]) => T;
  deps?: unknown[];
}): T;

export function useChannels(options?: {
  mapResults?: (channels: IChannelDocWithCurrentUserData[]) => unknown;
  deps?: unknown[];
}): IChannelDocWithCurrentUserData[];

export function useChannels<T>({
  mapResults,
  deps,
}: {
  mapResults?: (channels: IChannelDocWithCurrentUserData[]) => T;
  deps?: unknown[];
} = {}): IChannelDocWithCurrentUserData[] | T {
  return useObservable<IChannelDocWithCurrentUserData[] | T>(
    () => {
      if (!mapResults) return USER_CHANNELS$;

      return USER_CHANNELS$.pipe(
        map(mapResults),
        distinctUntilChanged(isEqual),
      );
    },
    {
      synchronous: true,
      deps,
    },
  );
}

/**
 * Fetches a single channel when provided with a channelId.
 * While loading, returns `undefined`. Returns `null` if there
 * is no ID for the given channel, else returns the channel doc.
 */
export function useChannel(
  channelId?: string,
): IChannelDocWithCurrentUserData | null | undefined {
  return useObservable(
    () => {
      if (!channelId) return of(null);

      return USER_CHANNELS$.pipe(
        map(
          (channels) =>
            channels.find((channel) => channel.id === channelId) ?? null,
        ),
        distinctUntilChanged(isEqual),
      );
    },
    {
      deps: [channelId],
    },
  );
}

export function useChannelThreads(
  channelId?: string,
): IThreadDoc[] | undefined {
  return useObservable(
    () => {
      if (!channelId) return of([]);

      // These are drafts which the user has "sent" but which
      // haven't actually been picked up by our firebase function
      // and "sent" on the backend yet. This means that none of
      // the recipients have been notified yet.
      const threadsCurrentUserHasSubmittedForSending =
        SENT_DRAFTS_AS_THREADS$.pipe(
          map((threads) =>
            threads.filter((thread) =>
              thread.permittedChannelIds.includes(channelId),
            ),
          ),
        );

      const channelThreads = collectionData(
        query(
          collectionRef("threads"),
          where("permittedChannelIds", "array-contains", channelId),
          orderBy("firstPost.sentAt", "desc"),
          orderBy("firstPost.scheduledToBeSentAt", "desc"),
        ),
      );

      return ASSERT_CURRENT_USER$.pipe(
        switchMap(() =>
          combineLatest([
            threadsCurrentUserHasSubmittedForSending,
            channelThreads,
          ]),
        ),
        map(([pendingThreads, sentThreads]) => {
          return sentThreads
            .concat(
              // After a pendingThreads is picked up and sent for "real" by the server,
              // it's possible for the new "real" thread to sync to the client before
              // the old draft's deletion is synced to the client.
              pendingThreads.filter(
                (thread) => !sentThreads.some((t) => t.id === thread.id),
              ),
            )
            .sort((a, b) => {
              return (
                timestampComparer(a.firstPost.sentAt, b.firstPost.sentAt) ||
                timestampComparer(
                  a.firstPost.scheduledToBeSentAt,
                  b.firstPost.scheduledToBeSentAt,
                )
              );
            })
            .reverse();
        }),
        distinctUntilChanged(isEqual),
        catchNoCurrentUserError(),
      );
    },
    {
      deps: [channelId],
    },
  );
}
