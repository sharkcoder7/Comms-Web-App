/* eslint-disable @typescript-eslint/no-non-null-assertion */
import userEvent from "@testing-library/user-event";
import { IListProps, List } from "./List";
import { Entry } from "./Entry";
import { render, RenderResult } from "@testing-library/react";
import { ListScrollbox } from "./ListScrollbox";
import { wait } from "@testing-library/user-event/dist/utils";

let harness: RenderResult;

afterEach(() => {
  harness.unmount();
});

describe("one entry", () => {
  let listEl: Element | null;
  let entryEl: Element | null | undefined;

  beforeEach(() => {
    harness = render(
      <List<string>>
        <ListScrollbox>
          <ul>
            <Entry<string> id="one" data="one">
              <li id="one">one</li>
            </Entry>
          </ul>
        </ListScrollbox>
      </List>,
    );

    listEl = harness.container.firstElementChild;
    entryEl = listEl?.querySelector("#one");
  });

  it("renders", () => {
    expect(listEl).toBeInstanceOf(HTMLUListElement);

    expect(entryEl).toBeInstanceOf(HTMLLIElement);
    expect(entryEl).toHaveAttribute("id", "one");
    expect(entryEl).toHaveAttribute("tabindex", "0");
    expect(entryEl).toHaveTextContent("one");
    expect(entryEl).not.toHaveFocus();
  });

  it("focuses on tab", () => {
    const containerSnapshot1 = harness.container.cloneNode(true);

    userEvent.tab();

    expect(entryEl).toHaveAttribute("tabindex", "0");
    expect(entryEl).toHaveFocus();
    expect(harness.container).toEqual(containerSnapshot1);

    userEvent.tab();

    expect(entryEl).toHaveAttribute("tabindex", "0");
    expect(entryEl).not.toHaveFocus();
    expect(harness.container).toEqual(containerSnapshot1);
  });
});

describe("focusEntryOnMouseOver prop", () => {
  let listEl: Element | null;
  let entryEl: Element | null | undefined;

  function initializeTestHarness(focusEntryOnMouseOver: boolean) {
    harness = render(
      <List<string> focusEntryOnMouseOver={focusEntryOnMouseOver}>
        <ListScrollbox>
          <ul>
            <Entry<string> id="one" data="one">
              <li id="one">one</li>
            </Entry>
          </ul>
        </ListScrollbox>
      </List>,
    );

    listEl = harness.container.firstElementChild;
    entryEl = listEl?.querySelector("#one");
  }

  it("false", () => {
    initializeTestHarness(false);

    expect(entryEl).not.toHaveFocus();

    userEvent.hover(entryEl!);

    expect(entryEl).not.toHaveFocus();
  });

  it("true", async () => {
    initializeTestHarness(true);

    expect(entryEl).not.toHaveFocus();

    userEvent.hover(entryEl!);

    expect(entryEl).not.toHaveFocus();

    await wait(10);

    expect(entryEl).toHaveFocus();
  });
});

describe("three entries", () => {
  let entries: Array<{ id: string; data: string }> = [];
  let listEl: HTMLElement | null;
  let entryEl1: HTMLElement | null | undefined;
  let entryEl2: HTMLElement | null | undefined;
  let entryEl3: HTMLElement | null | undefined;

  function initializeTestHarness(
    args: Omit<IListProps<string>, "children"> = {},
  ) {
    entries = [
      { id: "one", data: "one" },
      { id: "two", data: "two" },
      { id: "three", data: "three" },
    ];

    harness = render(
      <List<string> {...args}>
        <ListScrollbox>
          <nav>
            {entries.map((entry) => (
              <Entry<string> key={entry.id} id={entry.id} data={entry.data}>
                <a id={entry.id}>{entry.data}</a>
              </Entry>
            ))}
          </nav>
        </ListScrollbox>
      </List>,
    );

    listEl = harness.container.firstElementChild as HTMLElement | null;
    entryEl1 = listEl?.querySelector("#one");
    entryEl2 = listEl?.querySelector("#two");
    entryEl3 = listEl?.querySelector("#three");
  }

  it("renders", () => {
    initializeTestHarness();

    expect(listEl).toBeInstanceOf(HTMLElement);
    expect(listEl?.childElementCount).toBe(3);

    expect(entryEl1).toBeInstanceOf(HTMLAnchorElement);
    expect(entryEl1).toHaveAttribute("id", "one");
    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl1).toHaveTextContent("one");
    expect(entryEl1).not.toHaveFocus();

    expect(entryEl2).toBeInstanceOf(HTMLAnchorElement);
    expect(entryEl2).toHaveAttribute("id", "two");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveTextContent("two");
    expect(entryEl2).not.toHaveFocus();

    expect(entryEl3).toBeInstanceOf(HTMLAnchorElement);
    expect(entryEl3).toHaveAttribute("id", "three");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveTextContent("three");
    expect(entryEl3).not.toHaveFocus();
  });

  it("focuses on tab", () => {
    initializeTestHarness();

    const containerSnapshot1 = harness.container.cloneNode(true);

    userEvent.tab();

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).toHaveFocus();
    expect(harness.container).toEqual(containerSnapshot1);

    userEvent.tab();

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).not.toHaveFocus();
    expect(harness.container).toEqual(containerSnapshot1);
  });

  it("responds to arrow keys when focused", () => {
    initializeTestHarness();

    userEvent.tab();

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).toHaveFocus();

    userEvent.keyboard("{ArrowDown}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveFocus();

    userEvent.keyboard("{ArrowDown}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveFocus();
  });

  it("ignores arrow keys when not focused", () => {
    initializeTestHarness();

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).not.toHaveFocus();
    expect(entryEl2).not.toHaveFocus();
    expect(entryEl3).not.toHaveFocus();

    userEvent.keyboard("{ArrowDown}");

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).not.toHaveFocus();
    expect(entryEl2).not.toHaveFocus();
    expect(entryEl3).not.toHaveFocus();
  });

  it("when entry focused from the outside", () => {
    initializeTestHarness();

    entryEl3?.focus();

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveFocus();
  });

  it("without onArrowDownOverflow wraps text", () => {
    initializeTestHarness();

    entryEl3?.focus();

    expect(entryEl3).toHaveFocus();

    userEvent.keyboard("{ArrowDown}");

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).toHaveFocus();
  });

  it("without onArrowUpOverflow wraps text", () => {
    initializeTestHarness();

    entryEl1?.focus();

    expect(entryEl1).toHaveFocus();

    userEvent.keyboard("{ArrowUp}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveFocus();
  });

  it("with onArrowDownOverflow", () => {
    const callback = vi.fn();

    initializeTestHarness({
      onArrowDownOverflow: callback,
    });

    entryEl3?.focus();

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveFocus();
    expect(callback.mock.calls.length).toBe(0);

    userEvent.keyboard("{ArrowDown}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveFocus();
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowUp}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveFocus();
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowDown}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveFocus();
    expect(callback.mock.calls.length).toBe(1);
  });

  it("with onArrowUpOverflow", () => {
    const callback = vi.fn();

    initializeTestHarness({
      onArrowUpOverflow: callback,
    });

    userEvent.tab();

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).toHaveFocus();
    expect(callback.mock.calls.length).toBe(0);

    userEvent.keyboard("{ArrowUp}");

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).toHaveFocus();
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowDown}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveFocus();
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowUp}");

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).toHaveFocus();
    expect(callback.mock.calls.length).toBe(1);
  });

  it("with onArrowLeft", () => {
    const callback = vi.fn();

    initializeTestHarness({
      onArrowLeft: callback,
    });

    userEvent.keyboard("{ArrowLeft}");
    expect(callback.mock.calls.length).toBe(0);

    userEvent.tab();

    expect(entryEl1).toHaveFocus();
    expect(callback.mock.calls.length).toBe(0);

    userEvent.keyboard("{ArrowLeft}");
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowRight}");
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowDown}");
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowUp}");
    expect(callback.mock.calls.length).toBe(1);
  });

  it("with onArrowRight", () => {
    const callback = vi.fn();

    initializeTestHarness({
      onArrowRight: callback,
    });

    userEvent.keyboard("{ArrowRight}");
    expect(callback.mock.calls.length).toBe(0);

    userEvent.tab();

    expect(entryEl1).toHaveFocus();
    expect(callback.mock.calls.length).toBe(0);

    userEvent.keyboard("{ArrowRight}");
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowLeft}");
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowDown}");
    expect(callback.mock.calls.length).toBe(1);

    userEvent.keyboard("{ArrowUp}");
    expect(callback.mock.calls.length).toBe(1);
  });

  it("with onEntryFocus", () => {
    const callback = vi.fn();

    initializeTestHarness({
      onEntryFocusIn: callback,
    });

    userEvent.tab();

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).toHaveFocus();
    expect(callback.mock.calls).toEqual([["one", "one"]]);

    userEvent.keyboard("{ArrowDown}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveFocus();
    expect(callback.mock.calls).toEqual([
      ["one", "one"],
      ["two", "two"],
    ]);
  });

  it("with onEntrySelect", () => {
    const callback = vi.fn();

    initializeTestHarness({
      onEntrySelect: callback,
    });

    userEvent.tab();

    expect(entryEl1).toHaveAttribute("tabindex", "0");
    expect(entryEl2).toHaveAttribute("tabindex", "-1");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl1).toHaveFocus();
    expect(callback.mock.calls.length).toBe(0);

    userEvent.keyboard("{ArrowDown}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveFocus();
    expect(callback.mock.calls.length).toBe(0);

    userEvent.keyboard("{Enter}");

    expect(entryEl1).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveAttribute("tabindex", "0");
    expect(entryEl3).toHaveAttribute("tabindex", "-1");
    expect(entryEl2).toHaveFocus();
    expect(callback.mock.calls).toEqual([["two", "two"]]);

    userEvent.click(entryEl3!);

    expect(callback.mock.calls).toEqual([
      ["two", "two"],
      ["three", "three"],
    ]);
  });
});

describe("with disabled entries", () => {
  let entries: Array<{ id: string; data: string; disabled?: boolean }> = [];
  let listEl: HTMLElement | null;
  let entryEl1: HTMLElement | null | undefined;
  let entryEl2: HTMLElement | null | undefined;
  let entryEl3: HTMLElement | null | undefined;
  let entryEl4: HTMLElement | null | undefined;

  describe("in middle of list", () => {
    beforeEach(() => {
      entries = [
        { id: "one", data: "one" },
        { id: "two", data: "two", disabled: true },
        { id: "three", data: "three", disabled: true },
        { id: "four", data: "four" },
      ];

      harness = render(
        <List<string>>
          <ListScrollbox>
            <nav>
              {entries.map((entry) => (
                <Entry<string> key={entry.id} {...entry}>
                  <button id={entry.id} type="button" disabled={entry.disabled}>
                    {entry.data}
                  </button>
                </Entry>
              ))}
            </nav>
          </ListScrollbox>
        </List>,
      );

      listEl = harness.container.firstElementChild as HTMLElement | null;
      entryEl1 = listEl?.querySelector("#one");
      entryEl2 = listEl?.querySelector("#two");
      entryEl3 = listEl?.querySelector("#three");
      entryEl4 = listEl?.querySelector("#four");
    });

    it("renders", () => {
      expect(listEl).toBeInstanceOf(HTMLElement);
      expect(listEl?.childElementCount).toBe(4);

      expect(entryEl1).toBeInstanceOf(HTMLButtonElement);
      expect(entryEl1).toHaveAttribute("id", "one");
      expect(entryEl1).toHaveAttribute("tabindex", "0");
      expect(entryEl1).toHaveTextContent("one");
      expect(entryEl1).not.toBeDisabled();
      expect(entryEl1).not.toHaveFocus();

      expect(entryEl2).toBeInstanceOf(HTMLButtonElement);
      expect(entryEl2).toHaveAttribute("id", "two");
      expect(entryEl2).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveTextContent("two");
      expect(entryEl2).toBeDisabled();
      expect(entryEl2).not.toHaveFocus();

      expect(entryEl3).toBeInstanceOf(HTMLButtonElement);
      expect(entryEl3).toHaveAttribute("id", "three");
      expect(entryEl3).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveTextContent("three");
      expect(entryEl3).toBeDisabled();
      expect(entryEl3).not.toHaveFocus();

      expect(entryEl4).toBeInstanceOf(HTMLButtonElement);
      expect(entryEl4).toHaveAttribute("id", "four");
      expect(entryEl4).toHaveAttribute("tabindex", "-1");
      expect(entryEl4).toHaveTextContent("four");
      expect(entryEl4).not.toBeDisabled();
      expect(entryEl4).not.toHaveFocus();
    });

    it("responds to arrow keys when focused", () => {
      userEvent.tab();

      expect(entryEl1).toHaveAttribute("tabindex", "0");
      expect(entryEl2).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveAttribute("tabindex", "-1");
      expect(entryEl4).toHaveAttribute("tabindex", "-1");
      expect(entryEl1).toHaveFocus();

      userEvent.keyboard("{ArrowDown}");

      expect(entryEl1).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveAttribute("tabindex", "-1");
      expect(entryEl4).toHaveAttribute("tabindex", "0");
      expect(entryEl4).toHaveFocus();

      userEvent.keyboard("{ArrowUp}");

      expect(entryEl1).toHaveAttribute("tabindex", "0");
      expect(entryEl2).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveAttribute("tabindex", "-1");
      expect(entryEl4).toHaveAttribute("tabindex", "-1");
      expect(entryEl1).toHaveFocus();
    });
  });

  describe("and one enabled entry", () => {
    beforeEach(() => {
      entries = [
        { id: "one", data: "one", disabled: true },
        { id: "two", data: "two", disabled: true },
        { id: "three", data: "three", disabled: false },
      ];

      harness = render(
        <List<string>>
          <ListScrollbox>
            <nav>
              {entries.map((entry) => (
                <Entry<string> key={entry.id} {...entry}>
                  <button id={entry.id} type="button" disabled={entry.disabled}>
                    {entry.data}
                  </button>
                </Entry>
              ))}
            </nav>
          </ListScrollbox>
        </List>,
      );

      listEl = harness.container.firstElementChild as HTMLElement | null;
      entryEl1 = listEl?.querySelector("#one");
      entryEl2 = listEl?.querySelector("#two");
      entryEl3 = listEl?.querySelector("#three");
    });

    it("renders", () => {
      expect(listEl).toBeInstanceOf(HTMLElement);
      expect(listEl?.childElementCount).toBe(3);

      expect(entryEl1).toBeInstanceOf(HTMLButtonElement);
      expect(entryEl1).toHaveAttribute("id", "one");
      expect(entryEl1).toHaveAttribute("tabindex", "-1");
      expect(entryEl1).toHaveTextContent("one");
      expect(entryEl1).toBeDisabled();
      expect(entryEl1).not.toHaveFocus();

      expect(entryEl2).toBeInstanceOf(HTMLButtonElement);
      expect(entryEl2).toHaveAttribute("id", "two");
      expect(entryEl2).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveTextContent("two");
      expect(entryEl2).toBeDisabled();
      expect(entryEl2).not.toHaveFocus();

      expect(entryEl3).toBeInstanceOf(HTMLButtonElement);
      expect(entryEl3).toHaveAttribute("id", "three");
      expect(entryEl3).toHaveAttribute("tabindex", "0");
      expect(entryEl3).toHaveTextContent("three");
      expect(entryEl3).not.toBeDisabled();
      expect(entryEl3).not.toHaveFocus();
    });

    it("responds to arrow keys when focused", () => {
      userEvent.tab();

      expect(entryEl1).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveAttribute("tabindex", "0");
      expect(entryEl3).toHaveFocus();

      userEvent.keyboard("{ArrowDown}");

      expect(entryEl1).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveAttribute("tabindex", "0");
      expect(entryEl3).toHaveFocus();
    });
  });

  describe("focus still wraps", () => {
    beforeEach(() => {
      entries = [
        { id: "one", data: "one", disabled: true },
        { id: "two", data: "two" },
        { id: "three", data: "three" },
        { id: "four", data: "four", disabled: true },
      ];

      harness = render(
        <List<string>>
          <ListScrollbox>
            <nav>
              {entries.map((entry) => (
                <Entry<string> key={entry.id} {...entry}>
                  <button id={entry.id} type="button" disabled={entry.disabled}>
                    {entry.data}
                  </button>
                </Entry>
              ))}
            </nav>
          </ListScrollbox>
        </List>,
      );

      listEl = harness.container.firstElementChild as HTMLElement | null;
      entryEl1 = listEl?.querySelector("#one");
      entryEl2 = listEl?.querySelector("#two");
      entryEl3 = listEl?.querySelector("#three");
      entryEl4 = listEl?.querySelector("#four");
    });

    it("without onArrowDownOverflow", () => {
      userEvent.tab();

      expect(entryEl1).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveAttribute("tabindex", "0");
      expect(entryEl3).toHaveAttribute("tabindex", "-1");
      expect(entryEl4).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveFocus();

      userEvent.keyboard("{ArrowDown}");

      expect(entryEl1).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveAttribute("tabindex", "0");
      expect(entryEl4).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveFocus();
    });

    it("without onArrowUpOverflow", () => {
      userEvent.tab();

      expect(entryEl1).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveAttribute("tabindex", "0");
      expect(entryEl3).toHaveAttribute("tabindex", "-1");
      expect(entryEl4).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveFocus();

      userEvent.keyboard("{ArrowUp}");

      expect(entryEl1).toHaveAttribute("tabindex", "-1");
      expect(entryEl2).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveAttribute("tabindex", "0");
      expect(entryEl4).toHaveAttribute("tabindex", "-1");
      expect(entryEl3).toHaveFocus();
    });
  });
});

describe("dynamic entries", () => {
  const TestComponent = (props: {
    entries: Array<{ id: string; data: string }>;
  }) => (
    <List<string>>
      <ListScrollbox>
        <nav>
          {props.entries.map((entry) => (
            <Entry<string> key={entry.id} id={entry.id} data={entry.data}>
              <a id={entry.id}>{entry.data}</a>
            </Entry>
          ))}
        </nav>
      </ListScrollbox>
    </List>
  );

  it("focus switches when entry is removed", () => {
    harness = render(
      <TestComponent
        entries={[
          { id: "one", data: "one" },
          { id: "two", data: "two" },
          { id: "three", data: "three" },
          { id: "four", data: "four" },
        ]}
      />,
    );

    const thirdEl = document.querySelector<HTMLAnchorElement>("#three");
    const fourthEl = document.querySelector<HTMLAnchorElement>("#four");

    expect(thirdEl).toBeInstanceOf(HTMLAnchorElement);
    expect(fourthEl).toBeInstanceOf(HTMLAnchorElement);

    document.querySelector<HTMLAnchorElement>("#two")?.focus();

    harness.rerender(
      <TestComponent
        entries={[
          { id: "one", data: "one" },
          { id: "three", data: "three" },
          { id: "four", data: "four" },
        ]}
      />,
    );

    expect(document.activeElement).toBe(thirdEl);

    document.querySelector<HTMLAnchorElement>("#four")?.focus();

    expect(document.activeElement).toBe(fourthEl);

    harness.rerender(
      <TestComponent
        entries={[
          { id: "one", data: "one" },
          { id: "three", data: "three" },
        ]}
      />,
    );

    expect(document.activeElement).toBe(thirdEl);
  });
});
