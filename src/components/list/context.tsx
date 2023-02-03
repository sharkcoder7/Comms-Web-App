import { createContext, useContext } from "react";
import { BehaviorSubject } from "rxjs";

export type EntryId = string | number;

export interface IListContext<EntryData> {
  /**
   * This observable tracks which entry in the list is currently focusable.
   * If there are no entries or if all entries are disabled, returns `null`.
   *
   * The current "focusable" entry is marked with `tabindex="0"` in the DOM
   * while all other entries have `tabindex="-1"`. This allows the user to
   * tab away from this list and then tab back and have the correct element
   * focused.
   */
  focusableEntryId$: BehaviorSubject<EntryId | null>;
  /**
   * This observable tracks which entry in the list is currently focused, if any.
   * This observable can also be used to move focus to the provided `EntryId`.
   *
   * _Note:_
   * _Doesn't support passing `null` in order to blur a currently focused entry._
   */
  focusedEntryId$: BehaviorSubject<EntryId | null>;
  focusEntryOnMouseOver: boolean;
  mergeEntry: (args: {
    id: EntryId;
    data: EntryData;
    disabled: boolean;
    node: HTMLElement;
    scrollboxEl: HTMLElement;
  }) => void;
  removeEntry: (id: EntryId) => void;
  onEntrySelect?: (id: EntryId, entryData: EntryData) => void;
  onEntryFocusIn?: (id: EntryId, entryData: EntryData) => void;
  onEntryFocusLeave?: (id: EntryId, entryData: EntryData) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ListContext = createContext<IListContext<any> | null>(null);

export function useListContext<EntryData>() {
  const context = useContext<IListContext<EntryData> | null>(ListContext);

  if (!context) {
    throw new Error("Must provide ListContext");
  }

  return context;
}
