import {
  PLATFORM_MODIFIER_KEY,
  useHotkeyContext,
} from "~/services/hotkey.service";
import {
  DialogState,
  DIALOG_OVERLAY_CSS,
  withModalDialog,
} from "~/dialogs/withModalDialog";
import { useKBarContext } from "~/services/kbar.service";
import { css, cx } from "@emotion/css";
import { ComponentType } from "react";

export const HelpDialogState = new DialogState();

const overlayCSS = cx(
  DIALOG_OVERLAY_CSS,
  css`
    backdrop-filter: blur(8px);
  `,
);

export const HelpDialog = withModalDialog({
  dialogState: HelpDialogState,
  overlayCSS,
  useOnDialogContainerRendered: () => {
    useHotkeyContext({
      id: "HelpDialogContainer",
      commands: () => {
        return [
          {
            label: "Open help",
            triggers: ["?", "Shift+?"],
            callback: () => {
              HelpDialogState.toggle(true);
            },
          },
        ];
      },
    });

    useKBarContext({
      id: "HelpDialogContainer",
      commands: () => {
        return [
          {
            id: "open-help",
            label: "Open help",
            callback: () => {
              HelpDialogState.toggle(true);
            },
          },
        ];
      },
    });
  },
  Component: () => {
    useHotkeyContext({
      id: "HelpDialog",
      updateStrategy: "replace",
      commands: () => {
        return [
          {
            label: "Close dialog",
            triggers: ["Escape"],
            callback: () => {
              HelpDialogState.toggle(false);
            },
          },
        ];
      },
    });

    return (
      <div
        className={cx(
          "text-white bg-blackA-10 rounded-lg p-6",
          "overflow-y-auto",
        )}
      >
        <h2 className="text-3xl mb-4">Help</h2>

        <p className="mb-2">
          Note, in the future the Comms app will only be navigable via the
          keyboard and mouse clicks will be disabled.
        </p>

        <ul className="list-disc mb-4">
          <li className="ml-8">
            <a
              href="https://www.notion.so/levelshealth/Comms-By-Levels-2c18b69d056a4b4da10c5b4725632b22"
              rel="noreferrer"
              target="_blank"
              className="underline"
            >
              Notion onboarding document
            </a>
          </li>

          <li className="ml-8">
            <a
              href="https://github.com/orgs/levelshealth/projects/2"
              rel="noreferrer"
              target="_blank"
              className="underline"
            >
              Comms Roadmap (highlights only)
            </a>
          </li>
        </ul>

        <table className="border border-white border-collapse w-full">
          <thead>
            <tr>
              <th className={cx(thCSS, "w-3/8")}>Shortcut</th>
              <th className={cx(thCSS, "w-5/8")}>Command</th>
            </tr>
          </thead>
          <tbody>
            <Row shortcut={"Escape"} command="Close dialog" />
            <Row shortcut={"G → I"} command="Go to Inbox" />
            <Row shortcut={"G → T"} command="Go to Sent" />
            <Row shortcut={"G → E"} command="Go to Done" />
            <Row shortcut={"G → H"} command="Go to Reminders" />
            <Row shortcut={"G → #"} command="Go to channel #" />
            <Row shortcut={"C"} command="Compose new post" />
            <Row shortcut={"R"} command="Reply to thread" />
            <Row
              shortcut={"E"}
              command="Mark done (from Inbox view and from Thread view)"
            />
            <Row
              shortcut={"H"}
              command="Set reminder (Inbox and Reminder views only)"
            />
            <Row
              shortcut={`${PLATFORM_MODIFIER_KEY.shortName} + Shift + ,`}
              command="Delete draft"
            />
            <Row shortcut={"U"} command="Subscribe/unsubscribe from thread" />
            <Row
              shortcut={"Enter"}
              command="Expand/collapse post (Thread view only)"
            />
            <Row
              shortcut={`${PLATFORM_MODIFIER_KEY.shortName} + K`}
              command="Command Bar"
            />
            <Row
              shortcut={`${PLATFORM_MODIFIER_KEY.shortName} + Enter`}
              command="Submit form"
            />
            <Row shortcut={"?"} command="Open help menu" />
          </tbody>
        </table>
      </div>
    );
  },
});

const thCSS = "border border-whiteA-9 bg-whiteA-5 px-4 py-2 text-left";
const tdCSS = "border border-whiteA-9 px-4 py-2";

const Row: ComponentType<{ shortcut: string; command: string }> = (props) => {
  return (
    <tr>
      <td className={tdCSS}>{props.shortcut}</td>
      <td className={tdCSS}>{props.command}</td>
    </tr>
  );
};
