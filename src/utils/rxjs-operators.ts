import { removeOneFromArray } from "@libs/utils/removeOneFromArray";
import {
  concat,
  debounceTime,
  defer,
  interval,
  map,
  Observable,
  OperatorFunction,
  pipe,
  share,
  Subject,
  take,
  UnaryFunction,
} from "rxjs";
import { areDecoderErrors, Decoder, DecoderResult } from "ts-decoders";

export function startWith<T, A = T>(
  ...values: ReadonlyArray<() => A>
): OperatorFunction<T, T | A> {
  return (source) => {
    return new Observable((observer) => {
      values.forEach((fn) => {
        observer.next(fn());
      });

      const subscription = source.subscribe(observer);

      return () => {
        subscription.unsubscribe();
      };
    });
  };
}

/** Default refresh interval is every second. */
export function currentTime(refreshIntervalMs = 1000) {
  return interval(refreshIntervalMs).pipe(
    startWith(() => new Date()),
    map(() => new Date()),
  );
}

export function mapToValidDecoderResult<A, B>(
  decoder: Decoder<B>,
): UnaryFunction<Observable<A>, Observable<B | null>> {
  return pipe(
    map((value) => {
      const result = decoder.decode(value) as DecoderResult<B>;

      if (areDecoderErrors(result)) {
        console.warn("Attempted to view invalid document.", result);
        return null;
      }

      return result.value;
    }),
  );
}

/**
 * This operator debounces emissions after the first.
 */
export function debounceSubsequentEmits<T>(ms: number) {
  return (source: Observable<T>) => {
    return concat(source.pipe(take(1)), source.pipe(debounceTime(ms)));
  };
}

export interface IIntersectionObserverObservable
  extends Observable<IntersectionObserverEntry> {
  complete(): void;
  observe(target: Element): void;
  unobserve(target: Element): void;
}

/**
 * You must call `observable.complete()` in order to clean up the underlying
 * IntersectionObserver.
 */
export function fromIntersectionObserver(options: IntersectionObserverInit) {
  const subject = new Subject<IntersectionObserverEntry>();

  let intersectionObserver: IntersectionObserver | undefined;

  let observe: Element[] = [];

  const obs = defer(() => {
    if (subject.closed) return subject;

    intersectionObserver = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) {
          subject.next(entry);
        }
      },
      options,
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    observe.forEach((target) => intersectionObserver!.observe(target));
    observe = [];

    return subject;
  }).pipe(
    // After initial subscription, share() will maintain a subscription to the source
    // observable until the subject completes.
    share(),
  ) as IIntersectionObserverObservable;

  obs.complete = () => {
    subject.complete();
    intersectionObserver?.disconnect();
  };

  obs.observe = (target: Element) => {
    if (!intersectionObserver) {
      observe.push(target);
    } else {
      intersectionObserver.observe(target);
    }
  };

  obs.unobserve = (target: Element) => {
    if (!intersectionObserver) {
      observe = removeOneFromArray(observe, (el) => el === target);
    } else {
      intersectionObserver.unobserve(target);
    }
  };

  return obs;
}
