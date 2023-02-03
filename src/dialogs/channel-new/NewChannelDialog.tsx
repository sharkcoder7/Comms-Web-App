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
import { createChannel } from "~/services/channels.service";
import { IOption } from "~/form-components/AutocompleteSelect";
import { navigateService } from "~/services/navigate.service";
import { setIsLoading } from "~/services/loading.service";
import { WorkspaceSelect } from "~/form-components/WorkspacesSelect";
import { useKBarContext } from "~/services/kbar.service";
import {
  createFormControl,
  createFormGroup,
  IFormControl,
  useControl,
  useControlState,
} from "solid-forms-react";
import { TextareaInput } from "~/form-components/Textarea";
import { handleSubmit, onSubmitFn } from "~/form-components/utils";

export const NewChannelDialogState = new DialogState();

interface IFormValue {
  workspaces: IOption<string>[];
  name: string;
  description: string;
}

export const NewChannelDialog = withModalDialog({
  dialogState: NewChannelDialogState,
  useOnDialogContainerRendered: () => {
    useKBarContext({
      commands: () => {
        return [
          {
            label: "New channel",
            callback: () => {
              NewChannelDialogState.toggle(true);
            },
          },
        ];
      },
    });
  },
  Component: () => {
    const control = useControl(() =>
      createFormGroup({
        workspaces: createFormControl<IOption<string>[]>([], {
          validators: required,
          required: true,
        }),
        name: createFormControl("", {
          required: true,
        }),
        description: createFormControl(""),
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
              NewChannelDialogState.toggle(false);
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
          <h2>New Channel</h2>
        </DialogTitle>

        <form
          onSubmit={onSubmitFn(control, submit)}
          className={DIALOG_CONTENT_WRAPPER_CSS}
        >
          <Workspaces control={control.controls.workspaces} />
          <Name control={control.controls.name} />
          <Description control={control.controls.description} />
        </form>
      </>
    );
  },
});

function required(value: IOption<string>[]) {
  return value.length > 0 ? null : { required: "Required." };
}

const submit = onlyCallFnOnceWhilePreviousCallIsPending(
  setIsLoading(async (values: IFormValue) => {
    console.log("submitting...", values);

    const result = await createChannel({
      name: values.name,
      description: values.description || null,
      photoURL: null,
      workspaces: values.workspaces.map((option) => ({
        id: option.value,
        role: "admin",
      })),
    });

    if (!result.data.success) {
      console.log("submission failed", result);
      return;
    }

    console.log("submitted successfully!");

    NewChannelDialogState.toggle(false);

    navigateService(`/channels/${result.data.data.channelId}`);
  }),
);

// TODO: upgrade the RecipientsInput to import from `react-select/async`
//       instead of from `react-select` so that we can lazily load the
//       options based on what the user has typed. This will require
//       fulltext searching.

const Workspaces: ComponentType<{
  control: IFormControl<IOption<string>[]>;
}> = (props) => {
  const value = useControlState(() => props.control.value, [props.control]);

  const error = useControlState(
    () => props.control.errors?.required as string | undefined,
    [props.control],
  );

  const touched = useControlState(
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
        error={error}
        touched={touched}
        onBlur={() => props.control.markTouched(true)}
        onChange={(newValue) =>
          props.control.setValue(newValue as IOption<string>[])
        }
      />
    </div>
  );
};

const Name: ComponentType<{
  control: IFormControl<string>;
}> = (props) => {
  return (
    <div className="flex px-4">
      <div className="flex flex-1 py-2 border-b border-mauve-5">
        <TextInput control={props.control} name="name" />
      </div>
    </div>
  );
};

const Description: ComponentType<{
  control: IFormControl<string>;
}> = (props) => {
  return (
    <div className="flex flex-1 overflow-y-auto p-4" tabIndex={-1}>
      <TextareaInput control={props.control} name="description" />
    </div>
  );
};
