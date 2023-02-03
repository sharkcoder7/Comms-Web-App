// Implementation taken from
// https://github.com/ueberdosis/tiptap/blob/b2bd909eaa687687b50fc8fa22330f042eaab4d1/packages/extension-list-item/src/list-item.ts

import { mergeAttributes, Node } from "@tiptap/core";

export interface ListItemOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HTMLAttributes: Record<string, any>;
}

export const ListItem = Node.create<ListItemOptions>({
  name: "listItem",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  content: "paragraph block*",

  defining: true,

  parseHTML() {
    return [
      {
        tag: "li",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      "Mod-]": () => this.editor.commands.sinkListItem(this.name),
      "Mod-[": () => this.editor.commands.liftListItem(this.name),
    };
  },
});
