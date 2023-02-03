import {
  FocusEventHandler,
  KeyboardEvent,
  PropsWithChildren,
  ReactElement,
  useEffect,
  useRef,
} from "react";
import { delay, distinctUntilChanged, filter, fromEvent, map } from "rxjs";
import { useDistinctUntilChanged } from "~/utils/useDistinctUntilChanged";
import { useObservable } from "~/utils/useObservable";
import { EntryId, useListContext } from "./context";
import { useListScrollboxContext } from "./ListScrollbox";
import { Slot } from "@radix-ui/react-slot";

export type IListEntryProps<EntryData> = PropsWithChildren<{
  id: EntryId;
  data?: EntryData;
  disabled?: boolean;
  onFocusIn?: FocusEventHandler<HTMLElement>;
  onEntrySelect?: (event: KeyboardEvent<HTMLElement>) => void;
  children: ReactElement;
}>;

/**
 * An `<Entry>` for the `<List>` component.
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
export function Entry<EntryData>(props: IListEntryProps<EntryData>) {
  // We're just passing along the user provided `data` value.
  // To us, this value is unknown.
  const entryData = useDistinctUntilChanged(props.data as EntryData);

  const listContext = useListContext<EntryData>();

  const scrollboxContext = useListScrollboxContext();

  const entryRef = useRef<HTMLElement>(null);

  const disabled = props.disabled || false;

  const isEntryFocusable = useObservable(
    () =>
      listContext.focusableEntryId$.pipe(
        map((focusableEntryId) => props.id === focusableEntryId),
        distinctUntilChanged(),
      ),
    {
      synchronous: true,
      deps: [listContext.focusableEntryId$, props.id],
    },
  );

  // Important that we register the `removeEntry` callback
  // before the `mergeEntry` callback.
  useEffect(
    () => {
      return () => {
        listContext.removeEntry(props.id);
      };
    },
    // We remove the entry on disabled change and re-add it below to
    // force the currently focused item to automatically update.
    //
    // exhaustive-deps is incorrectly complaining that the `context`
    // object is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listContext.removeEntry, props.id, disabled],
  );

  // Register this entry with the parent list
  useEffect(
    () => {
      listContext.mergeEntry({
        id: props.id,
        data: entryData,
        disabled,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        node: entryRef.current!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        scrollboxEl: scrollboxContext.scrollboxRef.current!,
      });
    },
    // exhaustive-deps is incorrectly complaining that the `context`
    // object is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      entryRef.current,
      scrollboxContext.scrollboxRef.current,
      listContext.mergeEntry,
      props.id,
      entryData,
      disabled,
    ],
  );

  // Respond to focus events from the parent list
  useEffect(() => {
    const sub = listContext.focusedEntryId$
      .pipe(
        distinctUntilChanged(),
        filter((focusedEntryId) => focusedEntryId === props.id),
      )
      .subscribe(() => {
        const isFocusAlreadyWithinEntry =
          entryRef.current !== document.activeElement &&
          entryRef.current?.contains(document.activeElement);

        if (isFocusAlreadyWithinEntry) {
          // If a child of this entry currently has focus, we shouldn't focus this
          // entry. If, in the future, we'd like the ability to programmatically
          // focus an entry regardless of whether or not focus is already
          // within that entry, we'll need to refactor this code.
          return;
        }

        entryRef.current?.focus({ preventScroll: true });
      });

    return () => sub.unsubscribe();
  }, [entryRef, listContext.focusedEntryId$, props.id]);

  // Focus entry on mouseover, if appropriate and if the user isn't
  // scrolling.
  useEffect(() => {
    if (!listContext.focusEntryOnMouseOver) return;

    const mouseoverEvents = fromEvent(
      entryRef.current as unknown as HTMLElement,
      "mouseover",
    );

    const sub = mouseoverEvents
      .pipe(
        filter(() => !disabled),
        delay(10),
        filter(() => scrollboxContext.enableFocusOnMouseover.current),
      )
      .subscribe(() => {
        entryRef.current?.focus({ preventScroll: true });
      });

    return () => sub.unsubscribe();
  }, [
    scrollboxContext.enableFocusOnMouseover,
    disabled,
    listContext.focusEntryOnMouseOver,
  ]);

  return (
    <Slot
      ref={entryRef}
      tabIndex={isEntryFocusable ? 0 : -1}
      onFocus={(e) => {
        // IMPORTANT! React `onFocus` events are actually "focusin" events.
        // There currently is no way to get a standard onFocus event in
        // React.
        // See https://github.com/facebook/react/issues/6410

        if (disabled) {
          // If a disabled entry is somehow focused by the user (e.g. by clicking
          // on it), we should pretend like none of the entries are focused.
          // CSS can be used to hide the fact that this entry has focus
          // from the user.
          listContext.focusedEntryId$.next(null);
          return;
        }

        if (listContext.focusableEntryId$.getValue() !== props.id) {
          listContext.focusableEntryId$.next(props.id);
        }

        if (listContext.focusedEntryId$.getValue() !== props.id) {
          listContext.focusedEntryId$.next(props.id);
        }

        if (props.onFocusIn) {
          props.onFocusIn(e);
        }

        if (e.defaultPrevented) return;

        listContext.onEntryFocusIn?.(props.id, entryData);
      }}
      onBlur={(e) => {
        // IMPORTANT! React `onBlur` events are actually "focusout" events.
        // There currently is no way to get a standard onBlur event in
        // React.
        // See https://github.com/facebook/react/issues/6410

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const entryEl = entryRef.current!;

        const wasChildOfEntryFocused =
          entryEl !== e.relatedTarget && entryEl.contains(e.relatedTarget);

        const isEntryAlreadyConsideredFocusedByList =
          listContext.focusedEntryId$.getValue() === props.id;

        if (wasChildOfEntryFocused) {
          if (isEntryAlreadyConsideredFocusedByList) return;

          listContext.focusedEntryId$.next(props.id);
        } else {
          listContext.onEntryFocusLeave?.(props.id, entryData);

          if (!isEntryAlreadyConsideredFocusedByList) return;

          listContext.focusedEntryId$.next(null);
        }
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.stopPropagation();

        if (props.onEntrySelect) {
          props.onEntrySelect(e);
          if (e.defaultPrevented) return;
        }

        listContext.onEntrySelect?.(props.id, entryData);
      }}
      onClick={() => {
        if (disabled) return;
        listContext.onEntrySelect?.(props.id, entryData);
      }}
    >
      {props.children}
    </Slot>
  );
}
