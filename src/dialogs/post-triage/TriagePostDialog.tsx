import { useCallback, useMemo } from "react";
import { useHotkeyContext } from "~/services/hotkey.service";
import {
  DialogState,
  DIALOG_CONTAINER_CSS,
  DIALOG_CONTENT_WRAPPER_CSS,
  withModalDialog,
} from "~/dialogs/withModalDialog";
import {
  AutocompleteSelect,
  IOption,
} from "~/form-components/AutocompleteSelect";
import { cx } from "@emotion/css";
import { SingleValue } from "react-select";
import { triageNotification } from "~/services/inbox.service";
import dayjs from "dayjs";
import { INotificationDoc } from "@libs/firestore-models";

export interface ITriageNotificationDialogData {
  id: INotificationDoc["id"];
  triagedUntil: INotificationDoc["triagedUntil"];
}

export const TriageNotificationDialogState =
  new DialogState<ITriageNotificationDialogData>();

const defaultCommands: IOption<string>[] = [
  {
    label: "3 hours",
    value: "3-hours",
  },
  {
    label: "Tomorrow",
    value: "tomorrow",
  },
  {
    label: "Next week",
    value: "next-week",
  },
];

export const TriageNotificationDialog = withModalDialog<
  {},
  ITriageNotificationDialogData
>({
  dialogState: TriageNotificationDialogState,
  containerCSS: cx(DIALOG_CONTAINER_CSS, "-translate-y-40"),
  Component: function TriageNotificationDialogComponent({ data }) {
    if (!data) {
      throw new Error("TriageNotificationDialog expects data to be provided");
    }

    const commands = useMemo(() => {
      if (data.triagedUntil) {
        return [
          ...defaultCommands,
          { label: "Remove reminder & move to Inbox", value: "remove" },
        ];
      }

      return defaultCommands;
    }, [data.triagedUntil]);

    const onSelect = useCallback(
      (option: SingleValue<IOption>) => {
        if (!option) return;

        onSelectTriageNotification(data.id, option);
      },
      [data.id],
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
              TriageNotificationDialogState.toggle(false);
            },
          },
        ];
      },
    });

    return (
      <div className={cx(DIALOG_CONTENT_WRAPPER_CSS, "overflow-visible")}>
        <AutocompleteSelect
          name="triage-notification"
          onChange={onSelect}
          options={commands}
          placeholder="Remind me..."
          defaultMenuIsOpen
          autoFocus
        />
      </div>
    );
  },
});

async function onSelectTriageNotification(
  notificationId: string,
  option: IOption,
) {
  const setTo8AM = (date: dayjs.Dayjs) => date.set("hour", 8).startOf("hour");

  let date: dayjs.Dayjs | null = dayjs();

  if (option.value === "3-hours") {
    date = date.add(3, "hours");
  } else if (option.value === "tomorrow") {
    date = setTo8AM(date.add(1, "day"));
  } else if (option.value === "next-week") {
    // 0 = sunday; 6 = saturday
    const dayOfWeek = date.get("day");

    if (dayOfWeek === 0) {
      date = date.set("day", 1);
    } else if (dayOfWeek === 1) {
      date = date.add(1, "week");
    } else {
      date = date.add(1, "week").set("day", 1);
    }

    date = setTo8AM(date);
  } else if (option.value === "remove") {
    date = null;
  } else {
    console.error(`Unexpected triage option: ${option.value}`);
    return;
  }

  TriageNotificationDialogState.toggle(false);

  triageNotification(notificationId, date?.toDate() ?? null);
}
