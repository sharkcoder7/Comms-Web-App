import { css, cx } from "@emotion/css";
import { IPostDoc, IThreadDoc, IUnsafeDraftDoc } from "@libs/firestore-models";
import { isEqual } from "@libs/utils/isEqual";
import {
  forwardRef,
  memo,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  IListEntry,
  IListRef,
  useListScrollboxContext,
} from "~/components/list";
import {
  IEditorMention,
  IRichTextEditorRef,
  onElementMouseDownFocusTiptap,
  PostEditor,
} from "~/form-components/post-editor";
import {
  deleteDraft,
  buildPostDocFromDraftReplyFormValues,
  updateDraftReply,
  useSyncDraftBetweenTabs,
  getDraftDataStorageKey,
  IThreadDocFromUnsafeDraft,
} from "~/services/draft.service";
import { onlyCallFnOnceWhilePreviousCallIsPending } from "~/utils/onlyCallOnceWhilePending";
import { htmlToText } from "@libs/utils/htmlToText";
import { useHotkeyContext } from "~/services/hotkey.service";
import { elementPositionInContainer } from "~/utils/view-helpers";
import { debounce } from "lodash-es";
import { PendingUpdates } from "~/services/loading.service";
import { sessionStorageService } from "~/services/session-storage.service";
import { useIsWindowFocused } from "~/services/focus.service";
import {
  createFormControl,
  createFormGroup,
  IFormControl,
  IFormGroup,
  useControl,
  useControlState,
} from "solid-forms-react";
import { handleSubmit, observable } from "~/form-components/utils";
import { useComposedRefs } from "~/utils/useComposedRefs";
import { useImageDropHandlers } from "~/form-components/post-editor/extensions/image";
import { DragTargetOverlay } from "~/components/DragTargetOverlay";

export interface IComposePostReplyProps {
  thread: IThreadDoc | IThreadDocFromUnsafeDraft;
  draft: IUnsafeDraftDoc;
  listRef: RefObject<IListRef<IPostDoc>>;
  onClose: (post?: IPostDoc) => void;
  focusOnInit?: boolean;
}

export interface IPostReplyFormValue {
  postId: IPostDoc["id"];
  threadId: IPostDoc["threadId"];
  body: {
    content: IPostDoc["bodyHTML"];
    mentions: IEditorMention[];
  };
}

function getMentionsFromDraft(
  draft?: IUnsafeDraftDoc | null,
): IEditorMention[] {
  return Object.entries(draft?.mentionedUsers || {}).map(([k, v]) => [
    k,
    v.type,
  ]);
}

// the bottom margin is equal to 50vh - the header height.
const composeWrapperCSS = css`
  margin-bottom: calc(50vh - 4.75rem);
`;

export const ComposePostReply = memo(
  forwardRef<IRichTextEditorRef, IComposePostReplyProps>((props, ref) => {
    const formRef = useRef<HTMLFormElement>(null);
    const editorRef = useRef<IRichTextEditorRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { scrollboxRef } = useListScrollboxContext();
    const isWindowFocused = useIsWindowFocused();

    const composedEditorRefs = useComposedRefs(ref, editorRef);

    const control = useControl(() =>
      createFormGroup({
        postId: createFormControl(props.draft.id),
        threadId: createFormControl(props.draft.threadId),
        body: createFormGroup({
          content: createFormControl(props.draft.bodyHTML),
          mentions: createFormControl(getMentionsFromDraft(props.draft)),
        }),
      }),
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const submit = useCallback(
      onlyCallFnOnceWhilePreviousCallIsPending(
        async (values: IPostReplyFormValue) => {
          console.log("submitting...", values);

          // We want the new post form to close immediately without
          // waiting for this promise to resolve.
          // See `createNewDraftReply` jsdoc.
          updateDraftReply({
            postId: values.postId,
            bodyHTML: values.body.content,
            mentions: values.body.mentions,
            scheduledToBeSentAt: new Date(),
          })
            .then(() => console.log("submitted successfully!"))
            .catch(console.error);

          const post = await buildPostDocFromDraftReplyFormValues({
            thread: props.thread,
            postId: values.postId,
            bodyHTML: values.body.content,
            mentions: values.body.mentions,
          });

          if (post) {
            const key = getDraftDataStorageKey(post.id);

            sessionStorageService.setItem(key, {
              sent: true,
              post,
            });

            sessionStorageService.deleteItem(key);
          }

          props.onClose(post ?? undefined);

          setTimeout(
            () => focusLastEntry(props.listRef.current?.entries.at(-1)),
            0,
          );
        },
      ),
      [props.thread],
    );

    const cancelSaveDraft = useSaveDraft(control, isWindowFocused);

    useSyncDraftBetweenTabs(control, editorRef, props.onClose);

    useEffect(() => {
      if (!props.focusOnInit) return;

      setTimeout(() => {
        const tiptap = editorRef.current?.editor;
        tiptap?.chain().focus("start", { scrollIntoView: true });
      }, 0);
      // We only run this effect on mount
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useHotkeyContext({
      commands: () => {
        return [
          {
            label: "Delete draft",
            triggers: ["$mod+Shift+,"],
            triggerWhenInputFocused: true,
            callback: () => {
              cancelSaveDraft();
              deleteDraft(control.rawValue);
              sessionStorageService.setItem(
                getDraftDataStorageKey(control.rawValue.postId),
                {
                  deleted: true,
                },
              );
              props.onClose();
            },
          },
          {
            label: "Send reply",
            triggers: ["$mod+Enter"],
            triggerWhenInputFocused: true,
            callback: async (e) => {
              e.preventDefault();
              e.stopPropagation();

              if (control.status === "VALID") {
                cancelSaveDraft();
              }

              handleSubmit(control, submit);
            },
          },
          {
            label: "Cancel reply",
            triggers: ["Escape"],
            triggerWhenInputFocused: true,
            callback: () => {
              // While we could simply use a `div` and `innerText` here,
              // the draft service already depends on `htmlToText()` and
              // reusing it provides more consistent HTML to text conversion
              const textContent = htmlToText(control.rawValue.body.content);

              focusLastEntry(props.listRef.current?.entries.at(-1));

              if (textContent.trim().length !== 0) {
                return;
              }

              cancelSaveDraft();
              deleteDraft(control.rawValue);
              sessionStorageService.setItem(
                getDraftDataStorageKey(control.rawValue.postId),
                {
                  deleted: true,
                },
              );
              props.onClose();
            },
          },
        ];
      },
      deps: [formRef.current, control, props.onClose, cancelSaveDraft],
    });

    /**
     * Focus the last non-draft entry (i.e. the entry above the
     * compose draft editor).
     */
    const onEditorStartOverflow = useCallback(() => {
      const lastEntry = props.listRef.current?.entries.at(-1);
      if (!lastEntry) return;
      focusLastEntry(lastEntry);
    }, [props.listRef]);

    /** Scroll the list container down if possible */
    const onEditorEndOverflow = useCallback(() => {
      if (!scrollboxRef.current) return;

      if (
        scrollboxRef.current.scrollTop === scrollboxRef.current.scrollHeight
      ) {
        return;
      }

      scrollboxRef.current.scrollTop += 100;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { showDragTarget, onDragEnter, onDragLeave, onDragOver, onDrop } =
      useImageDropHandlers(editorRef, props.draft.id);

    const controlBorderCSS = useControlState(() => {
      if (control.errors) return "border-red-5 focus-within:border-red-9";
      if (control.isPending) return "border-blue-5 focus-within:border-blue-9";
      return "border-green-5 focus-within:border-green-9";
    }, [control]);

    return (
      <div
        ref={wrapperRef}
        className={cx(
          "bg-white mt-4 shadow-lg border-l-[.4rem]",
          "focus:outline-none transition-colors relative",
          controlBorderCSS,
          composeWrapperCSS,
        )}
        onMouseDown={(e) => onElementMouseDownFocusTiptap(e, editorRef)}
        onDragOver={onDragOver}
        // Note, onDragEnter/Leave events are fired when entering/exiting each
        // child element. Because of this, if we apply onDragEnter and
        // onDragLeave to this wrapper element, both events will be constantly
        // fired as someone moves their mouse over the elements in this div.
        // To get around this, we just attach the enter handler to this wrapper
        // element and we attach the leave handler to the drag target element
        // which, when visible, will be covering up all the other children.
        onDragEnter={onDragEnter}
        onDrop={onDrop}
      >
        {showDragTarget && (
          <DragTargetOverlay onDragLeave={onDragLeave}>
            Embed Image
          </DragTargetOverlay>
        )}

        <div className="PostHeader flex px-8 py-4 text-green-9">
          <div className="PostSender flex-1">
            <strong>Draft</strong>
          </div>
        </div>

        <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-1 overflow-y-auto px-8 py-4">
            <PostEditor
              ref={composedEditorRefs}
              onEditorStartOverflow={onEditorStartOverflow}
              onEditorEndOverflow={onEditorEndOverflow}
              initialTabIndex={0}
              control={control}
            />
          </div>
        </form>
      </div>
    );
  }),
  isEqual,
);

function focusLastEntry<T>(lastEntry?: IListEntry<T>) {
  if (!lastEntry) return;

  lastEntry.node.focus({ preventScroll: true });

  const { bottom } = elementPositionInContainer(
    lastEntry.scrollboxEl,
    lastEntry.node,
  );

  if (bottom !== "above") return;

  lastEntry.scrollboxEl.scrollTop -= 100;
}

// See also the `useSaveDraft` hook defined in the NewPostDialog
// component which is similar to this one.
function useSaveDraft(
  control: IFormGroup<{
    postId: IFormControl<string>;
    threadId: IFormControl<string>;
    body: IFormGroup<{
      content: IFormControl<string>;
      mentions: IFormControl<IEditorMention[]>;
    }>;
  }>,
  isWindowFocused: boolean,
) {
  const postId = useControlState(() => control.rawValue.postId, [control]);

  const [saveDraft, debouncedSaveDraft] = useMemo(() => {
    // We're using lodash for debounce and distinctUntilChanged
    // instead of rxjs to ensure that the function is called even
    // if the component is destroyed.
    const debouncedFn = debounce(
      (values: IPostReplyFormValue) => {
        updateDraftReply({
          postId: values.postId,
          bodyHTML: values.body.content,
          mentions: values.body.mentions,
        }).catch((e) => console.error("updateDraftReply", e));

        PendingUpdates.remove(values.postId);

        return values;
      },
      1500,
      {
        maxWait: 5000,
        trailing: true,
      },
    );

    const saveDraftFn = (args: IPostReplyFormValue) => {
      PendingUpdates.add(args.postId);
      return debouncedFn(args);
    };

    return [saveDraftFn, debouncedFn] as const;
    // Even though `postId` isn't a dependency of `useMemo()` here,
    // we do want to generate a new debounced `saveDraftFn` anytime
    // the `postId` changes so that the debounced state of different
    // drafts doesn't interfere with each other.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const cancelSaveDraft = useCallback(() => {
    debouncedSaveDraft.cancel();
    PendingUpdates.remove(postId);
  }, [debouncedSaveDraft, postId]);

  useEffect(() => {
    if (!isWindowFocused) return;

    const sub = observable(() => control.rawValue).subscribe((value) => {
      saveDraft(value);
    });

    return () => sub.unsubscribe();
  }, [saveDraft, isWindowFocused, control]);

  // When we navigate away from this draft,
  // delete the draft if it's empty
  useEffect(() => {
    return () => {
      const { content } = control.rawValue.body;

      if (!content || content === "<p></p>") {
        cancelSaveDraft();
        deleteDraft(control.rawValue);
        sessionStorageService.deleteItem(
          getDraftDataStorageKey(control.rawValue.postId),
        );
      }
    };
  }, [control, cancelSaveDraft]);

  return cancelSaveDraft;
}
