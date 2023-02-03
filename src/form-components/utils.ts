import { isEqual } from "@libs/utils/isEqual";
import { FormEvent } from "react";
import { distinctUntilChanged, from, Observable } from "rxjs";
import { IFormGroup } from "solid-forms-react";
import {
  createRoot,
  createComputed,
  untrack,
  onCleanup,
  getOwner,
} from "solid-js";

type ObservableObserver<T> =
  | ((v: T) => void)
  | {
      next?: (v: T) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error?: (v: any) => void;
      complete?: (v: boolean) => void;
    };

// Workaround for
// https://github.com/solidjs/solid/issues/1110
export function observable<T>(input: () => T) {
  const obs = from({
    subscribe(observer: ObservableObserver<T>) {
      if (!(observer instanceof Object) || observer == null) {
        throw new TypeError("Expected the observer to be an object.");
      }

      const handler =
        typeof observer === "function"
          ? observer
          : observer.next?.bind(observer);

      if (!handler) return { unsubscribe() {} };

      const disposer = createRoot((disposer) => {
        createComputed(() => {
          const v = input();
          untrack(() => handler(v));
        });

        return disposer;
      });

      if (getOwner()) return onCleanup(disposer);

      return {
        unsubscribe() {
          disposer();
        },
      };
    },
    [Symbol.observable || "@@observable"]() {
      return this;
    },
  }) as Observable<T>;

  return obs.pipe(distinctUntilChanged(isEqual));
}

export function onSubmitFn<T extends IFormGroup>(
  control: T,
  fn: (value: T["rawValue"]) => Promise<void>,
) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    return handleSubmit(control, fn);
  };
}

export function handleSubmit<T extends IFormGroup>(
  control: T,
  fn: (value: T["rawValue"]) => Promise<void>,
) {
  control.markSubmitted(true);
  control.children.markTouched(true, { deep: true });

  // TODO
  // After toast notifications are implemented, when the
  // user attempts to submit a form that's not valid we should
  // give them a warning.
  if (control.status !== "VALID") return;

  return fn(control.rawValue);
}
