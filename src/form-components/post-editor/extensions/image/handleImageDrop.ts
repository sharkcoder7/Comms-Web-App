import { Editor } from "@tiptap/react";
import { serverTimestamp, updateDoc } from "firebase/firestore";
import { DragEvent, RefObject, useCallback, useState } from "react";
import { docRef } from "~/firestore.service";
import { uploadImage } from "~/services/file-upload.service";
import { getAndAssertCurrentUser } from "~/services/user.service";
import { IImageExtentionAttrs } from "./context";
import { ImageExtension } from "./extension";

export async function handleImageDrop(
  event: DragEvent<HTMLElement>,
  editor: Editor,
  postId: string,
) {
  const imageFiles = Array.from(event.dataTransfer.files).filter((file) =>
    ["image/jpeg", "image/gif", "image/png", "image/webp"].includes(file.type),
  );

  if (imageFiles.length === 0) return;

  event.preventDefault();

  // const position =
  //   editor.view.posAtCoords({
  //     top: event.pageY,
  //     left: event.pageX,
  //   })?.pos ?? editor.view.state.selection.head;

  const position = editor.view.state.selection.head;

  // Currently, a bug in tiptap causes setNodeSelection at the drop cursor
  // to error in many cases. For this reason, we currently aren't updating
  // the cursor position on drop.
  // See https://github.com/ueberdosis/tiptap/issues/2981
  //
  // editor.commands.setNodeSelection(position);

  const imageData = await Promise.allSettled(
    imageFiles.map(async (file) => {
      const image = await uploadImage(file, postId);

      if (!image) return;

      const imageProps: Partial<IImageExtentionAttrs> = {
        alt: file.name,
        title: file.name,
        ...image,
      };

      editor.commands.insertContentAt(position, {
        type: ImageExtension.name,
        attrs: imageProps,
      });

      return image;
    }),
  );

  if (!imageData.some((r) => r.status === "fulfilled" && !!r.value)) {
    return;
  }

  // After we handle the image drop, we need to immediately
  // update our draft doc so that the upload image handler can
  // grab a draft with the bodyHTML containing our img elements.
  // Because the form itself debounces input, the form won't
  // update the draft fast enough.
  const currentUser = getAndAssertCurrentUser();

  updateDoc(docRef("users", currentUser.id, "unsafeDrafts", postId), {
    bodyHTML: editor.getHTML(),
    updatedAt: serverTimestamp(),
  });
}

export function useImageDropHandlers(
  editorRef: RefObject<{ editor: Editor | null }>,
  draftId: string,
) {
  const [showDragTarget, setShowDragTarget] = useState(false);

  // Some elements are drop targets by default, but for elements
  // which aren't (like form), we can make it a drop target
  // by calling preventDefault() on the ondragover event.
  // See https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
  const onDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  }, []);

  const onDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    setShowDragTarget(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setShowDragTarget(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      setShowDragTarget(false);

      if (!editorRef.current?.editor) return;

      handleImageDrop(e, editorRef.current.editor, draftId);
    },
    [editorRef, draftId],
  );

  return {
    showDragTarget,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
  };
}
