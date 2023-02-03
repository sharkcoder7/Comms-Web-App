import * as Dialog from "@radix-ui/react-dialog";
import { ComponentType, useEffect, useRef, useState } from "react";
import { usePortalContext } from "~/services/portal.service";
import { css, cx } from "@emotion/css";
import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  scan,
  shareReplay,
  skip,
  Subject,
  tap,
} from "rxjs";

const openDialogCount$ = new Subject<number>();

export const isAnyDialogOpen$ = openDialogCount$.pipe(
  tap(console.log),
  scan((total, curr) => total + curr, 0),
  tap(console.log),
  map((count) => count > 0),
  shareReplay(1),
);

export interface IDialogOptions<
  P extends Record<string, unknown>,
  Data = unknown,
> {
  dialogState: DialogState<Data>;
  Component: ComponentType<P & { data: Data }>;
  containerCSS?: string;
  overlayCSS?: string;
  /**
   * A react hook that should be called when the dialog container is rendered
   * The dialog container is rendered even if the dialog itself is closed.
   * This is useful for registering hotkeys or kbar commands which should
   * be available even when the dialog is closed. However, this hook will
   * only be called when the dialog is included in the current component
   * tree.
   */
  useOnDialogContainerRendered?: (props: P) => void;
}

export function withModalDialog<
  P extends Record<string, unknown>,
  Data = unknown,
>(options: IDialogOptions<P, Data>): ComponentType<Omit<P, "data">> {
  const { Component } = options;

  return (_props) => {
    // type hack
    const props = _props as P;

    const { container } = usePortalContext();

    const [dialogData, setDialogData] = useState<Data | null | undefined>(
      undefined,
    );

    const isOpen = dialogData !== undefined;

    const previouslyFocusedElRef = useRef<
      (Element & { focus?(): void }) | null
    >(null);

    useEffect(() => {
      const subscription = options.dialogState.isOpen$.subscribe(
        ({ isOpen, data }) => {
          if (isOpen) {
            previouslyFocusedElRef.current = document.activeElement;
            setDialogData(data ?? null);
          } else {
            setDialogData(undefined);

            // TODO: fix this now that you've removed setTimeout
            // Original message:
            // I don't know why setTimeout is needed here, but if
            // we don't include the setTimeout then, when a dialog is
            // closed, the webpage *may* (but it seems to happen often)
            // completely lose focus and all event listeners stop
            // responding. The user must click with the mouse somewhere
            // on the page to make event listeners respond again. What's
            // so strange about this, is that the Chrome Devtools indicate
            // that the body element is focused but it's listeners aren't
            // responding, and then you click on the body element (so there's
            // no focus change) but all of a sudden it's listeners start
            // responding. You can't even properly focus the body element
            // without the setTimeout.
            if (
              typeof previouslyFocusedElRef.current?.focus === "function" &&
              document.body.contains(previouslyFocusedElRef.current)
            ) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              previouslyFocusedElRef.current?.focus?.();
            } else {
              document.body.focus();
            }
          }
        },
      );

      return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
      openDialogCount$.next(options.dialogState.isOpen() ? 1 : 0);

      const subscription = options.dialogState.isOpen$
        .pipe(
          map((d) => d.isOpen),
          distinctUntilChanged(),
          skip(1),
        )
        .subscribe((isOpen) => {
          openDialogCount$.next(isOpen ? 1 : -1);
        });

      return () => {
        subscription.unsubscribe();
      };
    }, []);

    options.useOnDialogContainerRendered?.(props);

    return (
      <Dialog.Root open={isOpen}>
        <Dialog.Portal container={container}>
          <Dialog.Overlay
            className={options.overlayCSS || DIALOG_OVERLAY_CSS}
          />

          <Dialog.Content
            className={options.containerCSS || DIALOG_CONTAINER_CSS}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
            {isOpen && <Component {...props} data={dialogData!} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  };
}

export const DIALOG_OVERLAY_CSS =
  "fixed inset-0 bg-blackA-9 width-screen height-screen";

const classnamesToCenterModal =
  "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";

export const DIALOG_CONTAINER_CSS = cx(
  classnamesToCenterModal,
  "flex flex-col rounded focus:outline-none",
  css`
    width: 90vw;
    max-width: 600px;
    max-height: 85vh;
  `,
);

export const DialogTitle: ComponentType<{}> = (props) => {
  return (
    <div className="flex items-center bg-mauveDark-6 text-white px-6 h-11">
      {props.children}
    </div>
  );
};

export const DIALOG_CONTENT_WRAPPER_CSS = cx(
  "flex flex-col flex-1 bg-white",
  css`
    max-height: calc(85vh - 44px);
  `,
);

export class DialogState<Data = unknown> {
  private _isOpen$ = new BehaviorSubject<{ isOpen: boolean; data?: Data }>({
    isOpen: false,
  });

  /**
   * Returns the current open state of the dialog.
   */
  isOpen() {
    return this._isOpen$.getValue().isOpen;
  }

  /**
   * Observable of the dialog's current open state.
   * Immediately returns current state upon subscription.
   */
  readonly isOpen$ = this._isOpen$.pipe(distinctUntilChanged());

  private _beforeOpen$ = new Subject<Data | undefined>();
  readonly beforeOpen$ = this._beforeOpen$.asObservable();

  private _afterOpen$ = new Subject<Data | undefined>();
  readonly afterOpen$ = this._afterOpen$.asObservable();

  private _beforeClose$ = new Subject<Data | undefined>();
  readonly beforeClose$ = this._beforeClose$.asObservable();

  private _afterClose$ = new Subject<Data | undefined>();
  readonly afterClose$ = this._afterClose$.asObservable();

  /**
   * If called without arguments, toggles the current dialog open state.
   * Otherwise, sets the state to the provided value.
   */
  toggle(isOpen?: boolean, data?: Data) {
    const newValue = isOpen ?? !this.isOpen();

    if (newValue === this.isOpen()) return;

    if (newValue) {
      this._beforeOpen$.next(data);
    } else {
      this._beforeClose$.next(data);
    }

    this._isOpen$.next({ isOpen: newValue, data });

    if (newValue) {
      this._afterOpen$.next(data);
    } else {
      this._afterClose$.next(data);
    }
  }
}
