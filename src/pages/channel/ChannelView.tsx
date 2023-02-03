import { ComponentType, memo, useMemo } from "react";
import { useChannel, useChannelThreads } from "~/services/channels.service";
import { useParams } from "react-router-dom";
import {
  CreateSubscriptionDialog,
  CreateSubscriptionDialogState,
} from "~/dialogs/subscription-create/CreateSubscriptionDialog";
import { ListScrollbox } from "~/components/list";
import { Header, Main, MainLayout } from "~/page-layouts/main-layout";
import { IChannelDoc } from "@libs/firestore-models";
import { Helmet } from "react-helmet-async";
import { NotFound } from "~/components/NotFound";
import { useKBarContext } from "~/services/kbar.service";
import { useSidebarLayoutContext } from "~/page-layouts/sidebar-layout";
import { useHotkeyContext } from "~/services/hotkey.service";
import { useChannelSubscription } from "~/services/subscription.service";
import {
  ContentList,
  EmptyListMessage,
  navigateToEntry,
  PostEntry,
} from "~/components/content-list";
import { SubscriptionLevel } from "~/components/SubscriptionLevel";

export const ChannelView: ComponentType<{}> = () => {
  const sidebarLayoutContext = useSidebarLayoutContext();
  const params = useParams();
  const channel = useChannel(params.channelId);
  const threads = useChannelThreads(params.channelId);
  const subscription = useChannelSubscription(params.channelId);

  const posts = useMemo(
    () => threads?.map((thread) => thread.firstPost),
    [threads],
  );

  const subscriptionPreference = useMemo(() => {
    if (subscription === undefined) return "loading";
    if (subscription === null) return "involved";
    return subscription.preference;
  }, [subscription]);

  useHotkeyContext({
    id: "ChannelView",
    commands: () => {
      return [
        {
          label: "Focus Sidebar",
          triggers: ["ArrowLeft"],
          callback: () => {
            sidebarLayoutContext.focusEvent$.next("Sidebar");
          },
        },
      ];
    },
    deps: [sidebarLayoutContext],
  });

  useKBarContext({
    id: "ChannelView",
    commands: () => {
      if (!channel) return [];

      return [
        {
          id: "subscribe-to-channel",
          label: `Subscribe to ${channel.name} channel`,
          callback: () => {
            CreateSubscriptionDialogState.toggle(true, {
              subjectId: channel.id,
              type: "channel",
              title: `Subscribe to ${channel.name} channel`,
            });
          },
        },
      ];
    },
    deps: [channel],
  });

  if (channel === undefined) {
    return <div>Loading...</div>;
  }

  if (channel === null) {
    return <NotFound title="Channel Not Found" />;
  }

  return (
    <MainLayout>
      <Helmet>
        <title>{channel.name} | Channel | Comms</title>
      </Helmet>

      <CreateSubscriptionDialog />

      <Header>
        <div className="flex items-center mb-1">
          <div className="flex items-center justify-center w-6 text-3xl">#</div>

          <h1 className="text-3xl text-slate-8 truncate">
            <span className="text-black">{channel.name}</span>

            <WorkspaceDetails channel={channel} />
          </h1>

          <div className="flex-1" />

          <SubscriptionLevel preference={subscriptionPreference} />
        </div>

        <p className="text-xl">{channel.description}</p>
      </Header>

      <ListScrollbox>
        <Main>
          {!posts ? null : posts.length === 0 ? (
            <EmptyListMessage>Nothing yet.</EmptyListMessage>
          ) : (
            <ContentList
              entries={posts}
              onEntrySelect={(post) =>
                navigateToEntry(post.id, `/threads/${post.threadId}`)
              }
              className="mb-20"
            >
              {posts.map((post) => (
                <PostEntry key={post.id} post={post} />
              ))}
            </ContentList>
          )}
        </Main>
      </ListScrollbox>
    </MainLayout>
  );
};

const WorkspaceDetails: ComponentType<{ channel: IChannelDoc }> = memo(
  ({ channel }) => {
    return (
      <span
        title={Object.values(channel.workspacePermissions)
          .map((p) => p.name)
          .join(", ")}
      >
        {Object.entries(channel.workspacePermissions).map(
          ([workspaceId, permissionsData], index) => {
            return (
              <span key={workspaceId} className="ml-2">
                {permissionsData.name}
                {index !== channel.workspaceIds.length - 1 && ","}
              </span>
            );
          },
        )}
      </span>
    );
  },
);
