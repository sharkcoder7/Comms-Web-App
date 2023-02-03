/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { render, RenderResult } from "@testing-library/react";
import { ImageNodeView } from "./ImageNodeView";
import { IImageExtentionAttrs } from "./context";
import { Node } from "prosemirror-model";
import { IPostEditorContext, PostEditorContext } from "../../context";
import { createFormControl, createFormGroup } from "solid-forms-react";

let harness: RenderResult;

afterEach(() => {
  harness.unmount();
});

describe("focusEntryOnMouseOver prop", () => {
  let nodeViewWrapperEl: Element | null;
  let control: IPostEditorContext["control"];
  const updateAttributes = vi.fn();
  const deleteNode = vi.fn();

  function initializeTestHarness() {
    const mockNode: { attrs: IImageExtentionAttrs } = {
      attrs: {
        src: "",
        alt: "",
        title: "",
        imageId: "",
        height: 0,
        width: 0,
      },
    };

    control = createFormGroup({
      postId: createFormControl(""),
      body: createFormGroup({
        content: createFormControl(""),
        mentions: createFormControl([]),
      }),
    });

    harness = render(
      <PostEditorContext.Provider value={{ control }}>
        <ImageNodeView
          node={mockNode as unknown as Node}
          updateAttributes={updateAttributes}
          deleteNode={deleteNode}
        />
      </PostEditorContext.Provider>,
    );

    nodeViewWrapperEl = harness.container.firstElementChild;
  }

  it("initializes", () => {
    initializeTestHarness();

    expect(nodeViewWrapperEl).toBeInstanceOf(HTMLDivElement);
  });
});
