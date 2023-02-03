import { ComponentType, memo } from "react";
import { isEqual } from "@libs/utils/isEqual";
import { css, cx } from "@emotion/css";

const contextPanelCSS = css`
  flex: 0 1
    calc(clamp(260px, 423px, 24.47vw + (33 * (1440px - 100vw) / (1440 - 960))));
  min-width: 260px;
  max-width: 423px;
`;

export const ContextPanel: ComponentType<{}> = memo((props) => {
  return (
    <div
      className={cx(
        "RightPanel bg-white hidden md:block shadow-lg",
        contextPanelCSS,
      )}
    >
      {props.children}
    </div>
  );
}, isEqual);
