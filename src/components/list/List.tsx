import { stripIndent } from "common-tags";
import {
  ForwardedRef,
  forwardRef,
  ReactElement,
  Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { BehaviorSubject, filter, fromEvent, map } from "rxjs";
import useConstant from "use-constant";
import { domNodeComparer } from "~/utils/comparers";
import { EntryId, ListContext, IListContext } from "./context";
import { Slot } from "@radix-ui/react-slot";
import {
  elementPositionInContainer,
  scrollContainerToBottomOfElement,
  scrollContainerToTopOfElement,
} from "~/utils/view-helpers";
import { Writable } from "type-fest";

export interface IListProps<EntryData> {
  /**
   * Called when the user presses the "ArrowUp" key when they
   * are already at the top of a list.
   *
   * If this is `undefined`, then pressing "ArrowUp" will focus
   * the last entry in the list. Providing a custom
   * onArrowUpOverflow fn overwrites that behavior.
   */
  onArrowUpOverflow?: (e: KeyboardEvent) => void;
  /**
   * Called when the user presses the "ArrowDown" key when they
   * are already at the bottom of a list.
   *
   * If this is `undefined`, then pressing "ArrowDown" will focus
   * the first entry in the list. Providing a custom
   * onArrowDownOverflow fn overwrites that behavior.
   */
  onArrowDownOverflow?: (e: KeyboardEvent) => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  /**
   * Called when a user clicks on a list entry or when they focus
   * a list entry and press the "Enter" key.
   */
  onEntrySelect?: (id: EntryId, entryData: EntryData) => void;
  onEntryFocusIn?: (id: EntryId, entryData: EntryData) => void;
  onEntryFocusLeave?: (id: EntryId, entryData: EntryData) => void;
  initiallyFocusableEntryId?: EntryId;
  /** Automatically focus `initiallyFocusableEntryId` on mount */
  autoFocus?: boolean;
  focusEntryOnMouseOver?: boolean;
  children: ReactElement;
}

export interface IListEntry<EntryData> {
  readonly id: EntryId;
  readonly data: EntryData;
  readonly disabled: boolean;
  readonly node: HTMLElement;
  readonly scrollboxEl: HTMLElement;
}

export interface IListRef<EntryData> {
  entries: ReadonlyArray<IListEntry<EntryData>>;

  /**
   * If called without an ID, will focus the current focusableEntry.
   * If called with an ID, will focus the entry with that ID.
   */
  focus(id?: EntryId): void;
}

function _List<EntryData>(
  props: IListProps<EntryData>,
  ref?: ForwardedRef<IListRef<EntryData>>,
) {
  const containerRef = useRef<HTMLElement>(null);

  const entries: Array<Writable<IListEntry<EntryData>>> = useConstant(() => []);

  const focusableEntryId$: IListContext<EntryData>["focusableEntryId$"] =
    useConstant(() => new BehaviorSubject<EntryId | null>(null));

  const focusedEntryId$: IListContext<EntryData>["focusedEntryId$"] =
    useConstant(() => new BehaviorSubject<EntryId | null>(null));

  useImperativeHandle(ref, () => ({
    entries: entries as unknown as IListRef<EntryData>["entries"],
    focus(id?: EntryId) {
      if (focusableEntryId$.getValue() === null) return;
      if (id !== undefined && id !== focusableEntryId$.getValue()) {
        if (!entries.some((entry) => entry.id === id)) return;

        focusableEntryId$.next(id);
      }

      focusedEntryId$.next(focusableEntryId$.getValue());
    },
  }));

  const mergeEntry: IListContext<EntryData>["mergeEntry"] = useCallback(
    (args) => {
      const index = entries.findIndex((entry) => entry.id === args.id);

      if (index >= 0) {
        entries[index] = args;
      } else {
        entries.push(args);
        entries.sort((a, b) => domNodeComparer(a.node, b.node));
      }

      if (focusableEntryId$.getValue() === null && !args.disabled) {
        focusableEntryId$.next(args.id);
      }
    },
    [entries, focusableEntryId$],
  );

  const removeEntry: IListContext<EntryData>["removeEntry"] = useCallback(
    (removedEntryId) => {
      const index = entries.findIndex((entry) => entry.id === removedEntryId);

      entries.splice(index, 1);

      if (focusableEntryId$.getValue() !== removedEntryId) return;

      // Since we just removed the current focusable entry, we
      // try to make the next entry focusable if one exists.

      // using helper function to properly type `entries[index]`
      const getEntryForIndex = (index: number) =>
        entries[index] as typeof entries[number] | undefined;

      // The "next entry" is now at the index of the entry we just removed
      let nextFocusableEntryIndex = index;

      let nextFocusableEntry = getEntryForIndex(nextFocusableEntryIndex);

      // skip disabled entries
      while (nextFocusableEntry?.disabled) {
        nextFocusableEntryIndex += 1;
        nextFocusableEntry = getEntryForIndex(nextFocusableEntryIndex);
      }

      if (!nextFocusableEntry) {
        // If there is no focusable "next" entry, try to make a previous
        // entry focusable.

        nextFocusableEntryIndex = index - 1;
        nextFocusableEntry = getEntryForIndex(nextFocusableEntryIndex);

        // skip disabled entries
        while (nextFocusableEntry?.disabled) {
          nextFocusableEntryIndex -= 1;
          nextFocusableEntry = getEntryForIndex(nextFocusableEntryIndex);
        }
      }

      const nextFocusableEntryId = nextFocusableEntry?.id ?? null;

      focusableEntryId$.next(nextFocusableEntryId);

      if (focusedEntryId$.getValue() === removedEntryId) {
        focusedEntryId$.next(nextFocusableEntryId);
      }
    },
    [entries, focusableEntryId$, focusedEntryId$],
  );

  // When the list is initially rendered in the DOM, we want
  // to set `focusableEntryId$` and also focus that entry if
  // appropriate.
  useEffect(
    () => {
      const focusedEntry =
        props.initiallyFocusableEntryId === undefined
          ? entries.find((entry) => !entry.disabled)
          : entries.find(
              (entry) =>
                !entry.disabled && entry.id === props.initiallyFocusableEntryId,
            ) || entries.find((entry) => !entry.disabled);

      if (!focusedEntry) return;

      focusableEntryId$.next(focusedEntry.id);

      if (!props.autoFocus) return;

      // Without this setTimeout, if you attempt to focus an entry in a long list
      // where the entry is off the screen sometimes that entry will focus but
      // the entry isn't automatically scrolled into view.
      const timeout = setTimeout(() => {
        focusedEntryId$.next(focusedEntry.id);
        focusedEntry.node.scrollIntoView({ block: "start" });

        const originalScrollTop = focusedEntry.scrollboxEl.scrollTop;

        focusedEntry.scrollboxEl.scrollTop += 1;

        const isMaxScrollTop =
          originalScrollTop === focusedEntry.scrollboxEl.scrollTop;

        // if scrolling the element into view hasn't scrolled to the
        // bottom of the container, then lets give a little vertical
        // space above the element. But if we're at the bottom of the
        // container, then the element is probably in the lower half
        // of the viewport anyways so lets not bother giving any more
        // vertical space above the element (it probably has a lot
        // already).

        if (!isMaxScrollTop) {
          focusedEntry.scrollboxEl.scrollTop -= 35;
        }
      }, 0);

      return () => clearTimeout(timeout);
    },
    // We only want to run this setup code on mount and not
    // when the deps change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // handle keyboard events for this list
  useEffect(
    () => {
      const sub = fromEvent<KeyboardEvent>(
        // refs are set by react before calling useEffect hooks
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        containerRef.current as unknown as HTMLElement | SVGElement,
        "keydown",
      )
        .pipe(
          filter(
            (e) =>
              e.key === "ArrowUp" ||
              e.key === "ArrowDown" ||
              (!!props.onArrowLeft && e.key === "ArrowLeft") ||
              (!!props.onArrowRight && e.key === "ArrowRight"),
          ),
          filter(() => entries.length > 0),
          map((e) => {
            const keyPressed = e.key;

            if (keyPressed === "ArrowLeft") {
              if (props.onArrowLeft) {
                props.onArrowLeft();
                return e;
              }

              return;
            } else if (keyPressed === "ArrowRight") {
              if (props.onArrowRight) {
                props.onArrowRight();
                return e;
              }

              return;
            }

            const currentFocusableId = focusableEntryId$.getValue();

            if (currentFocusableId === null) {
              console.error(
                stripIndent(`
                List: entries exist but focusableEntryId$ value was null. 
                This should never happen.
              `),
              );

              return;
            }

            const currentFocusableIndex = entries.findIndex(
              (entry) => entry.id === currentFocusableId,
            );

            if (currentFocusableIndex < 0) {
              console.error(
                stripIndent(`
                List: entry for currentFocusableId does not exist
              `),
              );

              return;
            }

            const currentEntry = entries[currentFocusableIndex];

            const wasViewScrolled = maybeScrollViewInsteadOfFocusingNextEntry(
              keyPressed,
              currentEntry,
            );

            if (wasViewScrolled) return e;

            const indexOfLastEntry = entries.length - 1;
            const indexChange = keyPressed === "ArrowUp" ? -1 : 1;

            let entryIndex = currentFocusableIndex;
            let didListFocusOverflow = false;

            function incrementEntryIndex(e: KeyboardEvent) {
              entryIndex += indexChange;

              if (entryIndex < 0) {
                // here we're trying to move to the previous entry in the
                // list but we are already at the first entry

                if (props.onArrowUpOverflow) {
                  props.onArrowUpOverflow(e);
                  return false;
                }

                entryIndex = indexOfLastEntry;
                didListFocusOverflow = true;
              } else if (entryIndex > indexOfLastEntry) {
                // here we're trying to move to the next entry in the
                // list but we're already at the last entry

                if (props.onArrowDownOverflow) {
                  props.onArrowDownOverflow(e);
                  return false;
                }

                entryIndex = 0;
                didListFocusOverflow = true;
              } else if (entryIndex === currentFocusableIndex) {
                // This indicates that we've iterated through the entire list
                // and are back where we started. I.e. we're in an infinite loop.
                return false;
              }
            }

            if (incrementEntryIndex(e) === false) return e;

            let nextEntry = entries.at(entryIndex);

            // skip disabled entries
            while (nextEntry?.disabled) {
              if (incrementEntryIndex(e) === false) return e;
              nextEntry = entries.at(entryIndex);
            }

            if (!nextEntry) return;

            focusableEntryId$.next(nextEntry.id);
            focusedEntryId$.next(nextEntry.id);

            scrollViewToNextEntryIfAppropriate(
              keyPressed,
              nextEntry,
              didListFocusOverflow,
            );
          }),
        )
        .subscribe((event) => {
          if (!event) return;

          event.preventDefault();
          event.stopPropagation();
        });

      return () => sub.unsubscribe();
    },
    // exhaustive-deps is incorrectly complaining that the `prop`
    // object is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      containerRef,
      entries,
      focusableEntryId$,
      focusedEntryId$,
      props.onArrowUpOverflow,
      props.onArrowDownOverflow,
      props.onArrowLeft,
      props.onArrowRight,
    ],
  );

  const context = useMemo<IListContext<EntryData>>(() => {
    return {
      focusableEntryId$,
      focusedEntryId$,
      focusEntryOnMouseOver: props.focusEntryOnMouseOver || false,
      mergeEntry,
      removeEntry,
      onEntrySelect: props.onEntrySelect,
      onEntryFocusIn: props.onEntryFocusIn,
      onEntryFocusLeave: props.onEntryFocusLeave,
    };
  }, [
    focusableEntryId$,
    focusedEntryId$,
    props.focusEntryOnMouseOver,
    mergeEntry,
    removeEntry,
    props.onEntrySelect,
    props.onEntryFocusIn,
    props.onEntryFocusLeave,
  ]);

  return (
    <ListContext.Provider value={context}>
      <Slot ref={containerRef}>{props.children}</Slot>
    </ListContext.Provider>
  );
}

/**
 * Keyboard Accessible List component which allows focusing entries via
 * ArrowUp and ArrowDown. Remembers last focused element and returns focus to it when
 * tabbing from another element to this list.
 *
 * Example:
 *
 * ```ts
 * <List<IPostDoc>>
 *   <ul>
 *     {posts.map((post) => (
 *       <li>
 *         <List.Entry<IPostDoc>
 *           key={post.id}
 *           id={post.id}
 *           data={post}
 *         >
 *           <Post post={post} />
 *         </List.Entry>
 *       </li>
 *     ))}
 *   </ul>
 * </List>
 * ```
 */
// This is a type hack to support a generic component while using `forwardRef`.
// See https://stackoverflow.com/a/58473012/5490505
export const List = forwardRef(_List) as <EntryData>(
  props: IListProps<EntryData> & { ref?: Ref<IListRef<EntryData>> },
) => ReactElement;

/**
 * Before attempting to focus the next entry, we
 * need to check to see if the current entry's top
 * (for navigating up) or bottom (for navigating down)
 * is in the view. If it isn't, we need to scroll the
 * view. If it is, then we can focus the next entry.
 */
function maybeScrollViewInsteadOfFocusingNextEntry(
  keyPressed: string,
  currentEntry: Writable<IListEntry<unknown>>,
) {
  const {
    top: currentEntryTopPlacementInView,
    bottom: currentEntryBottomPlacementInView,
  } = elementPositionInContainer(currentEntry.scrollboxEl, currentEntry.node);

  if (keyPressed === "ArrowUp") {
    if (currentEntryBottomPlacementInView === "above") {
      scrollContainerToBottomOfElement(
        currentEntry.scrollboxEl,
        currentEntry.node,
      );

      return true;
    } else if (currentEntryTopPlacementInView === "above") {
      currentEntry.scrollboxEl.scrollTo({
        top: currentEntry.scrollboxEl.scrollTop - 100,
      });

      return true;
    }
  } else {
    if (currentEntryTopPlacementInView === "below") {
      scrollContainerToTopOfElement(
        currentEntry.scrollboxEl,
        currentEntry.node,
      );

      return true;
    } else if (currentEntryBottomPlacementInView === "below") {
      currentEntry.scrollboxEl.scrollTo({
        top: currentEntry.scrollboxEl.scrollTop + 100,
      });

      return true;
    }
  }

  return false;
}

function scrollViewToNextEntryIfAppropriate(
  keyPressed: string,
  nextEntry: Writable<IListEntry<unknown>>,
  /**
   * e.g. did the user press ArrowDown when the last
   * entry was already focused causing focus to wrap
   * around to the first entry again.
   */
  didListFocusOverflow: boolean,
) {
  const {
    top: nextEntryTopPlacementInView,
    bottom: nextEntryBottomPlacementInView,
  } = elementPositionInContainer(nextEntry.scrollboxEl, nextEntry.node);

  if (keyPressed === "ArrowUp") {
    if (didListFocusOverflow) {
      if (nextEntryBottomPlacementInView === "below") {
        scrollContainerToBottomOfElement(nextEntry.scrollboxEl, nextEntry.node);
        return true;
      }
    } else if (nextEntryBottomPlacementInView !== "visible") {
      scrollContainerToBottomOfElement(nextEntry.scrollboxEl, nextEntry.node);
      return true;
    }
  } else {
    if (didListFocusOverflow) {
      if (nextEntryTopPlacementInView === "above") {
        scrollContainerToTopOfElement(nextEntry.scrollboxEl, nextEntry.node);
        return true;
      }
    } else if (nextEntryTopPlacementInView !== "visible") {
      scrollContainerToTopOfElement(nextEntry.scrollboxEl, nextEntry.node);
      return true;
    }
  }

  return false;
}
