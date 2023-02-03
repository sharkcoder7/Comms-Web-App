import { ComponentType } from "react";
import { useHotkeyContext } from "~/services/hotkey.service";
import {
  DialogState,
  DialogTitle,
  DIALOG_CONTENT_WRAPPER_CSS,
  withModalDialog,
} from "~/dialogs/withModalDialog";
import { onlyCallFnOnceWhilePreviousCallIsPending } from "~/utils/onlyCallOnceWhilePending";
import { TextInput } from "~/form-components/TextInput";
import { IOption } from "~/form-components/AutocompleteSelect";
import { setIsLoading } from "~/services/loading.service";
import { WorkspaceSelect } from "~/form-components/WorkspacesSelect";
import { useKBarContext } from "~/services/kbar.service";
import {
  sendWorkspaceInvite,
  useWorkspaces,
} from "~/services/workspace.service";
import {
  createFormControl,
  createFormGroup,
  IFormControl,
  useControl,
  useControlState,
} from "solid-forms-react";
import { handleSubmit, onSubmitFn } from "~/form-components/utils";

export const WorkspaceInviteDialogState = new DialogState();

interface IFormValue {
  workspaces: IOption<string>[];
  email: string;
}

export const WorkspaceInviteDialog = withModalDialog({
  dialogState: WorkspaceInviteDialogState,
  useOnDialogContainerRendered: () => {
    const workspaces = useWorkspaces();

    useKBarContext({
      commands: () => {
        if (workspaces.length === 0) return [];

        return [
          {
            label: "Send workspace invitation",
            callback: () => {
              WorkspaceInviteDialogState.toggle(true);
            },
          },
        ];
      },
      deps: [workspaces.length],
    });
  },
  Component: () => {
    const control = useControl(() =>
      createFormGroup({
        workspaces: createFormControl<IOption<string>[]>([], {
          validators: (value: IOption<string>[]) =>
            value.length > 0 ? null : { required: true },
        }),
        email: createFormControl("", {
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
              WorkspaceInviteDialogState.toggle(false);
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
          <h2>Send workspace invitation</h2>
        </DialogTitle>

        <form
          onSubmit={onSubmitFn(control, submit)}
          className={DIALOG_CONTENT_WRAPPER_CSS}
        >
          <Workspaces control={control.controls.workspaces} />
          <Email control={control.controls.email} />
        </form>
      </>
    );
  },
});

const submit = onlyCallFnOnceWhilePreviousCallIsPending(
  setIsLoading(async (values: IFormValue) => {
    console.log("submitting...", values);

    const result = await sendWorkspaceInvite({
      email: values.email,
      workspaceMemberships: values.workspaces.map((data) => ({
        role: "admin",
        workspaceId: data.value,
      })),
    });

    if (!result.data.success) {
      console.log("submission failed", result);
      return;
    }

    console.log("submitted successfully!");
    WorkspaceInviteDialogState.toggle(false);
  }),
);

const Workspaces: ComponentType<{
  control: IFormControl<IOption<string>[]>;
}> = (props) => {
  const value = useControlState(() => props.control.value, [props.control]);

  const isInvalid = useControlState(
    () => !props.control.isValid,
    [props.control],
  );

  const isTouched = useControlState(
    () => props.control.isTouched,
    [props.control],
  );

  return (
    <div className="flex px-4">
      <WorkspaceSelect
        label="For"
        value={value}
        multiple
        autoFocus
        error={isInvalid ? "Required." : undefined}
        touched={isTouched}
        onBlur={() => props.control.markTouched(true)}
        onChange={(newValue) =>
          props.control.setValue(newValue as IOption<string>[])
        }
      />
    </div>
  );
};

const Email: ComponentType<{
  control: IFormControl<string>;
}> = (props) => {
  return (
    <div className="flex px-4">
      <div className="flex flex-1 py-2 border-b border-mauve-5">
        <TextInput
          name="email"
          type="email"
          placeholder="Email address"
          control={props.control}
        />
      </div>
    </div>
  );
};
