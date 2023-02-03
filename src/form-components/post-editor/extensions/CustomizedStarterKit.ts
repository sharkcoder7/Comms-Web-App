import StarterKit from "@tiptap/starter-kit";

export const CustomizedStarterKit = StarterKit.configure({
  heading: {
    levels: [1, 2, 3],
  },
  codeBlock: false,
  listItem: false,
  dropcursor: {
    class: "tiptap-drop-cursor",
    color: "black",
    width: 3,
  },
});
