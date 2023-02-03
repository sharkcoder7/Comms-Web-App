import { IPostDoc, IUserDoc } from "@libs/firestore-models";
import { createContext, useContext } from "react";
import { IAbstractControl, IFormControl, IFormGroup } from "solid-forms-react";

export type IEditorMention = [
  id: IUserDoc["id"],
  action: IPostDoc["mentionedUsers"][string]["type"],
];

export type IPostEditorControl = IFormGroup<{
  [key: string]: IAbstractControl<unknown>;
  postId: IFormControl<string>;
  body: IFormGroup<{
    content: IFormControl<string>;
    mentions: IFormControl<IEditorMention[]>;
  }>;
}>;

/** This version of the type is for internal use */
type _IPostEditorControl = IFormGroup<{
  postId: IFormControl<string>;
  body: IFormGroup<{
    content: IFormControl<string>;
    mentions: IFormControl<IEditorMention[]>;
  }>;
}>;

export interface IPostEditorContext {
  control: _IPostEditorControl;
}

export const PostEditorContext = createContext<IPostEditorContext | null>(null);

export function usePostEditorContext() {
  const context = useContext(PostEditorContext);

  if (!context) {
    throw new Error(
      "You've attempted to use PostEditorContext without providing it",
    );
  }

  return context;
}
