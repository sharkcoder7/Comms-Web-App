import { css, cx } from "@emotion/css";
import { memo, PropsWithChildren } from "react";

const actionPanelCSS = css`
  flex: 5.25 0 0;
  min-width: 4rem;
  max-width: 423px;
`;

export const ActionPanel = memo(
  (props: PropsWithChildren<{ className?: string }>) => {
    return (
      <div className={cx("LeftPanel", actionPanelCSS, props.className)}>
        {props.children}
      </div>
    );
  },
);
