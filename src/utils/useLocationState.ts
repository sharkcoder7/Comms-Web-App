import { useMemo } from "react";
import { useLocation } from "react-router-dom";

/**
 * Gets value associated with specified `key` if
 * `location.state` is an object. Else undefined.
 */
export function useLocationState<T>(key: string) {
  const location = useLocation();

  return useMemo(() => {
    const routerState =
      typeof location.state === "object"
        ? (location.state as Record<string, T> | null)
        : null;

    return routerState?.[key] ?? undefined;
  }, [key, location.state]);
}
