import { css, keyframes } from "@emotion/css";
import { slate } from "@radix-ui/colors";
import { usePendingUpdates } from "~/services/loading.service";

export function PendingUpdatesSpinner() {
  const isPending = usePendingUpdates();

  return (
    <div className="absolute bottom-[3rem] right-[3rem] w-0 h-0 pointer-events-none">
      {isPending && <div className={spinnerCSS} />}
    </div>
  );
}

const spinnerKeyframes = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const spinnerCSS = css`
  display: inline-block;
  width: 24px;
  height: 24px;

  &:after {
    content: " ";
    display: block;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 3px solid ${slate.slate11};
    border-color: ${slate.slate11} transparent transparent;
    animation: ${spinnerKeyframes} 0.15s linear infinite;
  }
`;
