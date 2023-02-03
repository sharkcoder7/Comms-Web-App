import { Editor, EditorContent, useEditor, EditorOptions } from "@tiptap/react";
import { Editor as CoreEditor } from "@tiptap/core";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Typography from "@tiptap/extension-typography";
import { css, cx } from "@emotion/css";
import { red, slateDark } from "@radix-ui/colors";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { lowlight } from "lowlight";
import Link from "@tiptap/extension-link";
import { ListItem } from "./extensions/ListItem";
import { PLATFORM_MODIFIER_KEY } from "~/services/hotkey.service";
import useConstant from "use-constant";
import { usePropAsRef } from "~/utils/usePropAsRef";
import {} from "prosemirror-utils";
import { ImageExtension } from "./extensions/image";
import { buildEditorOverflowHandler } from "./extensions/EditorOverflowHandler";
import { CommsShortcuts } from "./extensions/CommsShortcuts";
import {
  InterruptUser,
  MentionUser,
  RequestResponseUser,
  useMentionExtensionSubscriptions,
} from "./extensions/mention-user";
import { CustomizedStarterKit } from "./extensions/CustomizedStarterKit";

export interface IPostEditorRef {
  editor: Editor | null;
}

export const PostEditorBase = forwardRef<
  IPostEditorRef,
  {
    className?: string;
    onChange?: (props: { editor: CoreEditor }) => void;
    onBlur?: () => void;
    onEditorStartOverflow?: () => void;
    onEditorEndOverflow?: () => void;
    getInitialValue?: () => string;
    initialTabIndex?: number;
  }
>((props, ref) => {
  useMentionExtensionSubscriptions();

  const onChangeRef = usePropAsRef(props.onChange);
  const onEditorStartOverflowRef = usePropAsRef(props.onEditorStartOverflow);
  const onEditorEndOverflowRef = usePropAsRef(props.onEditorEndOverflow);
  const editorRef = useRef<Editor | null>(null);

  const config = useConstant<Partial<EditorOptions>>(() => {
    return {
      extensions: [
        CustomizedStarterKit,
        MentionUser,
        RequestResponseUser,
        InterruptUser,
        Typography,
        ImageExtension,
        CommsShortcuts,
        CodeBlockLowlight.configure({
          lowlight,
        }),
        ListItem,
        Link.configure({
          HTMLAttributes: {
            target: null,
          },
          openOnClick: false,
        }),
        buildEditorOverflowHandler(
          onEditorStartOverflowRef,
          onEditorEndOverflowRef,
        ),
      ],
      content: props.getInitialValue?.() || "",
      onUpdate({ editor }) {
        onChangeRef.current?.({ editor });
      },
      editorProps: {
        attributes:
          (Number.isInteger(props.initialTabIndex) && {
            tabindex: String(props.initialTabIndex),
          }) ||
          undefined,
      },
    };
  });

  // We're using a ref for editorRef so that we have a stable reference
  // to the editor which we can use inside the config.
  editorRef.current = useEditor(config);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({ editor: editorRef.current }), [
    editorRef.current,
  ]);

  // After initialization, emit one change to sync the editors values
  // with the control.
  useEffect(() => {
    if (!editorRef.current) return;
    onChangeRef.current?.({ editor: editorRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorRef.current]);

  if (!editorRef.current) {
    return null;
  }

  return (
    <EditorContent
      onBlur={props.onBlur}
      className={cx("RichTextEditor", editorStyles, props.className)}
      editor={editorRef.current}
      onKeyDown={(e) => {
        if (
          (PLATFORM_MODIFIER_KEY.name === "Command" ? e.metaKey : e.ctrlKey) &&
          (e.key === "[" || e.key === "]")
        ) {
          e.preventDefault();
        }
      }}
    />
  );
});

const editorStyles = css`
  width: 100%;

  .ProseMirror-focused {
    outline: none;
  }

  .ProseMirror p.is-editor-empty:first-child::before {
    color: ${slateDark.slate11};
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  &.is-invalid .ProseMirror p:first-child::before {
    color: ${red.red9};
  }
`;
