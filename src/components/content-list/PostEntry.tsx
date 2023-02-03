import { IPostDoc } from "@libs/firestore-models";
import { ComponentType, memo, useMemo } from "react";
import { List } from "../list";
import { isEqual } from "@libs/utils/isEqual";
import { navigateToEntry } from "./ContentList";
import { entryCSSClasses, EntryTimestamp, Recipients, Summary } from "./layout";

export function onPostSelectNavigateTo(post: IPostDoc) {
  navigateToEntry(post.id, `/threads/${post.threadId}?post=${post.id}`);
}

export const PostEntry: ComponentType<{
  post: IPostDoc;
  showRecipientNames?: boolean;
}> = memo(({ post, showRecipientNames = false }) => {
  const recipientNames = useMemo(() => {
    if (!showRecipientNames) return [];

    return [
      ...Object.values(post.recipientChannels).map((r) => `#${r.name}`),
      ...Object.values(post.recipientUsers).map((r) => `@${r.name}`),
    ].join(", ");
  }, [showRecipientNames, post.recipientChannels, post.recipientUsers]);

  return (
    <List.Entry<IPostDoc> id={post.id} data={post}>
      <li className={entryCSSClasses}>
        <Recipients>
          {showRecipientNames ? recipientNames : post.creatorName}
        </Recipients>

        <Summary
          subject={post.subject}
          reply={!post.isFirstPostInThread}
          details={post.bodyText}
        />

        <EntryTimestamp datetime={post.sentAt} />
      </li>
    </List.Entry>
  );
}, isEqual);
