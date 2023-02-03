import { ISubscriptionDoc } from "@libs/firestore-models";
import { oneLine } from "common-tags";
import { ComponentType, memo } from "react";
import { IoMdEye } from "react-icons/io";

export const SubscriptionLevel: ComponentType<{
  preference: ISubscriptionDoc["preference"] | "loading";
}> = memo(({ preference }) => {
  let notificationText: string;
  let hintText: string;

  switch (preference) {
    case "all": {
      notificationText = "Everything";
      hintText = oneLine`
        You will receive all notifications for this thread.
      `;

      break;
    }
    case "involved": {
      notificationText = "Participating";
      hintText = oneLine`
        You will receive a notification if someone replies to 
        a thread you are participating in or if someone
        @mentions you in a thread.
      `;
      break;
    }
    case "mentioned": {
      notificationText = "Mentions";
      hintText = oneLine`
        You will only receive a notification if you are @mentioned.
      `;

      break;
    }
    case "ignore": {
      notificationText = "Ignore";
      hintText = oneLine`
        You will not receive any notifications for this channel. Not even
        if you are @mentioned.
      `;

      break;
    }
    default: {
      notificationText = "loading";
      hintText = "loading";
      break;
    }
  }

  return (
    <div
      className="flex items-center px-2 py-1 rounded bg-slate-5 ml-2"
      title={hintText}
    >
      <IoMdEye size={16} className="mr-1 text-slate-11" />{" "}
      <small>{notificationText}</small>
    </div>
  );
});
