import { useCallback, useState } from "react";
import { useHotkeyContext } from "~/services/hotkey.service";
import {
  DialogState,
  DialogTitle,
  DIALOG_CONTENT_WRAPPER_CSS,
  withModalDialog,
} from "~/dialogs/withModalDialog";
import { ISubscriptionDoc } from "@libs/firestore-models";
import {
  AutocompleteSelect,
  IOption,
} from "~/form-components/AutocompleteSelect";
import { createSubscription } from "~/services/subscription.service";
import { SingleValue } from "react-select";

interface ICreateSubscriptionDialogData {
  title: string;
  type: ISubscriptionDoc["type"];
  subjectId: ISubscriptionDoc["id"];
}

export const CreateSubscriptionDialogState =
  new DialogState<ICreateSubscriptionDialogData>();

export const CreateSubscriptionDialog = withModalDialog<
  {},
  ICreateSubscriptionDialogData
>({
  dialogState: CreateSubscriptionDialogState,
  Component: (props) => {
    if (import.meta.env.MODE === "development" && !props.data) {
      const msg = "Create subscription dialog requires data to be provided";
      alert(msg);
      throw new Error(msg);
    }

    const [isTouched, setIsTouched] = useState(false);

    const onSelect = useCallback(
      (value: SingleValue<IOption<ISubscriptionDoc["preference"]>>) => {
        if (!value?.value) {
          setIsTouched(true);
          return;
        }

        console.log("submitting...", value);

        // We want the new post form to close immediately without
        // waiting for this promise to resolve.
        // See `createNewDraft` jsdoc.
        createSubscription({
          type: props.data.type,
          subjectId: props.data.subjectId,
          // A validation function on the subscriptionPreference field prevents
          // this callback from running if `subscriptionPreference === null`.
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          preference: value!.value,
        })
          .then(() => console.log("submitted successfully!"))
          .catch(console.error);

        CreateSubscriptionDialogState.toggle(false);
      },
      [props.data.type, props.data.subjectId],
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
              CreateSubscriptionDialogState.toggle(false);
            },
          },
        ];
      },
    });

    return (
      <>
        <DialogTitle>
          <h2>{props.data.title}</h2>
        </DialogTitle>

        <div className={DIALOG_CONTENT_WRAPPER_CSS}>
          <div className="flex px-4 py-2">
            <AutocompleteSelect
              name="create-subscription"
              onBlur={() => setIsTouched(true)}
              onChange={onSelect}
              options={subscriptionOptions}
              placeholder={
                isTouched
                  ? "Notification preference required..."
                  : "Notification preference..."
              }
              autoFocus
              dropdown
              defaultMenuIsOpen
            />
          </div>
        </div>
      </>
    );
  },
});

const SUBSCRIPTION_OPTIONS: {
  ALL: ISubscriptionDoc["preference"];
  INVOLVED: ISubscriptionDoc["preference"];
  MENTIONED: ISubscriptionDoc["preference"];
  IGNORE: ISubscriptionDoc["preference"];
} = {
  ALL: "all",
  INVOLVED: "involved",
  MENTIONED: "mentioned",
  IGNORE: "ignore",
};

const subscriptionOptions: IOption<ISubscriptionDoc["preference"]>[] = [
  {
    label: "All activity",
    value: SUBSCRIPTION_OPTIONS.ALL,
  },
  {
    label: "Participating and @mentions",
    value: SUBSCRIPTION_OPTIONS.INVOLVED,
  },
  {
    label: "@mentions only",
    value: SUBSCRIPTION_OPTIONS.MENTIONED,
  },
  {
    label: "Ignore",
    value: SUBSCRIPTION_OPTIONS.IGNORE,
  },
];
