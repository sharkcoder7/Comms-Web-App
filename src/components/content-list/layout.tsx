import { Timestamp } from "@firebase/firestore-types";
import dayjs from "dayjs";
import { ComponentType, CSSProperties } from "react";

// We need to use CSS classes combined with an `<li>`
// element (rather than a react component) because the
// `<Slot>` component doesn't appear to support providing
// a React component as a child (not even a forwardRef).
export const entryCSSClasses = `
  flex gap-4 items-center h-12 
  hover:cursor-pointer px-12 border-l-2 
  border-white outline-none focus:bg-slate-4 
  focus:border-black
`;

export const Recipients: ComponentType<{ style?: CSSProperties }> = (props) => {
  return (
    <div className="flex items-center" style={{ width: 168, ...props.style }}>
      <span className="font-normal truncate">{props.children}</span>
    </div>
  );
};

export const Summary: ComponentType<{
  subject?: string | null;
  reply?: boolean;
  details?: string | null;
}> = (props) => {
  // These styles were built after inspecting the styles that Gmail uses
  // to display inbox entries. The combination is necessary to support
  // first truncating the body and then truncating the subject if
  // necessary.
  return (
    <div className="flex items-center flex-[3_3_0%] min-w-0">
      {props.subject && (
        <div className="inline-flex shrink whitespace-nowrap overflow-hidden">
          <span className="truncate font-normal mr-4">
            {props.reply ? `Re: ${props.subject}` : props.subject}
          </span>
        </div>
      )}

      <span className="text-slate-9 truncate flex-1">{props.details}</span>
    </div>
  );
};

export const EntryTimestamp: ComponentType<{ datetime: Timestamp }> = (
  props,
) => {
  return (
    <div className="flex items-center text-sm ml-4">
      <span className="text-slate-9 uppercase">
        <DisplayDate date={props.datetime} />
      </span>
    </div>
  );
};

export function DisplayDate(props: { date: Timestamp }) {
  const date = dayjs(props.date.toDate());
  const now = dayjs();

  const isSameDay = date.isSame(now, "date");

  if (isSameDay) {
    return <>{date.format("h:mm A")}</>;
  } else if (now.get("year") === date.get("year")) {
    return <>{date.format("MMM D")}</>;
  } else {
    return <>{date.format("M/D/YYYY")}</>;
  }
}
