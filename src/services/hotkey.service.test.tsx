import userEvent from "@testing-library/user-event";
import { useHotkeyContext } from "./hotkey.service";
import {
  Renderer,
  renderHook,
  RenderHookResult,
} from "@testing-library/react-hooks";
import { SpyInstanceFn } from "vitest";

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

describe("one component using useHotkeyContext", () => {
  let harness: RenderHookResult<unknown, void, Renderer<unknown>>;

  afterEach(() => {
    harness.unmount();
  });

  describe("one command", () => {
    let callback: SpyInstanceFn;

    beforeEach(() => {
      callback = vi.fn();

      harness = renderHook(() => {
        useHotkeyContext({
          id: "contextIdTest",
          commands: () => {
            return [
              {
                label: "test label",
                triggers: ["ArrowUp"],
                callback,
              },
            ];
          },
        });
      });
    });

    it("responds to trigger", () => {
      expect(callback.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowUp}");

      expect(callback.mock.calls.length).toBe(1);
    });

    it("ignores non-trigger", () => {
      expect(callback.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowDown}");

      expect(callback.mock.calls.length).toBe(0);
    });
  });

  describe("one sequence command", () => {
    let callback: SpyInstanceFn;

    beforeEach(() => {
      callback = vi.fn();

      harness = renderHook(() => {
        useHotkeyContext({
          id: "contextIdTest",
          commands: () => {
            return [
              {
                label: "test label",
                triggers: ["g i"],
                callback,
              },
            ];
          },
        });
      });
    });

    it("responds to trigger", () => {
      expect(callback.mock.calls.length).toBe(0);

      userEvent.keyboard("g");

      expect(callback.mock.calls.length).toBe(0);

      userEvent.keyboard("i");

      expect(callback.mock.calls.length).toBe(1);

      userEvent.keyboard("g");

      expect(callback.mock.calls.length).toBe(1);

      userEvent.keyboard("i");

      expect(callback.mock.calls.length).toBe(2);
    });

    describe("ignores non-trigger", () => {
      it("1", () => {
        expect(callback.mock.calls.length).toBe(0);

        userEvent.keyboard("p");

        expect(callback.mock.calls.length).toBe(0);

        userEvent.keyboard("i");

        expect(callback.mock.calls.length).toBe(0);
      });

      it("2", () => {
        expect(callback.mock.calls.length).toBe(0);

        userEvent.keyboard("g");

        expect(callback.mock.calls.length).toBe(0);

        userEvent.keyboard("p");

        expect(callback.mock.calls.length).toBe(0);
      });

      it("3", async () => {
        expect(callback.mock.calls.length).toBe(0);

        userEvent.keyboard("g");

        expect(callback.mock.calls.length).toBe(0);

        await wait(3000);

        userEvent.keyboard("i");

        expect(callback.mock.calls.length).toBe(0);
      });
    });
  });

  describe("two commands", () => {
    let callback: SpyInstanceFn;
    beforeEach(() => {
      callback = vi.fn();

      harness = renderHook(() => {
        useHotkeyContext({
          id: "contextIdTest",
          commands: () => {
            return [
              {
                label: "label one",
                triggers: ["ArrowUp", "ArrowDown"],
                callback: callback,
              },
            ];
          },
        });
      });
    });

    it("responds to first trigger", () => {
      expect(callback.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowUp}");

      expect(callback.mock.calls.length).toBe(1);
    });

    it("also responds to second trigger", () => {
      expect(callback.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowDown}");

      expect(callback.mock.calls.length).toBe(1);
    });
  });

  describe("two commands with overlap", () => {
    let callbackOne: SpyInstanceFn;
    let callbackTwo: SpyInstanceFn;

    beforeEach(() => {
      callbackOne = vi.fn();
      callbackTwo = vi.fn();

      harness = renderHook(() => {
        useHotkeyContext({
          id: "contextIdTest",
          commands: () => {
            return [
              {
                label: "label one",
                triggers: ["ArrowUp", "ArrowDown"],
                callback: callbackOne,
              },
              {
                label: "label two",
                triggers: ["ArrowUp"],
                callback: callbackTwo,
              },
            ];
          },
        });
      });
    });

    it("responds to first trigger", () => {
      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowUp}");

      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(1);
    });

    it("responds to second trigger", () => {
      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowDown}");

      expect(callbackOne.mock.calls.length).toBe(1);
      expect(callbackTwo.mock.calls.length).toBe(0);
    });

    it("ignores non-trigger", () => {
      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);

      userEvent.keyboard("a");

      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);
    });
  });

  describe("on re-render", () => {
    let callback: SpyInstanceFn;

    beforeEach(() => {
      callback = vi.fn();

      harness = renderHook(() => {
        useHotkeyContext({
          id: "contextIdTest",
          commands: () => {
            return [
              {
                label: "test label",
                triggers: ["ArrowUp"],
                callback,
              },
            ];
          },
        });
      });
    });

    it("has no side-effect on re-render", () => {
      expect(callback.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowUp}");

      expect(callback.mock.calls.length).toBe(1);

      harness.rerender();

      expect(callback.mock.calls.length).toBe(1);
    });
  });
});

describe("two components using useHotkeyContext", () => {
  let componentOne: RenderHookResult<unknown, void, Renderer<unknown>>;
  let componentTwo: RenderHookResult<unknown, void, Renderer<unknown>>;
  let componentThree: RenderHookResult<unknown, void, Renderer<unknown>>;

  afterEach(() => {
    componentOne.unmount();
    componentTwo.unmount();
    componentThree?.unmount();
  });

  describe("two commands with overlap", () => {
    let callbackOne: SpyInstanceFn;
    let callbackTwo: SpyInstanceFn;

    beforeEach(() => {
      callbackOne = vi.fn();
      callbackTwo = vi.fn();

      componentOne = renderHook(() => {
        useHotkeyContext({
          id: "componentOneTest",
          commands: () => {
            return [
              {
                label: "label one",
                triggers: ["ArrowUp", "ArrowDown"],
                callback: callbackOne,
              },
            ];
          },
        });
      });

      componentTwo = renderHook(() => {
        useHotkeyContext({
          id: "componentTwoTest",
          commands: () => {
            return [
              {
                label: "label two",
                triggers: ["ArrowUp"],
                callback: callbackTwo,
              },
            ];
          },
        });
      });
    });

    it("responds to first component's context trigger", () => {
      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowDown}");

      expect(callbackOne.mock.calls.length).toBe(1);
      expect(callbackTwo.mock.calls.length).toBe(0);
    });

    it("responds to second component's context trigger", () => {
      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowUp}");

      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(1);
    });

    it("ignores non-trigger", () => {
      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);

      userEvent.keyboard("a");

      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);
    });
  });

  describe("with `replace` updateStrategy", () => {
    let callbackOne: SpyInstanceFn;

    beforeEach(() => {
      callbackOne = vi.fn();

      componentOne = renderHook(() => {
        useHotkeyContext({
          id: "componentOneTest",
          commands: () => {
            return [
              {
                label: "label one",
                triggers: ["ArrowUp", "ArrowDown"],
                callback: callbackOne,
              },
            ];
          },
        });
      });

      componentTwo = renderHook(() => {
        useHotkeyContext({
          id: "componentTwoTest",
          updateStrategy: "replace",
          commands: () => [],
        });
      });
    });

    it("does not respond to first component's context triggers", () => {
      expect(callbackOne.mock.calls.length).toBe(0);

      userEvent.keyboard("{ArrowDown}");
      userEvent.keyboard("{ArrowUp}");

      expect(callbackOne.mock.calls.length).toBe(0);
    });
  });

  describe("with priorities", () => {
    let callbackOne: SpyInstanceFn;
    let callbackTwo: SpyInstanceFn;
    let callbackThree: SpyInstanceFn;

    beforeEach(() => {
      callbackOne = vi.fn();
      callbackTwo = vi.fn();
      callbackThree = vi.fn();

      componentOne = renderHook(() => {
        useHotkeyContext({
          id: "componentOneTest",
          priority: 1,
          commands: () => {
            return [
              {
                label: "label",
                triggers: ["ArrowUp", "ArrowDown"],
                callback: callbackOne,
              },
            ];
          },
        });
      });

      componentTwo = renderHook(() => {
        useHotkeyContext({
          id: "componentTwoTest",
          priority: 2,
          commands: () => {
            return [
              {
                label: "label",
                triggers: ["ArrowUp"],
                callback: callbackTwo,
              },
            ];
          },
        });
      });

      componentThree = renderHook(() => {
        useHotkeyContext({
          id: "componentThreeTest",
          commands: () => {
            return [
              {
                label: "label",
                triggers: ["ArrowUp", "ArrowDown", "ArrowRight"],
                callback: callbackThree,
              },
            ];
          },
        });
      });
    });

    it("responds to second component's context trigger", () => {
      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);
      expect(callbackThree.mock.calls.length).toBe(0);
      userEvent.keyboard("{ArrowUp}");

      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(1);
      expect(callbackThree.mock.calls.length).toBe(0);
    });

    it("responds to first component's context trigger", () => {
      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);
      expect(callbackThree.mock.calls.length).toBe(0);
      userEvent.keyboard("{ArrowDown}");

      expect(callbackOne.mock.calls.length).toBe(1);
      expect(callbackTwo.mock.calls.length).toBe(0);
      expect(callbackThree.mock.calls.length).toBe(0);
    });

    it("responds to third component's context trigger", () => {
      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);
      expect(callbackThree.mock.calls.length).toBe(0);
      userEvent.keyboard("{ArrowRight}");

      expect(callbackOne.mock.calls.length).toBe(0);
      expect(callbackTwo.mock.calls.length).toBe(0);
      expect(callbackThree.mock.calls.length).toBe(1);
    });
  });
});
