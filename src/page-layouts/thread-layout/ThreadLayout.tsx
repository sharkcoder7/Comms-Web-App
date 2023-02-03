import { css, cx } from "@emotion/css";
import { memo } from "react";

const panelWrapperCSS = css`
  flex: 1 1 auto;
  // width: calc(640px + 8rem);
  min-width: 500px;
`;

export const ActionAndMainPanelWrapper = memo((props) => {
  return (
    <div className={cx("bg-slate-3 flex justify-center", panelWrapperCSS)}>
      {props.children}
    </div>
  );
});
