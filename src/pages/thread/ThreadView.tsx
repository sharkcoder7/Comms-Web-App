import { ComponentType, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router";
import {
  useThread,
  useThreadPosts,
  useThreadReadStatus,
} from "~/services/post.service";
import { useHotkeyContext } from "~/services/hotkey.service";
import { useSidebarLayoutContext } from "~/page-layouts/sidebar-layout";
import { Helmet } from "react-helmet-async";
import { NotFound } from "~/components/NotFound";
import { markNotificationAsDone } from "~/services/inbox.service";
import {
  toggleThreadSubscription,
  useCurrentUserThreadSubscription,
} from "~/services/subscription.service";
import { useKBarContext } from "~/services/kbar.service";
import {
  CreateSubscriptionDialog,
  CreateSubscriptionDialogState,
} from "~/dialogs/subscription-create/CreateSubscriptionDialog";
import { Main, MainLayout } from "~/page-layouts/main-layout";
import { SubscriptionLevel } from "~/components/SubscriptionLevel";
import { ListScrollbox } from "~/components/list";
import { ThreadList } from "./ThreadList";
import { ThreadContextPanel } from "./ThreadContextPanel";
import { fromEvent, throttleTime } from "rxjs";
import { useDraftForThread } from "~/services/draft.service";
import {
  ActionAndMainPanelWrapper,
  MainPanel,
  MainPanelContent,
  MainPanelHeader,
} from "~/page-layouts/thread-layout";

export const ThreadView: ComponentType<{}> = () => {
  const params = useParams();
  const thread = useThread(params.threadId);
  const posts = useThreadPosts(params.threadId);
  const draft = useDraftForThread(params.threadId);
  const readStatus = useThreadReadStatus(params.threadId);
  const sidebarLayoutContext = useSidebarLayoutContext();
  const scrollboxRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const subscription = useCurrentUserThreadSubscription(params.threadId);

  const subscriptionPreference = useMemo(() => {
    if (subscription === undefined) return "loading";
    if (subscription === null) return "involved";
    return subscription.preference;
  }, [subscription]);

  // NOTE, this is probably a placeholder until better functionality:
  // When navigating a PostList (e.g. on a channel page), you
  // can focus the sidebar by pressing ArrowLeft. If you're navigating
  // a Thread we want to let the user press ArrowLeft to focus the
  // Sidebar if it isn't already focused.
  useHotkeyContext({
    id: "ThreadView",
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
          label: "Mark Done",
          triggers: ["e"],
          callback: () => {
            if (!thread) return;

            history.back();

            markNotificationAsDone(thread.id, true).catch((e) =>
              console.error("failed to mark thread as done", e),
            );
          },
        },
        {
          label: "Toggle subscription",
          triggers: ["u"],
          callback: async () => {
            if (!thread) return;
            toggleThreadSubscription(thread).catch((e) =>
              console.error(
                `Error updating subscription for thread "${thread.id}"`,
                e,
              ),
            );
          },
        },
      ];
    },
    deps: [thread],
  });

  useKBarContext({
    id: "ThreadView",
    commands: () => {
      if (!thread) return [];

      return [
        {
          id: "subscribe-to-thread",
          label: `Subscribe to thread`,
          callback: () => {
            CreateSubscriptionDialogState.toggle(true, {
              subjectId: thread.id,
              type: "thread",
              title: `Subscribe to thread`,
            });
          },
        },
      ];
    },
    deps: [thread],
  });

  useEffect(() => {
    if (!scrollboxRef.current || !headerRef.current) return;

    const scrollboxEl = scrollboxRef.current;
    const headerEl = headerRef.current;

    // Apply a small dropshadow to the header element if the user
    // has scrolled down a bit.
    const sub = fromEvent(scrollboxEl, "scroll")
      .pipe(throttleTime(100, undefined, { leading: true, trailing: true }))
      .subscribe(() => {
        if (scrollboxEl.scrollTop < 5) {
          headerEl.classList.remove("shadow-md");
        } else {
          headerEl.classList.add("shadow-md");
        }
      });

    return () => sub.unsubscribe();
  }, [thread, posts]);

  if (
    thread === undefined ||
    posts === undefined ||
    readStatus === undefined ||
    draft === undefined
  ) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        Loading...
      </div>
    );
  }

  if (!thread || posts === null) {
    return <NotFound title="Thread Not Found" />;
  }

  return (
    <MainLayout>
      <Helmet>
        <title>{thread.subject} | Thread | Comms</title>
      </Helmet>

      <CreateSubscriptionDialog />

      <Main className="flex h-full">
        <ActionAndMainPanelWrapper>
          <MainPanel>
            <MainPanelHeader ref={headerRef}>
              <h1 className="text-2xl truncate" style={{ lineHeight: 1.1 }}>
                {thread.subject}
              </h1>

              <div className="flex-1" />

              <SubscriptionLevel preference={subscriptionPreference} />
            </MainPanelHeader>

            <ListScrollbox>
              <MainPanelContent ref={scrollboxRef}>
                <ThreadList
                  thread={thread}
                  posts={posts}
                  draft={draft}
                  readStatus={readStatus}
                />

                <div className="h-20" />
              </MainPanelContent>
            </ListScrollbox>
          </MainPanel>
        </ActionAndMainPanelWrapper>

        <ThreadContextPanel thread={thread} />
      </Main>
    </MainLayout>
  );
};
