import { ComponentType, useEffect, useMemo } from "react";
import { cx } from "@emotion/css";
import { capitalize } from "lodash-es";
import { IFormControl, useControlState } from "solid-forms-react";
import { observable } from "./utils";
import { combineLatest } from "rxjs";

export const TextareaInput: ComponentType<{
  control: IFormControl<string>;
  name: string;
}> = (props) => {
  const capitalizedName = useMemo(() => capitalize(props.name), [props.name]);

  const value = useControlState(() => props.control.value, [props.control]);

  const isInvalid = useControlState(
    () => !props.control.isValid,
    [props.control],
  );

  const isTouched = useControlState(
    () => props.control.isTouched,
    [props.control],
  );

  useEffect(() => {
    const sub = combineLatest([
      observable(() => props.control.value),
      observable(() => props.control.isRequired),
    ]).subscribe(([v, isRequired]) => {
      if (isRequired && !v.trim()) {
        props.control.patchErrors({ isEmpty: true });
        return;
      }

      props.control.patchErrors({ isEmpty: null });
    });

    return () => sub.unsubscribe();
  }, [props.control]);

  const isEmpty = useControlState(
    () => !!props.control.errors?.isEmpty,
    [props.control],
  );

  return (
    <textarea
      value={value}
      className={cx(
        "flex-1 focus:outline-none",
        isTouched && isInvalid
          ? "placeholder:text-red-9"
          : "placeholder:text-slateDark-11",
      )}
      placeholder={
        isTouched && isEmpty
          ? `${capitalizedName} required...`
          : `${capitalizedName}...`
      }
      onBlur={() => props.control.markTouched(true)}
      onChange={(e) => props.control.setValue(e.target.value)}
    ></textarea>
  );
};
