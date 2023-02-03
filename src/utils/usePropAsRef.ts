import { useRef } from "react";

export function usePropAsRef<T>(prop: T) {
  const ref = useRef(prop);
  ref.current = prop;
  return ref;
}
