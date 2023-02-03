import { ComponentType, useCallback } from "react";
import {
  markNotificationAsDone,
  useDoneNotifications,
} from "~/services/inbox.service";
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
  NotificationEntry,
  onNotificationSelectNavigateToPost,
} from "~/components/content-list";

export const DoneView: ComponentType<{}> = () => {
  const sidebarLayoutContext = useSidebarLayoutContext();
  const notifications = useDoneNotifications();

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
    id: "DoneView",
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
          label: "Mark post not done",
          triggers: ["e"],
          callback: () => {
            if (!focusedNotification) return;
            markNotificationAsDone(focusedNotification.id, false);
          },
        },
        {
          label: "Remind me",
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
    id: "Done View",
    commands: () => {
      if (!focusedNotification) return [];

      return [
        {
          id: "inbox-done",
          label: "Mark post not done",
          callback: () => {
            markNotificationAsDone(focusedNotification.id, false);
          },
        },
        {
          id: "triage-notification",
          label: "Remind me",
          callback: () => {
            TriageNotificationDialogState.toggle(true, {
              id: focusedNotification.id,
              triagedUntil: focusedNotification.triagedUntil,
            });
          },
        },
      ];
    },
    deps: [focusedNotification],
  });

  return (
    <MainLayout>
      <Helmet>
        <title>Done | Comms</title>
      </Helmet>

      <Header>
        <h1 className="text-3xl">Done</h1>
      </Header>

      <TriageNotificationDialog />

      <ListScrollbox>
        <Main>
          {!notifications ? null : notifications.length === 0 ? (
            <EmptyListMessage>Nothing yet.</EmptyListMessage>
          ) : (
            <ContentList
              entries={notifications}
              onEntryFocused={setFocusedNotification}
              onEntrySelect={onNotificationSelectNavigateToPost}
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
