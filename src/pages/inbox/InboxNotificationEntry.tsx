import { useMemo, memo } from "react";
import { isEqual } from "@libs/utils/isEqual";
import {
  NotificationTimestamp,
  entryCSSClasses,
  Summary,
} from "~/components/content-list";
import { List } from "~/components/list";
import { INotificationDocWithLocalDataAndDraftData } from "./useInboxNotificationsAndDrafts";

export const InboxNotificationEntry = memo<{
  notification: INotificationDocWithLocalDataAndDraftData;
}>(({ notification }) => {
  const from = useMemo(() => {
    return notification.fromIds
      .map((id) => notification.from[id].name)
      .join(", ");
  }, [notification.fromIds, notification.from]);

  return (
    <List.Entry<INotificationDocWithLocalDataAndDraftData>
      key={notification.id}
      id={notification.id}
      data={notification}
    >
      <li className={entryCSSClasses}>
        <div className="flex items-center" style={{ width: 168 }}>
          <span className="font-normal truncate">{from}</span>

          {notification.__local.hasDraft && (
            <span className="text-green-9 ml-2">(+ draft)</span>
          )}
        </div>

        <Summary
          subject={notification.subject}
          details={notification.summary}
        />

        <NotificationTimestamp notification={notification} />
      </li>
    </List.Entry>
  );
}, isEqual);
