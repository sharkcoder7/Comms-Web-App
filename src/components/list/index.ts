export type { EntryId } from "./context";
export type { IListProps, IListRef, IListEntry } from "./List";
export type { IListEntryProps } from "./Entry";

export { ListScrollbox, useListScrollboxContext } from "./ListScrollbox";

import { List as _List } from "./List";
import { Entry } from "./Entry";

const List = _List as typeof _List & {
  Entry: typeof Entry;
};

List.Entry = Entry;

export { List };
