import { cx } from "@emotion/css";
import { capitalize } from "lodash-es";
import { ComponentType, useEffect, useMemo } from "react";
import { IFormControl, useControlState } from "solid-forms-react";
import { observable } from "./utils";
import { isDecoderSuccess } from "ts-decoders";
import * as d from "ts-decoders/decoders";
import { combineLatest } from "rxjs";

export const TextInput: ComponentType<{
  control: IFormControl<string>;
  name: string;
  placeholder?: string;
  type?: string;
}> = (props) => {
  const capitalizedName = useMemo(() => capitalize(props.name), [props.name]);

  const value = useControlState(() => props.control.value, [props.control]);

  useEffect(() => {
    const source = { source: "required-validator" };

    const sub = combineLatest([
      observable(() => props.control.value),
      observable(() => props.control.isRequired),
    ]).subscribe(([v, isRequired]) => {
      if (isRequired && !v.trim()) {
        props.control.setErrors({ isEmpty: true }, source);
        return;
      }

      props.control.setErrors(null, source);
    });

    return () => sub.unsubscribe();
  }, [props.control]);

  useEffect(() => {
    if (props.type !== "email") return;

    const source = { source: "email-validator" };

    const sub = observable(() => props.control.value).subscribe((v) => {
      if (!v.trim() || isEmail(v)) {
        // we allow blank strings
        props.control.setErrors(null, source);
        return;
      }

      props.control.setErrors({ isInvalidEmail: true }, source);
    });

    return () => sub.unsubscribe();
  }, [props.control, props.type]);

  const classes = useControlState(
    () =>
      props.control.isTouched && !props.control.isValid
        ? "text-red-9 placeholder:text-red-9"
        : "placeholder:text-slateDark-11",
    [props.control],
  );

  const placeholder = useControlState(() => {
    const text = props.placeholder || capitalizedName;

    return props.control.isTouched && !!props.control.errors?.isEmpty
      ? `${text} required...`
      : `${text}...`;
  }, [props.control, props.placeholder, capitalizedName]);

  return (
    <input
      type={props.type || "text"}
      value={value}
      className={cx("flex-1 focus:outline-none", classes)}
      placeholder={placeholder}
      onBlur={() => props.control.markTouched(true)}
      onChange={(e) => props.control.setValue(e.target.value)}
    />
  );
};

function isEmail(value: string) {
  return isDecoderSuccess(d.emailD().decode(value));
}
