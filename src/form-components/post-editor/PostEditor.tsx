import { JSONContent } from "@tiptap/react";
import { Editor as CoreEditor } from "@tiptap/core";
import { forwardRef, useCallback, useEffect, useMemo } from "react";
import { cx } from "@emotion/css";
import { useControlState } from "solid-forms-react";
import { observable } from "../utils";
import { combineLatest } from "rxjs";
import {
  IPostEditorRef as IPostEditorRef,
  PostEditorBase,
} from "./PostEditorBase";
import {
  IEditorMention,
  IPostEditorContext,
  IPostEditorControl,
  PostEditorContext,
} from "./context";
export { type IPostEditorRef as IRichTextEditorRef } from "./PostEditorBase";

export interface IPostEditorProps {
  control: IPostEditorControl;
  onEditorStartOverflow?: () => void;
  onEditorEndOverflow?: () => void;
  initialTabIndex?: number;
}

export const PostEditor = forwardRef<IPostEditorRef, IPostEditorProps>(
  (props, ref) => {
    const control = props.control as IPostEditorContext["control"];

    const isInvalid = useControlState(
      () => !control.controls.body.isValid,
      [control],
    );

    const isTouched = useControlState(
      () => control.controls.body.isTouched,
      [control],
    );

    const context = useMemo(() => ({ control: control }), [control]);

    useEffect(() => {
      const source = { source: "required-validator" };

      const sub = combineLatest([
        observable(() => control.controls.body.controls.content.isRequired),
        observable(() => control.rawValue.body.content),
      ]).subscribe(([isRequired, content]) => {
        if (isRequired && validateRequiredTextInput(content)) {
          control.controls.body.controls.content.setErrors(
            { isEmpty: true },
            source,
          );
          return;
        }

        control.controls.body.controls.content.setErrors(null, source);
      });

      return () => sub.unsubscribe();
    }, [control]);

    const getInitialValue = useCallback(() => {
      return control.rawValue.body.content;
      // we only use this once to get the initial value
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onChange = useCallback(
      ({ editor }: { editor: CoreEditor }) => {
        const json = editor.getJSON();

        control.controls.body.patchValue({
          content: editor.isEmpty ? "" : editor.getHTML(),
          mentions: extractMentionsFromEditorJSON(json),
        });
      },
      [control],
    );

    const onBlur = useCallback(() => {
      control.controls.body.markTouched(true);
    }, [control]);

    const isFieldEmpty = useControlState(
      () =>
        control.rawValue.body.content === "<p></p>" ||
        !control.rawValue.body.content,
      [control],
    );

    const placeholder = (
      <span
        className={cx(
          "absolute whitespace-nowrap pointer-events-none",
          isTouched && isInvalid ? "text-red-9" : "text-slateDark-11",
          { hidden: !isFieldEmpty },
        )}
      >
        {isTouched && isInvalid ? `Content required...` : `Content...`}
      </span>
    );

    return (
      <PostEditorContext.Provider value={context}>
        <div className="relative flex-1 overflow-y-auto prose">
          {placeholder}

          <PostEditorBase
            ref={ref}
            onChange={onChange}
            onBlur={onBlur}
            onEditorStartOverflow={props.onEditorStartOverflow}
            onEditorEndOverflow={props.onEditorEndOverflow}
            getInitialValue={getInitialValue}
            initialTabIndex={props.initialTabIndex}
          />
        </div>
      </PostEditorContext.Provider>
    );
  },
);

function extractMentionsFromEditorJSON(json: JSONContent): IEditorMention[] {
  const getMentions = (
    json: JSONContent,
    mentions: Array<{
      id: string;
      label: string;
      type: "mention" | "request-response" | "interrupt";
    }> = [],
  ) => {
    if (
      json.type === "mention" ||
      json.type === "request-response" ||
      json.type === "interrupt"
    ) {
      mentions.push({
        ...(json.attrs as { id: string; label: string }),
        type: json.type,
      });
    } else if (json.content) {
      json.content.forEach((j) => getMentions(j, mentions));
    }

    return mentions;
  };

  const mentions = new Map<
    string,
    "mention" | "request-response" | "interrupt"
  >();

  const getPriority = (type?: "mention" | "request-response" | "interrupt") => {
    switch (type) {
      case "interrupt":
        return 1;
      case "request-response":
        return 2;
      case "mention":
        return 3;
      default:
        return 4;
    }
  };

  for (const mention of getMentions(json)) {
    const existingLevel = getPriority(mentions.get(mention.id));
    const newLevel = getPriority(mention.type);

    if (existingLevel <= newLevel) continue;

    mentions.set(mention.id, mention.type);
  }

  return Array.from(mentions);
}

function validateRequiredTextInput(value: string) {
  const text = value?.trim();

  if (!text || text === "<p></p>") return "Required.";
  return;
}
