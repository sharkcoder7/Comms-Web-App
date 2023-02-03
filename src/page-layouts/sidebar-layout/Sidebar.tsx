import { ComponentType, useCallback, useEffect, useMemo, useRef } from "react";
import {
  matchPath,
  NavigateFunction,
  NavLink,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { useAuthGuardContext } from "~/route-guards/withAuthGuard";
import { css, cx } from "@emotion/css";
import { useInboxNotifications } from "~/services/inbox.service";
import { useHotkeyContext } from "~/services/hotkey.service";
import {
  SidebarWorkspaces,
  ShortcutHint,
  convertShortcutToTrigger,
} from "./SidebarWorkspaces";
import { IListRef, List, ListScrollbox } from "~/components/list";
import {
  IChannelGroupedByWorkspace,
  SidebarContext,
  useSidebarContext,
  useSidebarLayoutContext,
} from "./context";
import { distinctUntilChanged } from "rxjs";
import { useObservable } from "~/utils/useObservable";
import { Transition } from "@headlessui/react";
import { KBarState } from "~/services/kbar.service";
import { NAVIGATION_EVENTS } from "~/services/navigate.service";
import { FocusOn } from "react-focus-on";
import { useWorkspaces } from "~/services/workspace.service";
import { useChannels } from "~/services/channels.service";
import { SidebarIcon } from "./SidebarIcon";
import { HelpDialogState } from "~/dialogs/help/HelpDialog";

export const Sidebar: ComponentType<{}> = () => {
  const context = useSidebarLayoutContext();

  const navigate = useNavigate();
  const workspaces = useWorkspaces();
  const channels = useChannels();

  const channelsGroupedByWorkspace: IChannelGroupedByWorkspace[][] =
    useMemo(() => {
      let index = 1;

      return workspaces.map((workspace) =>
        channels
          .filter((channel) => channel.workspaceIds.includes(workspace.id))
          .map((channel) => {
            return {
              ...channel,
              __local: {
                ...channel.__local,
                fromWorkspace: {
                  name: workspace.name,
                },
                shortcut: index++,
              },
            };
          }),
      );
    }, [workspaces, channels]);

  // Add shortcuts for navigating to channels. The shortcut pattern is
  // pressing "g" then a number where the number is the channels position
  // in the sidebar list (i.e. "1" for the first channel, "2" for the second,
  // etc).
  useHotkeyContext({
    id: "Sidebar",
    commands: () => {
      return getNavigationShortcutCommands(
        channelsGroupedByWorkspace,
        navigate,
      );
    },
    deps: [navigate, channelsGroupedByWorkspace],
  });

  useEffect(() => {
    const sub = context.focusEvent$
      .pipe(distinctUntilChanged())
      .subscribe((e) => {
        context.sidebarOpen$.next(e === "Sidebar");
      });

    return () => sub.unsubscribe();
  }, [context.focusEvent$, context.sidebarOpen$]);

  useEffect(() => {
    // Automatically close the sidebar and focus the outlet
    // on a navigation event
    const sub = NAVIGATION_EVENTS.subscribe(() => {
      context.focusEvent$.next("Outlet");
    });

    return () => sub.unsubscribe();
  }, [context.focusEvent$]);

  const onBackdropClick = useCallback(() => {
    context.focusEvent$.next("Outlet");
  }, [context.focusEvent$]);

  const isSidebarOpen = useObservable(
    () => context.sidebarOpen$.pipe(distinctUntilChanged()),
    {
      synchronous: true,
      deps: [context.sidebarOpen$],
    },
  );

  return (
    <SidebarContext.Provider value={{ channelsGroupedByWorkspace }}>
      <div className="absolute top-[30px] left-1">
        <SidebarIcon />
      </div>

      <Transition
        // Note the "as" property. I will be rendered as an `<aside>`.
        as="aside"
        show={isSidebarOpen}
        enterFrom="-translate-x-full"
        enterTo="translate-x-0"
        leaveFrom="translate-x-0"
        leaveTo="-translate-x-full"
        className={cx(
          "fixed top-0 left-0",
          "w-64 h-screen shrink-0 border-r",
          "border-gray-8 bg-inherit z-[100]",
          "ease-in-out duration-75",
        )}
      >
        {isSidebarOpen && (
          <FocusOn
            onClickOutside={onBackdropClick}
            className={cx("flex flex-col h-full")}
          >
            <SidebarContent />
          </FocusOn>
        )}
      </Transition>

      <Transition
        show={isSidebarOpen}
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className={cx("ease-in-out duration-75")}
      >
        <div
          onClick={onBackdropClick}
          className={cx(
            "fixed top-0 left-0",
            "w-screen h-screen",
            "bg-blackA-10 z-[99]",
            "ease-in-out duration-75",
          )}
        />
      </Transition>
    </SidebarContext.Provider>
  );
};

const SidebarContent: ComponentType<{}> = () => {
  const { currentUser } = useAuthGuardContext();
  const context = useSidebarLayoutContext();
  const { channelsGroupedByWorkspace } = useSidebarContext();
  const navigate = useNavigate();
  const listRef = useRef<IListRef<string> | null>(null);

  useHotkeyContext({
    id: "SidebarContent",
    updateStrategy: "replace",
    commands: () => {
      const navigationCommands = getNavigationShortcutCommands(
        channelsGroupedByWorkspace,
        navigate,
      );

      return [
        {
          label: "Close sidebar",
          triggers: ["Escape"],
          callback: () => {
            context.focusEvent$.next("Outlet");
          },
        },
        {
          label: "Open kbar",
          triggers: ["$mod+k"],
          callback: () => {
            context.focusEvent$.next("Outlet");
            setTimeout(() => KBarState.toggle(true), 0);
          },
        },
        {
          label: "Open help",
          triggers: ["?", "Shift+?"],
          callback: () => {
            context.focusEvent$.next("Outlet");
            setTimeout(() => HelpDialogState.toggle(true), 0);
          },
        },
        ...navigationCommands,
      ];
    },
    deps: [navigate, channelsGroupedByWorkspace, context.focusEvent$],
  });

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  const onArrowRight = useCallback(() => {
    context.focusEvent$.next("Outlet");
    context.sidebarOpen$.next(false);
  }, [context.focusEvent$, context.sidebarOpen$]);

  return (
    <>
      <div className="flex items-center border-b border-gray-8 p-4">
        <CommsLogo className="mr-4" />
        <span className="text-xl">Comms</span>
      </div>

      <List<string>
        ref={listRef}
        focusEntryOnMouseOver
        onArrowRight={onArrowRight}
      >
        <ListScrollbox>
          <div className="overflow-y-auto text-lg">
            <nav className="list-none py-4">
              <li>
                <InboxLink />
              </li>
              <li>
                <SidebarNavLink to="sent" label="Sent" shortcutHint="g t" />
              </li>
              <li>
                <SidebarNavLink to="done" label="Done" shortcutHint="g e" />
              </li>
              <li>
                <SidebarNavLink
                  to="reminders"
                  label="Reminders"
                  shortcutHint="g h"
                />
              </li>
            </nav>

            <SidebarWorkspaces />
          </div>
        </ListScrollbox>
      </List>

      <div className="flex-1" />

      <div className="mb-4 p-4">{currentUser.name}</div>
    </>
  );
};

const CommsLogo: ComponentType<{ className?: string }> = (props) => {
  return (
    <img
      src="/assets/comms-icon.svg"
      alt="Comms logo"
      style={{ width: 20 }}
      className={props.className}
    />
  );
};

const inboxLinkCSS = css`
  .notification-count {
    border-style: solid;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  &:focus {
    .notification-count {
      border-width: 1px;
      padding-left: calc(0.5rem - 1px);
      padding-right: calc(0.5rem - 1px);
    }
  }
`;

const InboxLink: ComponentType<{}> = () => {
  const notifications = useInboxNotifications();

  const className = useMemo(() => {
    if (!notifications?.[0]) return "";

    switch (notifications[0].priority) {
      case 100:
        return "bg-red-11 border-red-11 text-white font-medium";
      case 200:
        return "bg-[#54ecca] border-[#54ecca] text-black font-medium";
      case 300:
      case 400:
        return "bg-mint-4 border-mint-6 text-black group-focus:bg-mintDarkA-7";
      default:
        return "bg-slate-4 border-blackA-7 text-black";
    }
  }, [notifications]);

  return (
    <SidebarNavLink
      to="inbox"
      label="Inbox"
      notificationCount={notifications?.length}
      notificationClassName={className}
      shortcutHint="g i"
      className={inboxLinkCSS}
    />
  );
};

const SidebarNavLink: ComponentType<{
  to: string;
  label: string;
  shortcutHint?: string;
  notificationCount?: number;
  notificationClassName?: string;
  className?: string;
}> = ({
  to,
  label,
  notificationCount = 0,
  notificationClassName,
  shortcutHint,
  className,
}) => {
  const isActive = !!useMatch(to);

  return (
    <List.Entry<never> id={`nav-${label}`}>
      <NavLink
        to={to}
        className={cx(
          "flex py-2 pl-9 pr-4 leading-6",
          "focus:bg-slate-4 outline-none",
          "focus:border-black border-l-2",
          "border-white group relative",
          "hover:text-transparent",
          {
            ["font-medium"]: isActive,
          },
          className,
        )}
      >
        {label}
        {notificationCount > 0 && (
          <NotificationCountBadge
            count={notificationCount}
            className={notificationClassName}
          />
        )}
        {shortcutHint && <ShortcutHint hint={shortcutHint} />}
      </NavLink>
    </List.Entry>
  );
};

const NotificationCountBadge: ComponentType<{
  count: number;
  className?: string;
}> = ({ count, className = "" }) => {
  return (
    <span
      className={cx(
        "notification-count",
        "flex rounded ml-4 px-2 group-hover:hidden",
        "justify-center items-center text-sm",
        className,
      )}
    >
      {count}
    </span>
  );
};

function getNavigationShortcutCommands(
  channelsGroupedByWorkspace: IChannelGroupedByWorkspace[][],
  navigate: NavigateFunction,
) {
  const channelShortcutCommands = channelsGroupedByWorkspace
    .flat()
    .map((channel) => {
      const data = channel.__local;

      return {
        label: `Go to ${data.fromWorkspace.name} #${channel.name}`,
        triggers: [convertShortcutToTrigger(data.shortcut)],
        callback: () => {
          const route = `channels/${channel.id}`;

          if (matchPath(route, location.pathname)) {
            return;
          }

          navigate(route);
        },
      };
    });

  return [
    {
      label: "Navigate to inbox",
      triggers: ["g i"],
      callback: () => {
        navigate("/inbox");
      },
    },
    {
      label: "Navigate to sent",
      triggers: ["g t"],
      callback: () => {
        navigate("/sent");
      },
    },
    {
      label: "Navigate to done",
      triggers: ["g e"],
      callback: () => {
        navigate("/done");
      },
    },
    {
      label: "Navigate to reminders",
      triggers: ["g h"],
      callback: () => {
        navigate("/reminders");
      },
    },
    ...channelShortcutCommands,
  ];
}
