import { isEqual } from "@libs/utils/isEqual";
import { combineLatest, distinctUntilChanged, map } from "rxjs";
import { Merge } from "type-fest";
import {
  IUnsafeDraftDocWithLocalData,
  observeDrafts,
} from "~/services/draft.service";
import {
  INotificationDocWithLocalData,
  observeInboxNotifications,
} from "~/services/inbox.service";
import { useObservable } from "~/utils/useObservable";

export type INotificationDocWithLocalDataAndDraftData =
  INotificationDocWithLocalData & {
    __local: Merge<
      INotificationDocWithLocalData["__local"],
      {
        hasDraft?: boolean;
        draftId?: string;
      }
    >;
  };

export function useInboxNotificationsAndDrafts() {
  return useObservable(
    () =>
      combineLatest([observeInboxNotifications(), observeDrafts()]).pipe(
        map(([notifications, drafts]) => {
          const newDrafts: IUnsafeDraftDocWithLocalData[] = [];
          const newNotifications: INotificationDocWithLocalDataAndDraftData[] =
            notifications.slice();

          drafts.forEach((draft) => {
            for (let i = 0; i < newNotifications.length; i++) {
              const notification = newNotifications[i];

              switch (notification.type) {
                case "new-post": {
                  const isForSameThread = notification.id === draft.threadId;

                  if (!isForSameThread) continue;

                  newNotifications.splice(i, 1, {
                    ...notification,
                    __local: {
                      ...notification.__local,
                      hasDraft: true,
                      draftId: draft.id,
                    },
                  });

                  return;
                }
                // TODO:
                // request-response notifications haven't been implemented yet.
                // When they are, we'll need to think through what to do here.
                case "requested-response":
                default: {
                  continue;
                }
              }
            }

            newDrafts.push(draft);
          });

          return [newDrafts, newNotifications] as const;
        }),
        distinctUntilChanged(isEqual),
      ),
    {
      initialValue: [undefined, undefined] as const,
    },
  );
}
