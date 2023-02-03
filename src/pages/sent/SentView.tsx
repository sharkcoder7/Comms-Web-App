import { ComponentType } from "react";
import { ListScrollbox } from "~/components/list";
import { Header, Main, MainLayout } from "~/page-layouts/main-layout";
import { Helmet } from "react-helmet-async";
import { useSentPosts } from "~/services/post.service";
import { useSidebarLayoutContext } from "~/page-layouts/sidebar-layout";
import { useHotkeyContext } from "~/services/hotkey.service";
import {
  ContentList,
  EmptyListMessage,
  onPostSelectNavigateTo,
  PostEntry,
} from "~/components/content-list";

export const SentView: ComponentType<{}> = () => {
  const sidebarLayoutContext = useSidebarLayoutContext();
  const posts = useSentPosts();

  useHotkeyContext({
    id: "SentView",
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

  return (
    <MainLayout>
      <Helmet>
        <title>Sent | Comms</title>
      </Helmet>

      <Header>
        <h1 className="text-3xl">Sent</h1>
      </Header>

      <ListScrollbox>
        <Main>
          {!posts ? null : posts.length === 0 ? (
            <EmptyListMessage>Nothing yet.</EmptyListMessage>
          ) : (
            <ContentList
              entries={posts}
              onEntrySelect={onPostSelectNavigateTo}
              className="mb-20"
            >
              {posts.map((post) => (
                <PostEntry key={post.id} post={post} showRecipientNames />
              ))}
            </ContentList>
          )}
        </Main>
      </ListScrollbox>
    </MainLayout>
  );
};
