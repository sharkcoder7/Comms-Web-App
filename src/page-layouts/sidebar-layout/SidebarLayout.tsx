import { ComponentType, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { withAuthGuard } from "~/route-guards/withAuthGuard";
import { NewPostDialog } from "~/dialogs/post-new/NewPostDialog";
import { NewWorkspaceDialog } from "~/dialogs/workspace-new/NewWorkspaceDialog";
import { USER_WORKSPACES$ } from "~/services/workspace.service";
import { USER_CHANNELS$ } from "~/services/channels.service";
import { NewChannelDialog } from "~/dialogs/channel-new/NewChannelDialog";
import { KBarDialog } from "~/dialogs/kbar/KBarDialog";
import { WorkspaceInviteDialog } from "~/dialogs/workspace-invite/WorkspaceInviteDialog";
import { Sidebar } from "./Sidebar";
import { ISidebarLayoutContext, SidebarLayoutContext } from "./context";
import { BehaviorSubject, Subject } from "rxjs";
import { PendingUpdatesSpinner } from "./PendingUpdatesSpinner";
import useConstant from "use-constant";
import { HelpDialog } from "~/dialogs/help/HelpDialog";

export const SidebarLayout: ComponentType<{}> = withAuthGuard(() => {
  useEffect(() => {
    // We maintain a subscription to user workspaces and channels
    // to speed up loading on pages that make use of the sidebar layout.
    const sub = USER_WORKSPACES$.subscribe();
    sub.add(USER_CHANNELS$.subscribe());
    return () => sub.unsubscribe();
  }, []);

  const context = useConstant<ISidebarLayoutContext>(() => {
    return {
      focusEvent$: new Subject(),
      sidebarOpen$: new BehaviorSubject<boolean>(false),
    };
  });

  return (
    <SidebarLayoutContext.Provider value={context}>
      <div className="flex w-screen h-screen bg-inherit">
        <Sidebar />

        {/* We need `min-width: 0;` in order for truncating post */}
        {/* summaries text to work in the PostList. */}
        {/* See https://css-tricks.com/flexbox-truncated-text/ */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </div>

        <KBarDialog />
        <HelpDialog />
        <NewPostDialog />
        <NewWorkspaceDialog />
        <WorkspaceInviteDialog />
        <NewChannelDialog />
        <PendingUpdatesSpinner />
      </div>
    </SidebarLayoutContext.Provider>
  );
});
