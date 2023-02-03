import {
  ComponentType,
  ForwardedRef,
  forwardRef,
  ReactElement,
  ReactNode,
  Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { filter, take } from "rxjs";
import { useSidebarLayoutContext } from "~/page-layouts/sidebar-layout";
import { useHotkeyContext } from "~/services/hotkey.service";
import { KBarState } from "~/services/kbar.service";
import { navigateService } from "~/services/navigate.service";
import { useComposedRefs } from "~/utils/useComposedRefs";
import { useLocationState } from "~/utils/useLocationState";
import { IListRef, List } from "../list";

export interface IContactListProps<T extends { id: string }> {
  entries?: T[];
  initiallyFocusEntryId?: string;
  onEntrySelect?: (post: T) => void;
  onEntryFocused?: (post: T | null) => void;
  onArrowUpOverflow?: (e: KeyboardEvent) => void;
  onArrowDownOverflow?: (e: KeyboardEvent) => void;
  /** default true */
  focusOnMouseOver?: boolean;
  className?: string;
  children?: ReactNode;
  autoFocus?: boolean;
}

export const EmptyListMessage: ComponentType<{}> = (props) => {
  return (
    <div className="w-full h-full flex justify-center items-center">
      <span className="text-2xl text-slate-9">{props.children}</span>
    </div>
  );
};

function _ContentList<T extends { id: string }>(
  props: IContactListProps<T>,
  forwardedRef?: ForwardedRef<IListRef<T>>,
) {
  const sidebarLayoutContext = useSidebarLayoutContext();

  const listRef = useRef<IListRef<T>>(null);
  const listElRef = useRef<HTMLUListElement>(null);
  const storedInitiallyFocusEntryId = useLocationState<string>("ContentList");

  const initiallyFocusEntryId =
    storedInitiallyFocusEntryId ?? props.initiallyFocusEntryId;

  const composedRefs = useComposedRefs(forwardedRef, listRef);

  const idOfFirstEntryLoadedAfterCompMount = useRef<string>();

  if (!idOfFirstEntryLoadedAfterCompMount.current && props.entries?.[0]) {
    idOfFirstEntryLoadedAfterCompMount.current = props.entries?.[0].id;
  }

  // If an ArrowUp or ArrowDown event is uncaught and
  // reaches the window in the DOM, this indicates that there
  // wasn't a list entry focused when the arrow key was pressed.
  // In this case, we should focus the ContentList.
  useHotkeyContext({
    id: "ContentList",
    commands: () => {
      return [
        {
          label: "Focus content list",
          triggers: ["ArrowUp", "ArrowDown"],
          callback: () => {
            listRef.current?.focus();
          },
        },
      ];
    },
  });

  // Focus the ContentList on the "Outlet" SidebarLayoutContext focus event
  useEffect(() => {
    const sub = sidebarLayoutContext.focusEvent$
      .pipe(filter((e) => e === "Outlet"))
      .subscribe(() => {
        listRef.current?.focus();
      });

    return () => sub.unsubscribe();
  }, [sidebarLayoutContext.focusEvent$]);

  useEffect(() => {
    if (!props.entries?.[0] || initiallyFocusEntryId) return;
    const [firstEntry] = props.entries;

    const sub = sidebarLayoutContext.focusEvent$
      .pipe(
        filter((e) => e === "Outlet"),
        take(1),
      )
      .subscribe(() => {
        listRef.current?.focus(firstEntry.id);
      });

    return () => sub.unsubscribe();
  }, [props.entries, initiallyFocusEntryId, sidebarLayoutContext.focusEvent$]);

  if (!props.entries) return null;

  const initiallyFocusableEntryId =
    initiallyFocusEntryId || idOfFirstEntryLoadedAfterCompMount.current;

  return (
    <List<T>
      ref={composedRefs}
      onEntryFocusIn={(_, entry) => props.onEntryFocused?.(entry)}
      onEntrySelect={(_, entry) => props.onEntrySelect?.(entry)}
      onArrowUpOverflow={props.onArrowUpOverflow}
      onArrowDownOverflow={props.onArrowDownOverflow}
      initiallyFocusableEntryId={initiallyFocusableEntryId}
      autoFocus={props.autoFocus ?? !!initiallyFocusableEntryId}
      focusEntryOnMouseOver={props.focusOnMouseOver ?? true}
    >
      <ul
        ref={listElRef}
        onBlur={(e) => {
          if (
            e.relatedTarget instanceof HTMLLIElement &&
            listElRef.current?.contains(e.relatedTarget)
          ) {
            // We want to ignore the blur event if we're switching focus from
            // one list entry to another.
            return;
          }

          props.onEntryFocused?.(null);
        }}
        className={props.className}
      >
        {props.children}
      </ul>
    </List>
  );
}

export const ContentList = forwardRef(_ContentList) as <
  T extends { id: string },
>(
  props: IContactListProps<T> & { ref?: Ref<IListRef<T>> },
) => ReactElement;

/**
 * This hook is intended for usage with the PostList component.
 * It allows tracking the currently focused post in the PostList
 * except opening the KBar doesn't clear the focused post (
 * normally opening the KBar receives focus so the PostList's
 * onPostFocused callback triggers with `null`). This simplifies
 * adding KBar commands that are dependent on the currently
 * focused post when the KBar is opened.
 */
export function useKBarAwareFocusedEntry<T>(
  entries: T[] | undefined,
  findFn: (entry: T, focusedEntry: T) => boolean,
) {
  const [currentlyFocusedEntry, setCurrentlyFocusedEntry] = useState<T | null>(
    null,
  );

  const [entryFocusedWhenKBarOpened, setEntryFocusedWhenKBarOpened] =
    useState<T | null>(null);

  useEffect(() => {
    const sub = KBarState.beforeOpen$.subscribe(() => {
      setEntryFocusedWhenKBarOpened(currentlyFocusedEntry);
    });

    const sub2 = KBarState.afterClose$.subscribe(() => {
      setEntryFocusedWhenKBarOpened(null);
    });

    sub.add(sub2);

    return () => sub.unsubscribe();
  }, [currentlyFocusedEntry]);

  const focusedEntry = entryFocusedWhenKBarOpened || currentlyFocusedEntry;

  const entry = useMemo(() => {
    if (!focusedEntry) return null;

    return entries?.find((e) => findFn(e, focusedEntry)) || null;
  }, [entries, findFn, focusedEntry]);

  return [entry, setCurrentlyFocusedEntry] as const;
}

/** The "to" argument must be a full route path. Relative routing is not supported. */
export function navigateToEntry(entryId: string, to: string) {
  const state = { ContentList: entryId };

  navigateService(location.href.replace(location.origin, ""), {
    replace: true,
    state,
  });

  navigateService(to);
}
