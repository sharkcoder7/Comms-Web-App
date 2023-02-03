import { cx } from "@emotion/css";
import { ComponentType, forwardRef, PropsWithChildren } from "react";

export const MainLayout: ComponentType<{}> = (props) => {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto">{props.children}</div>
  );
};

export const Header: ComponentType<{ description?: string }> = (props) => {
  return <header className="py-6 px-12">{props.children}</header>;
};

export const Main = forwardRef<
  HTMLElement,
  PropsWithChildren<{ className?: string }>
>((props, ref) => {
  return (
    <main ref={ref} className={cx("flex-1 overflow-y-auto", props.className)}>
      {props.children}
    </main>
  );
});
