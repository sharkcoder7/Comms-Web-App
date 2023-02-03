import { css, cx } from "@emotion/css";
import { ComponentType, forwardRef, memo, PropsWithChildren } from "react";

const mainPanelCSS = css`
  // flex: 1;
  flex: 1 1 calc(640px + 8rem);
  // max-width: 780px;
  // max-width: calc(100% - calc(40px + 4rem));
`;

export const MainPanel: ComponentType<{}> = (props) => {
  return (
    <div
      className={cx(
        "MainPanel flex flex-col justify-center items-center bg-slate-3 h-full overflow-hidden",
        mainPanelCSS,
      )}
    >
      {props.children}
    </div>
  );
};

const mainPanelHeaderCSS = css`
  width: 100%;
  // this is to properly align the header with the post entries
  // since each of them has a 3px border-left
  border-left: 3px solid transparent;
  max-width: calc(640px + 8rem);
`;

export const MainPanelHeader = memo(
  forwardRef<HTMLElement, PropsWithChildren<{}>>((props, ref) => {
    return (
      <header ref={ref} className="w-full z-20 transition-shadow duration-500">
        <div
          className={cx(
            "flex items-center py-6 pt-7 mx-auto px-14",
            mainPanelHeaderCSS,
          )}
        >
          {props.children}
        </div>
      </header>
    );
  }),
);

const mainPanelContentCSS = css`
  width: 100%;
  max-width: calc(640px + 8rem);
`;

export const MainPanelContent = memo(
  forwardRef<HTMLDivElement, PropsWithChildren<{ className?: string }>>(
    (props, ref) => {
      return (
        <div
          ref={ref}
          className={cx(
            "relative mx-auto px-6 h-full overflow-auto",
            mainPanelContentCSS,
            props.className,
          )}
        >
          {props.children}
        </div>
      );
    },
  ),
);
