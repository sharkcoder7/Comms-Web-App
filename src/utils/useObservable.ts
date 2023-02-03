import { Observable, Subscription, BehaviorSubject } from "rxjs";
import { useMemo, useRef } from "react";
import { useSubscription } from "use-subscription"; // published by fb
import { useOnUnmount } from "./useOnUnmount";

export function useObservable<A>(
  observableFactory: () => Observable<A>,
  options: {
    /**
     * Use this option to tell Typescript that the provided observable is
     * synchronous and does not need to be provided with an initial value.
     * This option is only used for proper typing of the hook
     * and has no runtime impact.
     */
    synchronous: true;
    deps?: unknown[];
  },
): A;
export function useObservable<A, B = A>(
  observableFactory: () => Observable<A>,
  options: {
    initialValue: B;
    deps?: unknown[];
  },
): A | B;
export function useObservable<A, B = A>(
  observableFactory: () => Observable<A>,
  options?: {
    synchronous?: boolean;
    initialValue?: B;
    deps?: unknown[];
  },
): A | B | undefined;
export function useObservable<A, B = A>(
  observableFactory: () => Observable<A>,
  {
    initialValue,
    deps = [],
  }: {
    synchronous?: boolean;
    initialValue?: B;
    deps?: unknown[];
  } = {},
): A | B | undefined {
  const factorySubscription = useRef<Subscription>();

  const store = useMemo(() => {
    const store = new BehaviorSubject<A | B | undefined>(initialValue);
    factorySubscription.current?.unsubscribe();
    factorySubscription.current = observableFactory().subscribe(store);
    return store;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useOnUnmount(() => factorySubscription.current?.unsubscribe());

  const useSubscriptionParam = useMemo(() => {
    return {
      getCurrentValue: () => store.getValue(),
      subscribe: (callback: () => void) => {
        const subscription = store.subscribe(callback);
        return () => subscription.unsubscribe();
      },
    };
  }, [store]);

  return useSubscription(useSubscriptionParam);
}
