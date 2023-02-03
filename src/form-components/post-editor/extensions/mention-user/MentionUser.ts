import Mention from "@tiptap/extension-mention";
import tippy, { Instance, GetReferenceClientRect } from "tippy.js";
import { ReactRenderer } from "@tiptap/react";
import { MentionList } from "./MentionList";
import { SuggestionProps } from "@tiptap/suggestion";
import { firstValueFrom } from "rxjs";
import { useEffect } from "react";
import { ALL_MEMBERS_OF_USERS_WORKSPACES$ } from "~/services/workspace.service";
import { PluginKey } from "prosemirror-state";
import { IPostDoc } from "@libs/firestore-models";

export const MentionUser = buildMentionExtension("mention", "@");

export const RequestResponseUser = buildMentionExtension(
  "request-response",
  "@@",
);

export const InterruptUser = buildMentionExtension("interrupt", "@@@");

/**
 * Maintains proper subscriptions to make opening the mentions list
 * speedy. Also, since the mentions list queries using promises
 * we can only return a single value. Firestore often returns partial
 * results initially and then updates later with more results.
 * By maintaing a subscription here, we ensure that the user gets
 * better results.
 */
export function useMentionExtensionSubscriptions() {
  useEffect(() => {
    const sub = ALL_MEMBERS_OF_USERS_WORKSPACES$.subscribe();
    return () => sub.unsubscribe();
  }, []);
}

type MentionListComponent = ReactRenderer<
  {
    onKeyDown(o: { event: KeyboardEvent }): boolean | undefined;
  },
  SuggestionProps<{ id: string; label: string }> &
    React.RefAttributes<{
      onKeyDown(o: { event: KeyboardEvent }): boolean | undefined;
    }>
>;

function buildMentionExtension(
  extensionId: IPostDoc["mentionedUsers"][string]["type"],
  char: string,
) {
  return Mention.extend({
    name: extensionId,
  }).configure({
    renderLabel({ node, options }) {
      return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`;
    },
    suggestion: {
      pluginKey: new PluginKey(extensionId),
      char,
      items: async ({ query }: { query: string }) => {
        const members = await firstValueFrom(ALL_MEMBERS_OF_USERS_WORKSPACES$);

        if (!query) {
          return members
            .slice(0, 4)
            .map((m) => ({ id: m.id, label: m.user.name }));
        }

        const lowercaseQuery = query.toLowerCase();

        return members
          .filter((m) => m.user.name.toLowerCase().startsWith(lowercaseQuery))
          .slice(0, 4)
          .map((m) => ({ id: m.id, label: m.user.name }));
      },

      render: () => {
        let component: MentionListComponent;
        let popup: Instance[] = [];

        return {
          onStart: (props) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });

            if (!props.clientRect) {
              return;
            }

            popup = tippy("body", {
              getReferenceClientRect:
                props.clientRect as GetReferenceClientRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "bottom-start",
            });
          },

          onUpdate(props) {
            component.updateProps(props);

            if (!props.clientRect) {
              return;
            }

            popup[0].setProps({
              getReferenceClientRect:
                props.clientRect as GetReferenceClientRect,
            });
          },

          onKeyDown(props) {
            if (props.event.key === "Escape") {
              component.destroy();
              props.event.stopPropagation();
              return true;
            }

            return component.ref?.onKeyDown(props) || false;
          },

          onExit() {
            popup[0].destroy();
            component.destroy();
          },
        };
      },
    },
  });
}
