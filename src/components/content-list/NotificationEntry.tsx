import {
  IAbstractNotificationDoc,
  INotificationDoc,
} from "@libs/firestore-models";
import { useMemo, memo } from "react";
import { List } from "../list";
import { isEqual } from "@libs/utils/isEqual";
import { navigateToEntry } from "./ContentList";
import { Recipients, Summary, DisplayDate, entryCSSClasses } from "./layout";

export function onNotificationSelectNavigateToPost(
  notification: INotificationDoc,
) {
  let to: string;

  switch (notification.type) {
    case "new-post": {
      to = `/threads/${notification.id}`;
      break;
    }
    case "requested-response": {
      to = `/threads/${notification.threadId}`;
      break;
    }
    default: {
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `Unknown notification type "${(notification as any).type}"`,
      );
    }
  }

  navigateToEntry(notification.id, to);
}

export const NotificationEntry = memo(({ notification }) => {
  const from = useMemo(() => {
    return notification.fromIds
      .map((id) => notification.from[id].name)
      .join(", ");
  }, [notification.fromIds, notification.from]);

  return (
    <List.Entry<IAbstractNotificationDoc>
      key={notification.id}
      id={notification.id}
      data={notification}
    >
      <li className={entryCSSClasses}>
        <Recipients>{from}</Recipients>

        <Summary
          subject={notification.subject}
          details={notification.summary}
        />

        <NotificationTimestamp notification={notification} />
      </li>
    </List.Entry>
  );
}, isEqual) as <T extends IAbstractNotificationDoc = INotificationDoc>(props: {
  notification: T;
}) => JSX.Element;

export function NotificationTimestamp(props: {
  notification: IAbstractNotificationDoc;
}) {
  return (
    <div className="flex items-center text-sm">
      {props.notification.triagedUntil ? (
        <span className="text-plum-8">
          Remind me:{" "}
          <span className="uppercase">
            {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
            <DisplayDate date={props.notification.triagedUntil} />
          </span>
        </span>
      ) : (
        <span className="text-slate-9 uppercase">
          <DisplayDate date={props.notification.sentAt} />
        </span>
      )}
    </div>
  );
}
