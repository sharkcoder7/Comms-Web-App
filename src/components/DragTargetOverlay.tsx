import { cx } from "@emotion/css";
import { ComponentType } from "react";

export const DragTargetOverlay: ComponentType<{
  onDragLeave: React.DragEventHandler<HTMLDivElement>;
}> = (props) => {
  return (
    <div
      className="absolute w-full h-full bg-blackA-11 z-10 flex"
      onDragLeave={props.onDragLeave}
    >
      <div
        className={cx(
          "flex flex-1 m-4 border-4 border-dashed rounded-md",
          "border-white pointer-events-none justify-center",
          "items-center text-lg text-white font-bold",
        )}
      >
        {props.children}
      </div>
    </div>
  );
};
