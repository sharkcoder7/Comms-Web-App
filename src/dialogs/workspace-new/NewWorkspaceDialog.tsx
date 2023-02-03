import { ComponentType } from "react";
import { useHotkeyContext } from "~/services/hotkey.service";
import {
  DialogState,
  DialogTitle,
  DIALOG_CONTENT_WRAPPER_CSS,
  withModalDialog,
} from "~/dialogs/withModalDialog";
import { createWorkspace } from "~/services/workspace.service";
import { onlyCallFnOnceWhilePreviousCallIsPending } from "~/utils/onlyCallOnceWhilePending";
import { IWorkspaceCreateParams } from "@libs/firebase-functions-types";
import { TextInput } from "~/form-components/TextInput";
import { setIsLoading } from "~/services/loading.service";
import { useKBarContext } from "~/services/kbar.service";
import { handleSubmit, onSubmitFn } from "~/form-components/utils";
import {
  createFormControl,
  createFormGroup,
  IFormControl,
  useControl,
} from "solid-forms-react";

export const NewWorkspaceDialogState = new DialogState();

type IFormValue = IWorkspaceCreateParams;

export const NewWorkspaceDialog = withModalDialog({
  dialogState: NewWorkspaceDialogState,
  useOnDialogContainerRendered: () => {
    useKBarContext({
      commands: () => {
        return [
          {
            label: "New workspace",
            callback: () => {
              NewWorkspaceDialogState.toggle(true);
            },
          },
        ];
      },
    });
  },
  Component: () => {
    const control = useControl(() =>
      createFormGroup({
        name: createFormControl("", {
          required: true,
        }),
      }),
    );

    useHotkeyContext({
      updateStrategy: "replace",
      commands: () => {
        return [
          {
            label: "Close dialog",
            triggers: ["Escape"],
            triggerWhenInputFocused: true,
            callback: () => {
              NewWorkspaceDialogState.toggle(false);
            },
          },
          {
            label: "Submit form",
            triggers: ["$mod+Enter"],
            triggerWhenInputFocused: true,
            callback: () => {
              console.log("attempting submit");
              handleSubmit(control, submit);
            },
          },
        ];
      },
    });

    return (
      <>
        <DialogTitle>
          <h2>New Workspace</h2>
        </DialogTitle>

        <form
          onSubmit={onSubmitFn(control, submit)}
          className={DIALOG_CONTENT_WRAPPER_CSS}
        >
          <Name control={control.controls.name} />
        </form>
      </>
    );
  },
});

const submit = onlyCallFnOnceWhilePreviousCallIsPending(
  setIsLoading(async (_values: IFormValue) => {
    // Apparently Firebase callable functions error when receiving a proxy
    // object as an argument (and solid-forms controls are proxy objects)
    // See https://github.com/firebase/firebase-js-sdk/issues/6429
    const values = { ..._values };

    console.log("submitting...", values);

    const result = await createWorkspace(values);

    if (!result.data.success) {
      console.log("submission failed", result);
      return;
    }

    console.log("submitted successfully!");

    NewWorkspaceDialogState.toggle(false);
  }),
);

const Name: ComponentType<{
  control: IFormControl<string>;
}> = (props) => {
  return (
    <div className="flex px-4">
      <div className="flex flex-1 py-2 border-b border-mauve-5">
        <TextInput name="name" control={props.control} />
      </div>
    </div>
  );
};
