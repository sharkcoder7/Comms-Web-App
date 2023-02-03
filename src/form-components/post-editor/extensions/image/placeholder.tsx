/*
 * Note: 2022-7-18
 *
 * This file isn't currently used. I ended up not needing it
 * after writing it. But this has a working implementation of
 * using a react component to render a prosemirror decorator
 * so I'm keeping this file around in case it might be useful
 * in the future.
 */

import { Plugin, EditorState, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Editor, ReactRenderer } from "@tiptap/react";

interface IAddAction {
  type: "add";
  id: string;
  pos: number;
  editor: Editor;
  base64Image: string;
}

interface IRemoveAction {
  type: "remove";
  id: string;
}

type IAction = IAddAction | IRemoveAction;

export const PlaceholderPlugin = new Plugin({
  state: {
    init() {
      return DecorationSet.empty;
    },
    apply(tr, set: DecorationSet) {
      // Adjust decoration positions to changes made by the transaction
      set = set.map(tr.mapping, tr.doc);

      // See if the transaction adds or removes any placeholders
      const action = getMeta(tr);

      if (!action) return set;

      if (action.type === "add") {
        const component = new ReactRenderer(MyComponent, {
          editor: action.editor,
          props: {
            imageId: action.id,
            base64Image: action.base64Image,
          },
        });

        const deco = Decoration.widget(action.pos, component.element, {
          id: action.id,
        });

        set = set.add(tr.doc, [deco]);
      } else if (action.type === "remove") {
        set = set.remove(
          set.find(undefined, undefined, (spec) => spec.id == action.id),
        );
      }

      return set;
    },
  },
  props: {
    decorations(state) {
      const that = this as Plugin;
      return that.getState(state);
    },
  },
});

function MyComponent(props: { base64Image: string }) {
  console.log("base64Image", props.base64Image);
  return <div />;
}

function getMeta(tr: Transaction) {
  return tr.getMeta(PlaceholderPlugin) as IAction | undefined;
}

function setMeta(tr: Transaction, action: IAction) {
  return tr.setMeta(PlaceholderPlugin, action);
}

export function findPlaceholder(state: EditorState, id: string) {
  const decos = PlaceholderPlugin.getState(state);
  const found = decos?.find(undefined, undefined, (spec) => spec.id == id);
  return found?.length ? found[0].from : null;
}

export function addPlaceholder(
  editor: Editor,
  imageId: string,
  base64Image: string,
) {
  const tr = editor.view.state.tr;

  if (!tr.selection.empty) tr.deleteSelection();

  setMeta(tr, {
    type: "add",
    id: imageId,
    pos: tr.selection.from,
    editor,
    base64Image,
  });

  editor.view.dispatch(tr);
}

export function removePlaceholder(editor: Editor, imageId: string) {
  const tr = editor.view.state.tr;
  setMeta(tr, { type: "remove", id: imageId });
  editor.view.dispatch(tr);
}

// function replacePlaceholder(view: EditorView, imageId: string) {
//   const pos = findPlaceholder(view.state, imageId);

//   // If the content around the placeholder has been deleted,
//   // do nothing.
//   if (pos == null) return false;

//   // Otherwise, insert it at the placeholder's position, and remove
//   // the placeholder
//   view.dispatch(
//     view.state.tr
//       .replaceWith(pos, pos, schema.nodes.image.create({ src: url }))
//       .setMeta(placeholderPlugin, { remove: { id } }),
//   );

//   return true;
// }

// function startImageUpload(view: EditorView, image: File, imageId: string) {
//   addPlaceholder(view, imageId);

//   uploadFile(file).then(
//     (url) => {
//       let pos = findPlaceholder(view.state, id);
//       // If the content around the placeholder has been deleted, drop
//       // the image
//       if (pos == null) return;
//       // Otherwise, insert it at the placeholder's position, and remove
//       // the placeholder
//       view.dispatch(
//         view.state.tr
//           .replaceWith(pos, pos, schema.nodes.image.create({ src: url }))
//           .setMeta(placeholderPlugin, { remove: { id } }),
//       );
//     },
//     () => {
//       // On failure, just clean up the placeholder
//       view.dispatch(tr.setMeta(placeholderPlugin, { remove: { id } }));
//     },
//   );
// }
