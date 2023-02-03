import { AdminRole, IChannelDoc, WithLocalData } from "@libs/firestore-models";
import { createContext, useContext } from "react";
import { BehaviorSubject, Subject } from "rxjs";

export type TSidebarLayoutFocusEvent = "Sidebar" | "Outlet";

export interface ISidebarLayoutContext {
  focusEvent$: Subject<TSidebarLayoutFocusEvent>;
  sidebarOpen$: BehaviorSubject<boolean>;
}

export const SidebarLayoutContext = createContext<ISidebarLayoutContext | null>(
  null,
);

export function useSidebarLayoutContext() {
  const context = useContext(SidebarLayoutContext);

  if (!context) {
    throw new Error(
      `Oops! Looks like you forgot to provide the SidebarLayoutContext`,
    );
  }

  return context;
}

export type IChannelGroupedByWorkspace = WithLocalData<
  IChannelDoc,
  "IChannelDoc",
  {
    fromWorkspace: {
      name: string;
    };
    shortcut: number;
    fromCurrentUser: {
      role: AdminRole;
    };
  }
>;

export interface ISidebarContext {
  channelsGroupedByWorkspace: IChannelGroupedByWorkspace[][];
}

export const SidebarContext = createContext<ISidebarContext | null>(null);

export function useSidebarContext() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error(
      `Oops! Looks like you forgot to provide the SidebarContext`,
    );
  }

  return context;
}
