import { renderHook } from "@testing-library/react-hooks";
import { useAssertPropIsImmutable } from "./useAssertPropIsImmutable";

describe("asserts that props.testProp is immutable for value", () => {
  it("string", () => {
    let testProp = "one";

    const harness = renderHook(() => {
      useAssertPropIsImmutable("testProp", testProp);
    });

    testProp = "two";

    harness.rerender();

    expect(harness.result.error).toBeInstanceOf(Error);
  });

  it("undefined", () => {
    let testProp: null | undefined = undefined;

    const harness = renderHook(() => {
      useAssertPropIsImmutable("testProp", testProp);
    });

    testProp = null;

    harness.rerender();

    expect(harness.result.error).toBeInstanceOf(Error);
  });
});
