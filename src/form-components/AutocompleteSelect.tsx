import {
  ComponentType,
  FocusEventHandler,
  PropsWithChildren,
  useMemo,
} from "react";
import { cx } from "@emotion/css";
import Select, {
  StylesConfig,
  OptionProps,
  ActionMeta,
  MultiValue,
  MultiValueGenericProps,
  PlaceholderProps,
  SingleValue,
  SelectComponentsConfig,
  GroupBase,
} from "react-select";
import { blue, slateDark } from "@radix-ui/colors";

// This AutocompleteSelect component provides a wrapper for the
// `react-select` package. Learn more in the `react-select` docs
// here: https://react-select.com/home

export interface IOption<V = unknown> {
  label: string;
  value: V;
}

export function AutocompleteSelect<O, M extends boolean = false>(
  props: PropsWithChildren<{
    value?: M extends true ? MultiValue<IOption<O>> : SingleValue<IOption<O>>;
    name: string;
    options?: IOption<O>[];
    onChange?: (
      newValue: M extends true
        ? MultiValue<IOption<O>>
        : SingleValue<IOption<O>>,
      actionMeta: ActionMeta<IOption<O>>,
    ) => void;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    classNames?: string;
    placeholder?: string;
    multiple?: M;
    dropdown?: boolean;
    autoFocus?: boolean;
    defaultMenuIsOpen?: boolean;
    components?: {
      Option?: ComponentType<OptionProps<IOption<O>, M>>;
      MultiValueLabel?: ComponentType<MultiValueGenericProps<IOption<O>, M>>;
    };
  }>,
) {
  // react-select allows overriding it's internal components with user
  // provided custom implementations. Here we provide some custom overrides
  // while still maintaining the ability to provide additional overrides
  // via the AutocompleteSelect#components prop.
  const reactSelectComponentOverrides = useMemo(() => {
    const componentsConfig: SelectComponentsConfig<
      IOption<O>,
      M,
      GroupBase<IOption<O>>
    > = {
      Option,
      MultiValueLabel,
      Placeholder,
      ...props.components,
    };

    // need to do it this way because the component errors if undefined
    // is provided for a component
    if (!props.dropdown) {
      // The IndicatorsContainer holds a dropdown arrow for the select
      // as well as the "clear all" button, if present. We want to hide
      // these so we provide a noop implementation.
      componentsConfig.IndicatorsContainer = () => null;
    }

    return componentsConfig;
  }, [props.components, props.dropdown]);

  return (
    <Select
      autoFocus={props.autoFocus}
      isMulti={props.multiple}
      placeholder={props.placeholder}
      inputId={props.name}
      isClearable={false}
      options={props.options}
      value={props.value}
      onChange={
        // Typescript can't handle a conditional type like `M extends true ?` here
        props.onChange as (
          newValue: MultiValue<IOption<O>> | SingleValue<IOption<O>>,
          actionMeta: ActionMeta<IOption<O>>,
        ) => void
      }
      onBlur={props.onBlur}
      defaultMenuIsOpen={props.defaultMenuIsOpen}
      components={
        reactSelectComponentOverrides as SelectComponentsConfig<
          IOption<O>,
          boolean,
          GroupBase<IOption<O>>
        >
      }
      className={cx("flex-1 relative", props.classNames)}
      styles={autocompleteSelectStyles}
    />
  );
}

/*
 * This is the DOM structure of `react-select` using
 * psyudo html to represent the classes.
 *
 * <container>
 *   <control>
 *     <valueContainer>
 *       <placeholder /> // only rendered if there isn't a value in the actual input element
 *
 *       <multiValue> // only rendered if isMulti = true for Select and at least one option has been selected
 *         <multiValueLabel />
 *         <multiValueRemove />
 *       </multiValue>
 *
 *       <input>
 *         <actual-input-element />
 *       </input>
 *     </valueContainer>
 *   </control>
 *
 *   <menu> // only rendered if there is a value in the actual input element
 *     <menuList>
 *       <noOptionsMessage /> // rendered if no options
 *       <option /> // rendered for each available option
 *     </menuList>
 *   </menu>
 * </container>
 */

const NULL_STYLES = () => ({});

// see the react-selct docs for details on how to override the react-select
// default styles (which is what we are doing here).
// https://react-select.com/styles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const autocompleteSelectStyles: StylesConfig<IOption<any>, boolean> = {
  container: NULL_STYLES, // styled using className on the Select component
  control: () => {
    return {
      display: "flex",
      flex: 1,
    };
  },
  valueContainer: () => {
    return {
      position: "relative",
      display: "flex",
      flex: 1,
    };
  },
  placeholder: () => {
    return {
      position: "absolute",
      left: "0px",
      color: slateDark.slate11,
    };
  },
  input: () => {
    return {
      zIndex: 1,
    };
  },
  menu: (base) => {
    return {
      ...base,
    };
  },
  menuList: (base) => {
    return {
      ...base,
    };
  },
  multiValue: (base, props) => {
    return {
      display: "flex",
      padding: "0 .5rem",
      borderRadius: ".25rem",
      border: "1px solid grey",
      alignItems: "center",
      marginRight: ".5rem",
      backgroundColor: props.isFocused ? blue.blue5 : "",
    };
  },
  multiValueLabel: NULL_STYLES,
  multiValueRemove: () => {
    return {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    };
  },
  option: NULL_STYLES,

  clearIndicator: NULL_STYLES,
  dropdownIndicator: NULL_STYLES,
  group: NULL_STYLES,
  groupHeading: NULL_STYLES,
  indicatorSeparator: NULL_STYLES,
  indicatorsContainer: NULL_STYLES,
  loadingIndicator: NULL_STYLES,
  loadingMessage: NULL_STYLES,
  menuPortal: NULL_STYLES,
  noOptionsMessage: NULL_STYLES,
  singleValue: NULL_STYLES,
};

// The Placeholder component's name comes from react-select and this
// component has a specific meaning/usage within react-select. See the
// react-select docs
// https://react-select.com/components

// `any` seems to be necessary here to make the types work
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Placeholder: ComponentType<PlaceholderProps<IOption<any>, any>> = (
  props,
) => {
  return (
    <div className="react-select-placeholder absolute left-0 text-slateDark-11">
      {props.children}
    </div>
  );
};

// The MultiValueLabel component's name comes from react-select and this
// component has a specific meaning/usage within react-select. See the
// react-select docs
// https://react-select.com/components
function MultiValueLabel<M extends boolean = false>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: MultiValueGenericProps<IOption<any>, M>,
) {
  // props.children is the label string
  // const data = props.data as Omit<IOption, 'label'>;

  return <div className="flex items-center text-sm mr-2">{props.children}</div>;
}

// The Option component's name comes from react-select and this
// component has a specific meaning/usage within react-select. See the
// react-select docs
// https://react-select.com/components
function Option<M extends boolean = false>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: OptionProps<IOption<any>, M>,
) {
  return (
    <div
      className={cx(
        "py-2 px-4",
        props.isFocused ? "bg-blue-5" : "bg-transparent",
      )}
    >
      {props.label}
    </div>
  );
}
