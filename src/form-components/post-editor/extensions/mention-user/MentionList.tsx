import { css } from "@emotion/css";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { SuggestionProps } from "@tiptap/suggestion";

const mentionListStyles = css`
  background: #fff;
  border-radius: 0.5rem;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0px 10px 20px rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.8);
  font-size: 0.9rem;
  overflow: hidden;
  padding: 0.2rem;
  position: relative;

  .item {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 0.4rem;
    display: block;
    margin: 0;
    padding: 0.2rem 0.4rem;
    text-align: left;
    width: 100%;

    &.is-selected {
      border-color: #000;
    }
  }
`;

/**
 * This code was largely taken from https://tiptap.dev/api/nodes/mention#usage
 */

export const MentionList = forwardRef<
  { onKeyDown(o: { event: KeyboardEvent }): boolean | undefined },
  SuggestionProps<{ id: string; label: string }>
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    // We need to track whether a mentioned list is opened or not
    // so that the RichTextEditor knows how to respond to "Escape"
    // key presses. See the RichTextEditorBase component's
    // `handleKeyDown` config method in RichTextEditor.tsx.
    openedMentionListCount++;

    return () => {
      openedMentionListCount--;
    };
  });

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length,
    );
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className={`${mentionListStyles} items`}>
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            type="button"
            className={`item ${index === selectedIndex ? "is-selected" : ""}`}
            key={item.id}
            onClick={() => selectItem(index)}
          >
            {item.label}
          </button>
        ))
      ) : (
        <div className="item">No result</div>
      )}
    </div>
  );
});

/**
 * Returns true if there is an opened mention list suggestion box.
 * Useful for determining how the RichTextEditor should handle "Escape"
 * key presses.
 */
export function isMentionListOpened() {
  return openedMentionListCount > 0;
}

let openedMentionListCount = 0;
