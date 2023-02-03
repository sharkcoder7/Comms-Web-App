import { ComponentType, useCallback, useMemo } from "react";
import { useHotkeyContext } from "~/services/hotkey.service";
import {
  DIALOG_CONTAINER_CSS,
  DIALOG_CONTENT_WRAPPER_CSS,
  withModalDialog,
} from "~/dialogs/withModalDialog";
import {
  AutocompleteSelect,
  IOption,
} from "~/form-components/AutocompleteSelect";
import { cx } from "@emotion/css";
import { SingleValue, MultiValue } from "react-select";
import {
  KBarState,
  useKBarCommands,
  useKBarContext,
} from "~/services/kbar.service";
import { signout } from "~/services/user.service";

export const KBarDialog: ComponentType<{}> = withModalDialog({
  dialogState: KBarState,
  containerCSS: cx(DIALOG_CONTAINER_CSS, "-translate-y-40"),
  useOnDialogContainerRendered: () => {
    useHotkeyContext({
      commands: () => {
        return [
          {
            label: "Command bar",
            triggers: ["$mod+k"],
            triggerWhenInputFocused: true,
            callback: () => {
              KBarState.toggle(true);
            },
          },
        ];
      },
    });

    useKBarContext({
      commands: () => {
        return [
          {
            label: "Sign out",
            callback: signout,
          },
        ];
      },
    });
  },
  Component: function KBarDialogComponent() {
    const commands = useKBarCommands();

    const commandAutocompleteOptions = useMemo(() => {
      return Array.from(commands.values()).map<IOption<string>>((c) => ({
        label: c.label,
        value: c.id || c.label,
      }));
    }, [commands]);

    const onSelect = useCallback(
      (newValue: SingleValue<IOption> | MultiValue<IOption>) => {
        if (!newValue) return;

        const command = commands.get((newValue as IOption<string>).value);

        if (!command) return;

        KBarState.toggle(false);
        command.callback();
      },
      [commands],
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
              KBarState.toggle(false);
            },
          },
        ];
      },
    });

    return (
      <div className={cx(DIALOG_CONTENT_WRAPPER_CSS, "overflow-visible")}>
        <AutocompleteSelect
          name="command-bar"
          onChange={onSelect}
          options={commandAutocompleteOptions}
          placeholder="Command bar..."
          defaultMenuIsOpen
          autoFocus
        />
      </div>
    );
  },
});
