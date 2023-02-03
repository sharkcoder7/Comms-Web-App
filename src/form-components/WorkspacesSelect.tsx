import { PropsWithChildren, useMemo } from "react";
import { css, cx } from "@emotion/css";
import { red } from "@radix-ui/colors";
import {
  AutocompleteSelect,
  IOption,
} from "~/form-components/AutocompleteSelect";
import { useWorkspaces } from "~/services/workspace.service";
import { MultiValue, SingleValue } from "react-select";

// TODO: upgrade the RecipientsInput to import from `react-select/async`
//       instead of from `react-select` so that we can lazily load the
//       options based on what the user has typed. This will require
//       fulltext searching.

/**
 * Component for selecting a workspace with autocomplete.
 */
export function WorkspaceSelect<M extends boolean>(
  props: PropsWithChildren<{
    value?: M extends true ? MultiValue<IOption> : SingleValue<IOption>;
    touched?: boolean;
    error?: string;
    onChange?: M extends true
      ? (newValue: MultiValue<IOption>) => void
      : (newValue: SingleValue<IOption>) => void;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    autoFocus?: boolean;
    multiple?: M;
    label?: string;
  }>,
) {
  const workspaces = useWorkspaces();

  const options: IOption<string>[] = useMemo(() => {
    return workspaces.map((workspace) => {
      return {
        label: workspace.name,
        value: workspace.id,
      };
    });
  }, [workspaces]);

  return (
    <div
      className={cx("flex flex-1 py-2 border-b border-mauve-5", {
        [showLabelOnFocusCSS]: props.multiple
          ? (props.value as MultiValue<IOption>)?.length === 0
          : !props.value,
      })}
    >
      {props.label && (
        <label
          className={cx(
            "mr-2",
            props.touched && props.error ? "text-red-9" : "text-slateDark-11",
          )}
        >
          {props.label}
        </label>
      )}

      <AutocompleteSelect
        name="workspaces"
        value={props.value}
        onBlur={props.onBlur}
        onChange={
          props.onChange as (
            newValue: MultiValue<IOption> | SingleValue<IOption>,
          ) => void
        }
        options={options}
        placeholder={
          props.touched && props.error
            ? "Workspace required..."
            : "Workspaces..."
        }
        autoFocus={props.autoFocus}
        multiple={props.multiple}
        classNames={
          (props.touched &&
            props.error &&
            `input-invalid ${workspacesInputCSS}`) ||
          ""
        }
      />
    </div>
  );
}

const showLabelOnFocusCSS = css`
  &:not(:focus-within) label {
    display: none;
  }
`;

const workspacesInputCSS = css`
  &.input-invalid .react-select-placeholder {
    color: ${red.red9};
  }
`;
