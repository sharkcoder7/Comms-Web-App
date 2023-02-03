import { ComponentType, useMemo } from "react";
import { css, cx } from "@emotion/css";
import { OptionProps, MultiValueGenericProps } from "react-select";
import { red } from "@radix-ui/colors";
import { useChannels } from "~/services/channels.service";
import {
  AutocompleteSelect,
  IOption,
} from "~/form-components/AutocompleteSelect";
import { useObservable } from "~/utils/useObservable";
import {
  ALL_MEMBERS_OF_USERS_WORKSPACES$,
  IAcceptedWorkspaceMemberDoc,
} from "~/services/workspace.service";
import { stringComparer } from "@libs/utils/comparers";
import { IFormControl, useControlState } from "solid-forms-react";

// TODO: upgrade the RecipientsInput to import from `react-select/async`
//       instead of from `react-select` so that we can lazily load the
//       options based on what the user has typed. This will require
//       fulltext searching.

export interface IRecipientOption extends IOption<string> {
  type: "channel" | "user";
  email?: string;
  workspaceNames?: string[];
}

export const Recipients: ComponentType<{
  control: IFormControl<IRecipientOption[]>;
}> = (props) => {
  const options = useRecipientOptions();

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
      <div
        className={cx("flex flex-1 py-3 border-b border-mauve-5", {
          [showLabelOnFocusCSS]: value.length === 0,
        })}
      >
        <label
          className={cx(
            "mr-2",
            isTouched && isInvalid ? "text-red-9" : "text-slateDark-11",
          )}
        >
          To
        </label>

        <AutocompleteSelect
          name="recipients"
          value={value}
          onBlur={() => props.control.markTouched(true)}
          onChange={(newValue) =>
            props.control.setValue(newValue as IRecipientOption[])
          }
          options={options}
          placeholder={
            isTouched && isInvalid ? "Recipient required..." : "Recipients..."
          }
          autoFocus
          multiple
          components={components}
          classNames={
            (isTouched && isInvalid && `input-invalid ${recipientsInputCSS}`) ||
            ""
          }
        />
      </div>
    </div>
  );
};

const showLabelOnFocusCSS = css`
  &:not(:focus-within) label {
    display: none;
  }
`;

const recipientsInputCSS = css`
  &.input-invalid .react-select-placeholder {
    color: ${red.red9};
  }
`;

const MultiValueLabel: ComponentType<
  MultiValueGenericProps<IOption, boolean>
> = (props) => {
  const option = props.data as IRecipientOption;

  return (
    <div className="flex items-center text-sm mr-2">
      {option.type === "channel" ? "#" : "@"} {option.label}
    </div>
  );
};

const Option: ComponentType<OptionProps<IOption, boolean>> = (props) => {
  const option = props.data as IRecipientOption;

  return (
    <div
      className={cx(
        "py-2 px-4",
        props.isFocused ? "bg-blue-5" : "bg-transparent",
      )}
    >
      {option.type === "channel" ? "#" : "@"} {option.label}
      <span className="text-slateA-8 ml-4">
        {option.workspaceNames
          ? option.workspaceNames.join(", ")
          : option.email}
      </span>
    </div>
  );
};

const components = {
  Option,
  MultiValueLabel,
};

export function useRecipientOptions() {
  const workspaceMembers = useObservable(
    () => ALL_MEMBERS_OF_USERS_WORKSPACES$,
    {
      initialValue: [] as IAcceptedWorkspaceMemberDoc[],
    },
  );

  const channels = useChannels();

  const options: IRecipientOption[] = useMemo(() => {
    return [...channels, ...workspaceMembers].map((doc) => {
      if (doc.__docType === "IChannelDoc") {
        return {
          type: "channel",
          label: doc.name,
          value: doc.id,
          workspaceNames: Object.values(doc.workspacePermissions)
            .map((p) => p.name)
            .sort(stringComparer),
        };
      }

      return {
        type: "user",
        label: doc.user.name,
        value: doc.id,
        email: doc.user.email,
      };
    });
  }, [channels, workspaceMembers]);

  return options;
}
