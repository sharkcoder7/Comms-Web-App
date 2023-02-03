import { ReactNodeViewRenderer } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { ImageNodeView } from "./ImageNodeView";
import { findChildren } from "prosemirror-utils";
import { deleteImage } from "~/services/file-upload.service";

export const ImageExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (el) => el.getAttribute("src") || null,
        renderHTML: (attrs) => {
          // TipTap will automatically delete any image nodes that don't have a src.
          // Strangely, it doesn't _always_ do this, but it does do it regularly.
          // Adding a blank string keeps TipTap from deleting it.
          return { src: attrs.src || "" };
        },
      },
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("width") || null,
        renderHTML: (attrs) => ({ width: attrs.width }),
      },
      height: {
        default: null,
        parseHTML: (el) => el.getAttribute("height") || null,
        renderHTML: (attrs) => ({ height: attrs.height }),
      },
      imageId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-imageid") || null,
        renderHTML: (attrs) => {
          return {
            "data-imageid": attrs.imageId || null,
          };
        },
      },
      previewSrc: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => null,
      },
      uploadProgress: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => null,
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
  onTransaction({ transaction }) {
    // Here we want to detect if the user just deleted an `img`
    // from the editor. If so, we want to delete that image from
    // Firebase Storage or cancel the pending upload of that
    // image

    if (!transaction.docChanged) return;

    const beforeImages = findChildren(transaction.before, (node) => {
      return node.type === this.type;
    });

    const afterImages = findChildren(transaction.doc, (node) => {
      return node.type === this.type;
    });

    // Important to consider the fact that someone might copy and
    // paste an image that has already been uploaded. I.e. it's
    // possible for the same image (and same imageId) to be
    // included in a post body more than once. In this case,
    // we should only delete the image from Firebase Storage
    // when all instances of it have been removed.
    const deletedImgs = beforeImages.filter(({ node }) => {
      const id = node.attrs.imageId;

      if (!id) return false;

      const presentAfter = afterImages.some(
        ({ node }) => node.attrs.imageId === id,
      );

      return !presentAfter;
    });

    if (deletedImgs.length === 0) return;

    deletedImgs.forEach(({ node }) => {
      deleteImage(node.attrs.imageId);
    });
  },
}).configure({
  allowBase64: true,
});
