import { ComponentType } from "react";
import {
  PLATFORM_MODIFIER_KEY,
  useHotkeyContext,
} from "~/services/hotkey.service";
import {
  DialogState,
  DialogTitle,
  DIALOG_CONTENT_WRAPPER_CSS,
  withModalDialog,
} from "~/dialogs/withModalDialog";
import { onlyCallFnOnceWhilePreviousCallIsPending } from "~/utils/onlyCallOnceWhilePending";
import { IUserCreateParams } from "@libs/firebase-functions-types";
import { TextInput } from "~/form-components/TextInput";
import { setIsLoading } from "~/services/loading.service";
import { createUser } from "~/services/user.service";
import { navigateService } from "~/services/navigate.service";
import {
  createFormControl,
  createFormGroup,
  IFormControl,
  useControl,
} from "solid-forms-react";
import { handleSubmit, onSubmitFn } from "~/form-components/utils";

interface INewUserDialogData {
  name: string | null;
  email: string | null;
}

export const NewUserDialogState = new DialogState<INewUserDialogData>();

type IFormValue = IUserCreateParams;

export const NewUserDialog = withModalDialog<{}, INewUserDialogData>({
  dialogState: NewUserDialogState,
  Component: (props) => {
    if (!props.data) {
      alert("Data must be supplied to the NewUserDialog");
      throw new Error("Data must be supplied to the NewUserDialog");
    }

    const control = useControl(() => {
      return createFormGroup({
        name: createFormControl(props.data?.name || "", {
          required: true,
        }),
        email: createFormControl(props.data?.email || "", {
          required: true,
        }),
      });
    });

    useHotkeyContext({
      updateStrategy: "replace",
      commands: () => {
        return [
          {
            label: "Submit form",
            triggers: ["$mod+Enter"],
            callback: () => {
              console.debug("attempting submit");
              handleSubmit(control, submit);
            },
          },
        ];
      },
    });

    return (
      <>
        <DialogTitle>
          <h2>New User Details</h2>
        </DialogTitle>

        <form
          onSubmit={onSubmitFn(control, submit)}
          className={DIALOG_CONTENT_WRAPPER_CSS}
        >
          <p className="m-4">
            <em>
              Welcome to Comms! To get started, can we have your name and email
              address? Press <kbd>{PLATFORM_MODIFIER_KEY.name}</kbd> +{" "}
              <kbd>Enter</kbd> to submit this form. You'll use{" "}
              {PLATFORM_MODIFIER_KEY.name} + <kbd>Enter</kbd> to submit all
              forms in the Comms app.
            </em>
          </p>
          <Name control={control.controls.name} />
          <Email control={control.controls.email} />
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

    const result = await createUser(values);

    if (!result.data.success) {
      console.debug("submission failed", result);
      return;
    }

    console.debug("submitted successfully!");

    NewUserDialogState.toggle(false);

    navigateService("/inbox", { replace: true });
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

const Email: ComponentType<{
  control: IFormControl<string>;
}> = (props) => {
  return (
    <div className="flex px-4">
      <div className="flex flex-1 py-2 border-b border-mauve-5">
        <TextInput name="email" type="email" control={props.control} />
      </div>
    </div>
  );
};
