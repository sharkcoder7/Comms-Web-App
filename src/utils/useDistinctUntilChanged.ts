import { useMemo, useRef } from "react";
import { isEqual as _isEqual } from "@libs/utils/isEqual";

/**
 * Hook which always returns the same object reference until
 * that object has changed as determined by a user provided
 * `isEqual` function. By default, a deep equality check is
 * performed.
 */
export function useDistinctUntilChanged<T>(
  value: T,
  isEqual: (a: T, b: T) => boolean = _isEqual,
): T {
  const previousValueRef = useRef(value);

  return useMemo(
    () =>
      isEqual(value, previousValueRef.current)
        ? previousValueRef.current
        : value,
    [isEqual, value],
  );
}
