import { css } from "@emotion/css";
import { slate } from "@radix-ui/colors";
import { ComponentType } from "react";

const iconCSS = css`
  display: block;
  position: absolute;
  top: -104%;
  left: -84%;
  cursor: pointer;
  width: 7rem;
  height: 7rem;
  transform: scaleY(0.75);

  input {
    display: none;
  }

  path {
    fill: none;
    stroke: ${slate.slate8};
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    --length: 24;
    --offset: -38;
    stroke-dasharray: var(--length) var(--total-length);
    stroke-dashoffset: var(--offset);
    transition: all 500ms cubic-bezier(0.645, 0.045, 0.355, 1);
  }

  .line--1,
  .line--3 {
    --total-length: 103.35061645507812;
    --offset: -42.35061645507812;
  }

  .line--2 {
    --total-length: 99;
  }

  input:checked + svg {
    transform: translateX(5px);

    path {
      transform: translateX(31px);
    }

    .line--1,
    .line--3 {
      --offset: -8.602325267;
      --length: 13.602325267;
    }
    .line--2 {
      --offset: -7;
    }
  }
`;

// Keeping this around for the moment in case we want to
// dust it off and use it in the future.
// from https://codepen.io/Zaku/pen/ejLNJL
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const OldSidebarIcon: ComponentType<{}> = () => {
  return (
    <div
      id="sidebar-menu-icon"
      className="relative block w-[50px] h-9 overflow-hidden"
    >
      <label className={iconCSS}>
        <input type="checkbox" />

        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path className="line--1" d="M0 55l14-10c4.7-3.3 9-5 13-5h72" />
          <path className="line--2" d="M0 50h99" />
          <path className="line--3" d="M0 45l14 10c4.7 3.3 9 5 13 5h72" />
        </svg>
      </label>
    </div>
  );
};

const newCSS = css`
  transform: rotate(180deg) scale(1.25);
  path {
    fill: ${slate.slate8};
  }
`;

export const SidebarIcon: ComponentType<{}> = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      enableBackground="new 0 0 24 24"
      height="24px"
      viewBox="0 0 24 24"
      width="24px"
      className={newCSS}
    >
      <rect fill="none" height="24" width="24" />
      <path d="M15,5l-1.41,1.41L18.17,11H2V13h16.17l-4.59,4.59L15,19l7-7L15,5z" />
    </svg>
  );
};
