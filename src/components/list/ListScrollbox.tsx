import {
  createContext,
  forwardRef,
  MutableRefObject,
  PropsWithChildren,
  ReactElement,
  RefObject,
  useContext,
  useEffect,
  useRef,
} from "react";
import { fromEvent, throttleTime } from "rxjs";
import { Slot } from "@radix-ui/react-slot";
import { useComposedRefs } from "~/utils/useComposedRefs";

export interface IListScrollboxContext {
  enableFocusOnMouseover: MutableRefObject<boolean>;
  scrollboxRef: RefObject<HTMLElement>;
}

const ListScrollboxContext = createContext<IListScrollboxContext | null>(null);

export function useListScrollboxContext() {
  const context = useContext<IListScrollboxContext | null>(
    ListScrollboxContext,
  );

  if (!context) {
    throw new Error(
      "Must provide ListScrollboxContext. Use " +
        "ListScrollbox for the list container.",
    );
  }

  return context;
}

/**
 * This component is intended to be the scrollbox for `List.Entry` components.
 * It surpresses the List.Entry's focusOnMouseOver (if enabled) when this
 * scrollbox is scrolling. This is necessary to avoid scrolling from triggering
 * mouseover events and unintentionally focusing list entries when the user is
 * using keyboard navigation.
 */
export const ListScrollbox = forwardRef<
  HTMLElement,
  PropsWithChildren<{ children: ReactElement }>
>((props, forwardedRef) => {
  const ref = useRef<HTMLElement | null>(null);
  const enableFocusOnMouseover = useRef(true);
  const composedRefs = useComposedRefs(forwardedRef, ref);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const scrollEvents = fromEvent(ref.current!, "scroll");

    let timeout: number | null = null;

    const sub = scrollEvents.pipe(throttleTime(200)).subscribe(() => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }

      enableFocusOnMouseover.current = false;

      timeout = setTimeout(() => {
        enableFocusOnMouseover.current = true;
      }, 300) as unknown as number;
    });

    return () => sub.unsubscribe();
  }, []);

  return (
    <ListScrollboxContext.Provider
      value={{ enableFocusOnMouseover, scrollboxRef: ref }}
    >
      <Slot ref={composedRefs} className="relative">
        {props.children}
      </Slot>
    </ListScrollboxContext.Provider>
  );
});
