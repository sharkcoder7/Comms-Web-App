import { ComponentType, useCallback, useMemo } from "react";
import { markNotificationAsDone } from "~/services/inbox.service";
import { useKBarContext } from "~/services/kbar.service";
import { useHotkeyContext } from "~/services/hotkey.service";
import { ListScrollbox } from "~/components/list";
import { Header, Main, MainLayout } from "~/page-layouts/main-layout";
import { Helmet } from "react-helmet-async";
import {
  TriageNotificationDialog,
  TriageNotificationDialogState,
} from "~/dialogs/post-triage/TriagePostDialog";
import { useSidebarLayoutContext } from "~/page-layouts/sidebar-layout";
import {
  ContentList,
  EmptyListMessage,
  useKBarAwareFocusedEntry,
  onNotificationSelectNavigateToPost,
  DraftEntry,
  onDraftSelectNavigateTo,
} from "~/components/content-list";
import {
  deleteDraft,
  IUnsafeDraftDocWithLocalData,
} from "~/services/draft.service";
import { NewPostDialogState } from "~/dialogs/post-new/NewPostDialog";
import { useRecipientOptions } from "~/dialogs/post-new/Recipients";
import { isNonNullable } from "@libs/utils/predicates";
import { InboxNotificationEntry } from "./InboxNotificationEntry";
import {
  INotificationDocWithLocalDataAndDraftData,
  useInboxNotificationsAndDrafts,
} from "./useInboxNotificationsAndDrafts";

export const InboxView: ComponentType<{}> = () => {
  const sidebarLayoutContext = useSidebarLayoutContext();
  const recipientOptions = useRecipientOptions();
  const [drafts, notifications] = useInboxNotificationsAndDrafts();

  const entries = useMemo(() => {
    if (!drafts && !notifications) {
      return undefined;
    }

    return [...drafts, ...notifications];
  }, [drafts, notifications]);

  const findFn = useCallback(
    (
      entry: NonNullable<typeof entries>[number],
      focusedEntry: NonNullable<typeof entries>[number],
    ) =>
      entry.__docType === focusedEntry.__docType &&
      entry.id === focusedEntry.id,
    [],
  );

  const [focusedNotification, setFocusedNotification] =
    useKBarAwareFocusedEntry<NonNullable<typeof entries>[number]>(
      entries,
      findFn,
    );

  const onEntrySelect = useCallback(
    (doc: NonNullable<typeof entries>[number]) => {
      if (doc.__docType === "INotificationDoc") {
        onNotificationSelectNavigateToPost(doc);
      } else if (!doc.isFirstPostInThread) {
        onDraftSelectNavigateTo(doc);
      } else {
        const recipientChannels = doc.recipientChannelIds.map((id) =>
          recipientOptions.find((option) => option.value === id),
        );

        const recipientUsers = doc.recipientUserIds.map((id) =>
          recipientOptions.find((option) => option.value === id),
        );

        const recipients = [...recipientChannels, ...recipientUsers].filter(
          isNonNullable,
        );

        NewPostDialogState.toggle(true, {
          postId: doc.id,
          subject: doc.subject,
          body: {
            content: doc.bodyHTML,
            mentions: Object.entries(doc.mentionedUsers).map(
              ([id, { type }]) => [id, type],
            ),
          },
          recipients,
        });
      }
    },
    [recipientOptions],
  );

  useHotkeyContext({
    id: "Inbox View",
    commands: () => {
      return [
        {
          label: "Focus Sidebar",
          triggers: ["ArrowLeft"],
          callback: () => {
            sidebarLayoutContext.focusEvent$.next("Sidebar");
          },
        },
        {
          label: "Mark post done",
          triggers: ["e"],
          callback: () => {
            if (!focusedNotification) return;

            markNotificationAsDone(focusedNotification.id, true);
          },
        },
        {
          label: "Delete draft",
          triggers: ["$mod+Shift+,"],
          callback: () => {
            if (!focusedNotification) return;

            const draftId = getDraftIdFromNotification(focusedNotification);

            if (!draftId) return;

            deleteDraft({
              postId: draftId,
            });
          },
        },
        {
          label: "Remind me",
          triggers: ["h"],
          callback: () => {
            if (!focusedNotification) return;

            TriageNotificationDialogState.toggle(true, {
              id: focusedNotification.id,
              triagedUntil: null,
            });
          },
        },
      ];
    },
    deps: [focusedNotification, sidebarLayoutContext],
  });

  useKBarContext({
    id: "Inbox View",
    commands: () => {
      if (!focusedNotification) return [];

      const commands = [
        {
          id: "inbox-done",
          label: "Mark post done",
          callback: () => {
            markNotificationAsDone(focusedNotification.id, true);
          },
        },
        {
          id: "triage-post",
          label: "Remind me",
          callback: () => {
            TriageNotificationDialogState.toggle(true, {
              id: focusedNotification.id,
              triagedUntil: null,
            });
          },
        },
      ];

      const draftId = getDraftIdFromNotification(focusedNotification);

      if (draftId) {
        commands.push({
          id: "delete-draft",
          label: "Delete draft",
          callback: () => {
            deleteDraft({ postId: draftId });
          },
        });
      }

      return commands;
    },
    deps: [focusedNotification],
  });

  return (
    <MainLayout>
      <Helmet>
        <title>Inbox | Comms</title>
      </Helmet>

      <Header>
        <h1 className="text-3xl">
          Inbox
          <PriorityLevelHint
            priority={!notifications ? "loading" : notifications[0]?.priority}
          />
        </h1>
      </Header>

      <TriageNotificationDialog />

      <ListScrollbox>
        <Main>
          {!entries ? null : entries.length === 0 ? (
            <EmptyListMessage>Inbox Zero &nbsp; 🎉</EmptyListMessage>
          ) : (
            <ContentList<NonNullable<typeof entries>[number]>
              entries={entries}
              onEntryFocused={setFocusedNotification}
              onEntrySelect={onEntrySelect}
              className="mb-20"
            >
              <>
                {drafts?.map((draft) => (
                  <DraftEntry key={draft.id} draft={draft} />
                ))}

                {notifications?.map((notification) => (
                  <InboxNotificationEntry
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </>
            </ContentList>
          )}
        </Main>
      </ListScrollbox>
    </MainLayout>
  );
};

const PriorityLevelHint: ComponentType<{ priority?: number | "loading" }> = (
  props,
) => {
  const priorityLevel = useMemo(() => {
    if (props.priority === undefined) return "zero";

    switch (props.priority) {
      case 100:
        return "urgent";
      case 200:
        return "requests";
      case 300:
        return "replies";
      case 400:
        return "replies";
      case 500:
        return "notifications";
      default:
        return null;
    }
  }, [props.priority]);

  if (!priorityLevel) return null;

  return <span className="text-slate-8 ml-2">{priorityLevel}</span>;
};

function getDraftIdFromNotification(
  notification:
    | IUnsafeDraftDocWithLocalData
    | INotificationDocWithLocalDataAndDraftData,
) {
  if (notification.__docType === "IUnsafeDraftDoc") {
    return notification.id;
  } else if (notification.__local.draftId) {
    return notification.__local.draftId;
  }
}
