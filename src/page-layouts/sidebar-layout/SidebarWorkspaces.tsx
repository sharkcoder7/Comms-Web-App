import { ComponentType, Fragment, useState } from "react";
import { NavLink, matchPath, useLocation } from "react-router-dom";
import { cx } from "@emotion/css";
import { useWorkspaces } from "~/services/workspace.service";
import { IChannelDoc, IWorkspaceDoc } from "@libs/firestore-models";
import { List } from "~/components/list";
import { IChannelGroupedByWorkspace, useSidebarContext } from "./context";

export function convertShortcutToTrigger(shortcut: number) {
  return `g ${shortcut.toString().split("").join(" ")}`;
}

export const SidebarWorkspaces: ComponentType<{}> = () => {
  const workspaces = useWorkspaces();
  const { channelsGroupedByWorkspace } = useSidebarContext();

  return (
    <ul className="list-none mb-10">
      {workspaces.map((workspace, index) => (
        <Workspace
          key={workspace.id}
          workspace={workspace}
          channels={channelsGroupedByWorkspace[index]}
        />
      ))}
    </ul>
  );
};

const Workspace: ComponentType<{
  workspace: IWorkspaceDoc;
  channels: IChannelGroupedByWorkspace[];
}> = (props) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <li className="flex flex-col">
      <button
        type="button"
        className={`
          flex items-center pl-3 pr-4 py-2
          focus:bg-slate-4 outline-none focus:border-black
          border-l-2 border-white
        `}
        onClick={() => setIsExpanded(!isExpanded)}
        disabled
      >
        <TriangleIcon className={cx({ "rotate-90": isExpanded })} />
        <strong>{props.workspace.name}</strong>
      </button>

      {isExpanded && (
        <ul className="list-none">
          <WorkspaceChannels
            workspace={props.workspace}
            channels={props.channels}
          />
        </ul>
      )}
    </li>
  );
};

const TriangleIcon: ComponentType<{ className?: string }> = (props) => {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cx("scale-150 mr-2", props.className)}
    >
      <path d="M6 11L6 4L10.5 7.5L6 11Z" fill="currentColor"></path>
    </svg>
  );
};

const WorkspaceChannels: ComponentType<{
  workspace: IWorkspaceDoc;
  channels: IChannelGroupedByWorkspace[];
}> = (props) => {
  const location = useLocation();

  return (
    <>
      {props.channels.map((channel) => {
        const to = `channels/${channel.id}`;

        const isActive = !!matchPath(to, location.pathname);

        return (
          <li key={channel.id}>
            <List.Entry<IChannelDoc>
              id={`${props.workspace.id}-${channel.id}`}
              data={channel}
            >
              <NavLink
                to={to}
                className={cx(
                  "flex py-2 px-9 leading-6",
                  "focus:bg-slate-4 outline-none",
                  "focus:border-black border-l-2",
                  "border-white group relative",
                  "hover:text-transparent",
                  {
                    ["font-medium"]: isActive,
                  },
                )}
              >
                # {channel.name}
                <span className="flex-1" />
                <span className="text-slateA-8 group-hover:hidden">
                  {channel.__local.shortcut}
                </span>
                <ShortcutHint
                  hint={convertShortcutToTrigger(channel.__local.shortcut)}
                />
              </NavLink>
            </List.Entry>
          </li>
        );
      })}
    </>
  );
};

export const ShortcutHint: ComponentType<{
  hint: string;
}> = ({ hint }) => {
  const keys = hint.split(" ");

  return (
    <div
      className={cx(
        "items-center hidden group-hover:flex",
        "absolute top-0 right-0 h-full",
      )}
    >
      {keys.map((key, index) => {
        return (
          <Fragment key={index}>
            {index > 0 && (
              <small className="mx-2 text-slateDark-11">then</small>
            )}

            <kbd
              className={cx(
                "flex rounded uppercase",
                "justify-center items-center text-xs",
                "bg-slateDark-11 h-5 w-5 text-white",
                { ["mr-4"]: index === keys.length - 1 },
              )}
            >
              {key}
            </kbd>
          </Fragment>
        );
      })}
    </div>
  );
};
