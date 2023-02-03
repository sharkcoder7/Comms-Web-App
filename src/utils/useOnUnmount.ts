import { useEffect } from "react";

export function useOnUnmount(fn: () => void) {
  useEffect(() => {
    return fn;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
