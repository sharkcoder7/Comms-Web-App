import { IUnsafeDraftDoc } from "@libs/firestore-models";
import { ComponentType, memo, useMemo } from "react";
import { List } from "../list";
import { isEqual } from "@libs/utils/isEqual";
import { navigateToEntry } from "./ContentList";
import { IUnsafeDraftDocWithLocalData } from "~/services/draft.service";
import { entryCSSClasses, EntryTimestamp, Recipients, Summary } from "./layout";

export function onDraftSelectNavigateTo(draft: IUnsafeDraftDoc) {
  navigateToEntry(draft.id, `/threads/${draft.threadId}`);
}

export const DraftEntry: ComponentType<{
  draft: IUnsafeDraftDocWithLocalData;
}> = memo(({ draft }) => {
  const recipientNames = useMemo(() => {
    return [
      ...Object.values(draft.__local.fromThread.recipientChannels).map(
        (r) => `#${r.name}`,
      ),
      ...Object.values(draft.__local.fromThread.recipientUsers).map(
        (r) => `@${r.name}`,
      ),
    ].join(", ");
  }, [
    draft.__local.fromThread.recipientChannels,
    draft.__local.fromThread.recipientUsers,
  ]);

  return (
    <List.Entry<IUnsafeDraftDoc> id={draft.id} data={draft}>
      <li className={entryCSSClasses}>
        <Recipients>
          <span className="text-green-9">Draft</span>
          {recipientNames && ` to ${recipientNames}`}
        </Recipients>

        <Summary
          subject={draft.subject}
          reply={!draft.isFirstPostInThread}
          details={draft.__local.bodyText}
        />

        <EntryTimestamp datetime={draft.createdAt} />
      </li>
    </List.Entry>
  );
}, isEqual);
