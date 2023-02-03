import { Command, Selection } from "prosemirror-state";
import { keymap } from "prosemirror-keymap";
import { Extension } from "@tiptap/react";
import { MutableRefObject } from "react";
import { isMentionListOpened } from "./mention-user/MentionList";

export function buildEditorOverflowHandler(
  overflowStartFnRef: MutableRefObject<(() => void) | undefined>,
  overflowEndFnRef: MutableRefObject<(() => void) | undefined>,
) {
  return Extension.create({
    name: "EditorOverflowHandler",
    addProseMirrorPlugins() {
      return [
        keymap({
          ArrowLeft: arrowHandler("left", overflowStartFnRef),
          ArrowRight: arrowHandler("right", overflowEndFnRef),
          ArrowUp: arrowHandler("up", overflowStartFnRef),
          ArrowDown: arrowHandler("down", overflowEndFnRef),
        }),
      ];
    },
  });
}

// This handler was adapted from the "codemirror" ProseMirror example
// for an `arrowHandler()` along with a heavy does of trial and error.
// See https://prosemirror.net/examples/codemirror/
function arrowHandler(
  dir: "left" | "up" | "right" | "down",
  overflowFnRef: MutableRefObject<(() => void) | undefined>,
): Command {
  return (state, dispatch, view) => {
    if (!overflowFnRef.current) return false;
    if (!state.selection.empty || !view?.endOfTextblock(dir)) return false;

    // Note that this implementation only requires `isMentionListOpened()`
    // for two scenerios:
    //
    // 1. The user is adding a mention at the very start
    //    of a document and presses "ArrowUp".
    // 2. The user is adding a mention at the very end of a document
    //    and presses "ArrowDown".
    //
    // In all other situations this implementation appears to work
    // naturally because the open mentions dropdown will prevent the
    // current position from changing on ArrowUp or ArrowDown and the
    // current position will not equal to theoretical "nextPos".
    if (isMentionListOpened()) return false;

    const side = dir == "left" || dir == "up" ? -1 : 1;
    const head = state.selection.$head;

    // let nextHead: ResolvedPos;

    try {
      const nextHead = Selection.near(
        state.doc.resolve(side > 0 ? head.after() : head.before()),
        side,
      ).$head;

      const currPos = state.selection.$head.pos;
      const nextPos = nextHead.pos;

      if (currPos !== nextPos) return false;
    } catch (e) {
      // If `head` is the root node, then a RangeError like
      // "nothing comes after the root node" will be thrown.
      if (!(e instanceof RangeError)) {
        throw e;
      }
    }

    // If dispatch is undefined it means we're just testing to see if
    // this command can run and, if so, what the result would be.
    if (dispatch) overflowFnRef.current();

    return true;
  };
}
