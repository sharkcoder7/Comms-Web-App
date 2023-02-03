import { MouseEvent, RefObject } from "react";
import { IPostEditorRef } from "./PostEditorBase";

export function onElementMouseDownFocusTiptap(
  event: MouseEvent,
  editorRef: RefObject<IPostEditorRef>,
) {
  // Focus occurs onmousedown rather than onclick.
  const tiptap = editorRef.current?.editor;

  if (!tiptap) return;
  else if (
    event.target instanceof Node &&
    tiptap.view.dom.contains(event.target)
  ) {
    // If we've clicked within the editor, we shouldn't do anything.
    return;
  } else if (document.activeElement === tiptap.view.dom) {
    console.debug(
      "preventDefault() onclick since editor is already focused",
      "this just prevents a focus event from firing again.",
    );

    event.preventDefault();
    return;
  }

  // Annoyingly, simply focusing a new element onmousedown
  // doesn't seem to work. Effectively, it appears as though
  // focus happens both onmousedown and onmouseup (though I
  // imagine that, in reality, something else is happening).
  // Regardless, we need to use this setTimeout to ensure that
  // tiptap gets focus.
  setTimeout(() => tiptap.chain().focus(), 0);
}
