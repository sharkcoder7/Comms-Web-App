import { ComponentType, useCallback } from "react";
import {
  ITriagedNotificationDoc,
  markNotificationAsDone,
  triageNotification,
  useTriagedNotifications,
} from "~/services/inbox.service";
import { useHotkeyContext } from "~/services/hotkey.service";
import { ListScrollbox } from "~/components/list";
import { Header, Main, MainLayout } from "~/page-layouts/main-layout";
import { Helmet } from "react-helmet-async";
import {
  TriageNotificationDialog,
  TriageNotificationDialogState,
} from "~/dialogs/post-triage/TriagePostDialog";
import { useKBarContext } from "~/services/kbar.service";
import { useSidebarLayoutContext } from "~/page-layouts/sidebar-layout";
import {
  ContentList,
  EmptyListMessage,
  useKBarAwareFocusedEntry,
  NotificationEntry,
  onNotificationSelectNavigateToPost,
} from "~/components/content-list";

export const RemindersView: ComponentType<{}> = () => {
  const sidebarLayoutContext = useSidebarLayoutContext();
  const notifications = useTriagedNotifications();

  const findFn = useCallback(
    (
      entry: NonNullable<typeof notifications>[number],
      focusedEntry: NonNullable<typeof notifications>[number],
    ) => entry.type === focusedEntry.type && entry.id === focusedEntry.id,
    [],
  );

  const [focusedNotification, setFocusedNotification] =
    useKBarAwareFocusedEntry<NonNullable<typeof notifications>[number]>(
      notifications,
      findFn,
    );

  useHotkeyContext({
    id: "RemindersView",
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
          label: "Mark as done",
          triggers: ["e"],
          callback: () => {
            if (!focusedNotification) return;

            markNotificationAsDone(focusedNotification.id, true);
          },
        },
        {
          label: "Update reminder",
          triggers: ["h"],
          callback: () => {
            if (!focusedNotification) return;

            TriageNotificationDialogState.toggle(true, {
              id: focusedNotification.id,
              triagedUntil: focusedNotification.triagedUntil,
            });
          },
        },
      ];
    },
    deps: [focusedNotification, sidebarLayoutContext],
  });

  useKBarContext({
    id: "Reminders View",
    commands: () => {
      if (!focusedNotification) return [];

      return [
        {
          id: "triage-notification",
          label: "Update reminder",
          callback: () => {
            TriageNotificationDialogState.toggle(true, {
              id: focusedNotification.id,
              triagedUntil: focusedNotification.triagedUntil,
            });
          },
        },
        {
          id: "remove-triage",
          label: "Remove reminder & move to Inbox",
          callback: () => {
            if (!focusedNotification) return;

            triageNotification(focusedNotification.id, null);
          },
        },
      ];
    },
    deps: [focusedNotification],
  });

  return (
    <MainLayout>
      <Helmet>
        <title>Reminders | Comms</title>
      </Helmet>

      <Header>
        <h1 className="text-3xl">Reminders</h1>
      </Header>

      <TriageNotificationDialog />

      <ListScrollbox>
        <Main>
          {!notifications ? null : notifications.length === 0 ? (
            <EmptyListMessage>None.</EmptyListMessage>
          ) : (
            <ContentList
              entries={notifications}
              onEntryFocused={setFocusedNotification}
              onEntrySelect={
                onNotificationSelectNavigateToPost as (
                  post: ITriagedNotificationDoc,
                ) => string
              }
              className="mb-20"
            >
              {notifications.map((notification) => (
                <NotificationEntry
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </ContentList>
          )}
        </Main>
      </ListScrollbox>
    </MainLayout>
  );
};
