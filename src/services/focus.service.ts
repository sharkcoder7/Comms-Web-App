import { distinctUntilChanged, fromEvent, map, merge, shareReplay } from "rxjs";
import { startWith } from "~/utils/rxjs-operators";
import { useObservable } from "~/utils/useObservable";

export const WINDOW_FOCUSED$ = merge(
  fromEvent(window, "focus"),
  fromEvent(window, "blur"),
).pipe(
  map((e) => (e.type === "focus" ? true : false)),
  startWith(() => document.hasFocus()),
  distinctUntilChanged(),
  shareReplay(1),
);

export function useIsWindowFocused() {
  return useObservable(() => WINDOW_FOCUSED$, {
    synchronous: true,
  });
}
