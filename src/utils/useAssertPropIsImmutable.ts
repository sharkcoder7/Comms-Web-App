import { stripIndent } from "common-tags";
import { useRef } from "react";

const UNSET_VALUE = Symbol("Indicates value is unset");

/**
 * Hook which asserts that a given prop doesn't change between renders.
 * This hook only runs in dev and test modes. In production it is a noop.
 */
export function useAssertPropIsImmutable(
  propName: string,
  prop: unknown,
): void {
  if (import.meta.env.PROD) return;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const propRef = useRef<unknown>(UNSET_VALUE);

  if (propRef.current !== UNSET_VALUE && propRef.current !== prop) {
    throw new Error(
      stripIndent(`
        props.${propName} is expected to be immutable but it changed between renders.
        Previous value: ${propRef.current}
        Current value: ${prop}
      `),
    );
  }

  propRef.current = prop;
}
