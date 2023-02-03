import { Extension } from "@tiptap/react";

export const CommsShortcuts = Extension.create({
  name: "CommsShortcuts",

  addKeyboardShortcuts() {
    return {
      // we're just making this a no-op since we want this
      // hotkey to be picked up by our hotkey context and
      // we don't want the editor to do anything.
      "Mod-Enter": () => true,
    };
  },
});
