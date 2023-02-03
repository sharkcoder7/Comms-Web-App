import {
  ComponentType,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useHotkeyContext } from "~/services/hotkey.service";
import { IRecipientOption, Recipients } from "./Recipients";
import { DialogState, withModalDialog } from "~/dialogs/withModalDialog";
import { onlyCallFnOnceWhilePreviousCallIsPending } from "~/utils/onlyCallOnceWhilePending";
import { TextInput } from "~/form-components/TextInput";
import { useKBarContext } from "~/services/kbar.service";
import uid from "@libs/utils/uid";
import {
  deleteDraft,
  getDraftDataStorageKey,
  createNewDraft,
  updateNewDraft,
  useSyncDraftBetweenTabs,
} from "~/services/draft.service";
import { IUnsafeDraftDoc } from "@libs/firestore-models";
import {
  IEditorMention,
  IPostEditorControl,
  IRichTextEditorRef,
  onElementMouseDownFocusTiptap,
  PostEditor,
} from "~/form-components/post-editor";
import { debounce } from "lodash-es";
import { PendingUpdates } from "~/services/loading.service";
import {
  createFormControl,
  createFormGroup,
  IFormControl,
  IFormGroup,
  useControl,
  useControlState,
} from "solid-forms-react";
import { handleSubmit, observable } from "~/form-components/utils";
import { docRef, waitForCacheToContainDoc } from "~/firestore.service";
import { getAndAssertCurrentUser } from "~/services/user.service";
import { sessionStorageService } from "~/services/session-storage.service";
import { DragTargetOverlay } from "~/components/DragTargetOverlay";
import { useImageDropHandlers } from "~/form-components/post-editor/extensions/image";
import { css, cx } from "@emotion/css";
import { wait } from "@libs/utils/wait";
import { useIsWindowFocused } from "~/services/focus.service";
import { oneLine } from "common-tags";
import {
  ActionAndMainPanelWrapper,
  ContextPanel,
  MainPanel,
  MainPanelContent,
  MainPanelHeader,
} from "~/page-layouts/thread-layout";

export interface INewPostFormValue {
  postId: string;
  recipients: IRecipientOption[];
  subject: IUnsafeDraftDoc["subject"];
  body: {
    content: IUnsafeDraftDoc["bodyHTML"];
    mentions: IEditorMention[];
  };
}

export const NewPostDialogState = new DialogState<INewPostFormValue>();

const newPostDraft = onlyCallFnOnceWhilePreviousCallIsPending(async () => {
  const postId = uid();

  const currentUser = getAndAssertCurrentUser();

  // We race the result in case createNewDraft throws an error.
  // We don't wait for `createNewDraft` to resolve because
  // 1. It will never resolve in offline mode
  // 2. The cache will optimistically update before createNewDraft
  //    resolves so we don't need to wait for it to fully resolve
  await Promise.race([
    createNewDraft({
      postId,
      recipients: [],
      subject: "",
      bodyHTML: "",
      mentions: [],
    }),
    waitForCacheToContainDoc(
      docRef("users", currentUser.id, "unsafeDrafts", postId),
    ),
  ]);

  // We wait for a few ms to ensure that the new draft has time
  // to render in the inbox before opening the compose dialog.
  // If the new draft is the only inbox item, this is necessary
  // to ensure that we properly focus the draft after the
  // dialog closes.
  await wait(10);

  NewPostDialogState.toggle(true, {
    postId,
    recipients: [],
    body: {
      content: "",
      mentions: [],
    },
    subject: "",
  });
});

const containerCSS = oneLine`
  fixed left-0 top-0 h-screen w-screen flex
  flex-col focus:outline-none z-[100]
`;

export const NewPostDialog = withModalDialog({
  dialogState: NewPostDialogState,
  containerCSS,
  useOnDialogContainerRendered: () => {
    useHotkeyContext({
      id: "NewPostDialogContainer",
      commands: () => {
        return [
          {
            label: "New post",
            triggers: ["c"],
            callback: newPostDraft,
          },
        ];
      },
    });

    useKBarContext({
      id: "NewPostDialogContainer",
      commands: () => {
        return [
          {
            id: "new-post",
            label: "New post",
            callback: newPostDraft,
          },
        ];
      },
    });
  },
  Component: (props) => {
    if (!props.data) {
      throw new Error(`NewPostDialog expects props.data`);
    }

    const editorRef = useRef<IRichTextEditorRef>(null);

    const control = useControl(() => {
      return createFormGroup({
        postId: createFormControl(props.data.postId),
        recipients: createFormControl<IRecipientOption[]>(
          props.data.recipients,
          {
            validators: (v) => (v.length > 0 ? null : { required: true }),
            required: true,
          },
        ),
        subject: createFormControl(props.data.subject, {
          required: true,
        }),
        body: createFormGroup({
          content: createFormControl(props.data.body.content, {
            required: true,
          }),
          mentions: createFormControl(props.data.body.mentions),
        }) as IPostEditorControl["controls"]["body"],
      });
    });

    const cancelSaveDraft = useSaveDraft(control);

    const onClose = useCallback(() => {
      cancelSaveDraft();
      NewPostDialogState.toggle(false);
    }, [cancelSaveDraft]);

    useSyncDraftBetweenTabs(control, editorRef, onClose);

    useHotkeyContext({
      id: "New Post Dialog",
      updateStrategy: "replace",
      commands: () => {
        return [
          {
            label: "Delete draft",
            triggers: ["$mod+Shift+,"],
            triggerWhenInputFocused: true,
            callback: () => {
              cancelSaveDraft();
              deleteDraft(control.rawValue);
              NewPostDialogState.toggle(false);
            },
          },
          {
            label: "Close dialog",
            triggers: ["Escape"],
            triggerWhenInputFocused: true,
            callback: () => {
              NewPostDialogState.toggle(false);
            },
          },
          {
            label: "Send message",
            triggers: ["$mod+Enter"],
            triggerWhenInputFocused: true,
            callback: onlyCallFnOnceWhilePreviousCallIsPending(async (e) => {
              e.preventDefault();
              e.stopPropagation();

              if (control.status === "VALID") {
                cancelSaveDraft();
              }

              await handleSubmit(control, submit);
            }),
          },
        ];
      },
      deps: [props.handleSubmit, cancelSaveDraft, deleteDraft],
    });

    const { showDragTarget, onDragEnter, onDragLeave, onDragOver, onDrop } =
      useImageDropHandlers(editorRef, props.data.postId);

    return (
      <div className="flex-1 overflow-y-auto flex h-full bg-slate-3">
        <ActionAndMainPanelWrapper>
          <MainPanel>
            <MainPanelHeader>
              <h1 className="text-2xl truncate" style={{ lineHeight: 1.1 }}>
                New Message
              </h1>
            </MainPanelHeader>

            <MainPanelContent className="overflow-hidden">
              <form
                onSubmit={(e) => e.preventDefault()}
                onDragOver={onDragOver}
                onDragEnter={onDragEnter}
                onDrop={onDrop}
                className={formCSS}
              >
                {showDragTarget && (
                  <DragTargetOverlay onDragLeave={onDragLeave}>
                    Embed Image
                  </DragTargetOverlay>
                )}

                <Recipients control={control.controls.recipients} />
                <Subject control={control.controls.subject} />
                <Content control={control} editorRef={editorRef} />
              </form>

              <div className="h-8" />
            </MainPanelContent>
          </MainPanel>
        </ActionAndMainPanelWrapper>

        <ContextPanel />
      </div>
    );
  },
});

const formCSS = cx(
  "flex flex-col flex-1 bg-white relative shadow-lg",
  css`
    max-height: calc(100% - 2rem);
  `,
);

const submit = onlyCallFnOnceWhilePreviousCallIsPending(
  async (values: INewPostFormValue) => {
    console.log("submitting...", values);

    // We want the new post form to close immediately without
    // waiting for this promise to resolve.
    // See `createNewDraft` jsdoc.
    updateNewDraft({
      postId: values.postId,
      subject: values.subject,
      bodyHTML: values.body.content,
      recipients: values.recipients.map((recipient) => ({
        id: recipient.value,
        type: recipient.type,
      })),
      mentions: values.body.mentions,
      scheduledToBeSentAt: new Date(),
    })
      .then(() => console.log("submitted successfully!"))
      .catch(console.error);

    const key = getDraftDataStorageKey(values.postId);

    sessionStorageService.setItem(key, {
      sent: true,
    });

    sessionStorageService.deleteItem(key);

    NewPostDialogState.toggle(false);
  },
);

const Subject: ComponentType<{
  control: IFormControl<string>;
}> = (props) => {
  return (
    <div className="flex px-4">
      <div className="flex flex-1 py-3 border-b border-mauve-5">
        <TextInput name="subject" control={props.control} />
      </div>
    </div>
  );
};

// Naming this component "Content" rather than "Body" because
// the placeholder is generated based on the field name and I
// think "Content..." makes a better placeholder than "Body..."
// and I want to name the component after the field name.
const Content: ComponentType<{
  control: IPostEditorControl;
  editorRef: RefObject<IRichTextEditorRef>;
}> = (props) => {
  return (
    <div
      className="flex flex-1 overflow-y-auto p-4 min-h-[12rem]"
      onClick={(e) => onElementMouseDownFocusTiptap(e, props.editorRef)}
    >
      <PostEditor ref={props.editorRef} control={props.control} />
    </div>
  );
};

// See also the `useSaveDraft` hook defined in the ComposePostReply
// component which is similar to this one.
function useSaveDraft(
  control: IFormGroup<{
    postId: IFormControl<string>;
    recipients: IFormControl<IRecipientOption[]>;
    subject: IFormControl<string>;
    body: IFormGroup<{
      content: IFormControl<string>;
      mentions: IFormControl<IEditorMention[]>;
    }>;
  }>,
) {
  const postId = useControlState(() => control.rawValue.postId, [control]);

  const [saveDraft, debouncedSaveDraft] = useMemo(() => {
    // We're using lodash for debounce and distinctUntilChanged
    // instead of rxjs to ensure that the function is called even
    // if the component is destroyed.
    const debouncedFn = debounce(
      (values: INewPostFormValue) => {
        updateNewDraft({
          postId: values.postId,
          recipients:
            values.recipients.map((r) => ({ id: r.value, type: r.type })) || [],
          subject: values.subject || "",
          bodyHTML: values.body.content || "",
          mentions: values.body.mentions || [],
        })
          .then(() => console.debug("WIP draft saved successfully"))
          .catch((e) => console.error("updateNewDraft", e));

        PendingUpdates.remove(values.postId);

        return values;
      },
      1500,
      {
        maxWait: 5000,
        trailing: true,
      },
    );

    const saveDraftFn = (args: INewPostFormValue) => {
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

  const isWindowFocused = useIsWindowFocused();

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

      const emptyDraft =
        (!content.trim() || content === "<p></p>") &&
        control.rawValue.recipients.length === 0 &&
        control.rawValue.subject.trim().length === 0;

      if (emptyDraft) {
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
