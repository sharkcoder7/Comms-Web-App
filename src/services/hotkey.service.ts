import { useEffect, useRef } from "react";
import { fromEvent, share } from "rxjs";
import { numberComparer } from "~/utils/comparers";
import { stripIndent } from "common-tags";
import uid from "@libs/utils/uid";
import { groupBy } from "lodash-es";
import { createKeybindingsHandler } from "@libs/tinykeys";
import { useAssertPropIsImmutable } from "~/utils/useAssertPropIsImmutable";
import { FiCommand } from "react-icons/fi";
import { ImCtrl } from "react-icons/im";
import useConstant from "use-constant";

export type HotkeyCommandCallback = (event: KeyboardEvent) => void;

export interface IHotkeyCommand {
  label: string;
  triggers: string[];
  triggerWhenInputFocused?: boolean;
  callback: HotkeyCommandCallback;
}

export interface IHotkeyConfig {
  id: string;
  priority: number;
  commands: IHotkeyCommand[];
}

type IHotkeyContext = Map<string, IHotkeyConfig>;

/**
 * Array of hotkey context IDs. The last ID in the array
 * is the currently active context.
 */
// Previously, I attempted incrementing
// and decrementing an integer to track the active context,
// but since contexts can be removed out of order this
// wasn't a reliable method (if an inactive context was
// removed, it caused the "current ID" to change when it shouldn't).
const HOTKEY_CONTEXT_ORDER: string[] = [uid()];

function getCurrentHotkeyContextId() {
  return HOTKEY_CONTEXT_ORDER[HOTKEY_CONTEXT_ORDER.length - 1];
}

function createAndSwitchToNewHotkeyContext() {
  const newContextId = uid();
  HOTKEY_CONTEXT_ORDER.push(newContextId);
  HOTKEY_CONTEXT_STORE.set(newContextId, new Map());
}

function deleteHotkeyContext(contextId: string) {
  HOTKEY_CONTEXT_ORDER.splice(HOTKEY_CONTEXT_ORDER.indexOf(contextId), 1);
  HOTKEY_CONTEXT_STORE.delete(contextId);
}

const HOTKEY_CONTEXT_STORE = new Map<string, IHotkeyContext>([
  [getCurrentHotkeyContextId(), new Map()],
]);

/** Handler for all hotkeys */
// eslint-disable-next-line @typescript-eslint/no-empty-function
let hotkeyEventHandler: EventListener = () => {};

/** Handler for hotkeys which can be triggered while an input has focus */
// eslint-disable-next-line @typescript-eslint/no-empty-function
let inputHotkeyEventHandler: EventListener = () => {};

/**
 * On Apple devices the platform modifier key is
 * the command key and on other devices it is the
 * control key.
 */
export const PLATFORM_MODIFIER_KEY =
  typeof navigator === "object" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform)
    ? ({ name: "Command", shortName: "Cmd", symbol: FiCommand } as const)
    : ({ name: "Control", shortName: "Ctrl", symbol: ImCtrl } as const);

/**
 * Updates the Hotkey Service with hotkey commands for the current
 * context using an update strategy. Hotkey events are processed
 * by the tinykeys library. Hotkeys should be written in the format
 * tinykeys expects. See https://github.com/jamiebuilds/tinykeys
 *
 * Note `$mod` is a special key you can use in hotkey triggers. On
 * Apple devices it translates to the "command" key and on other
 * devices it translates to the "control" key.
 *
 * Update Strategy Options:
 * - "merge" (default) If this context provides commands which conflict with
 *   hotkey commands provided in a parent context, this context's
 *   commands will take precedence until this context is removed.
 * - "replace" This context's commands will be the only available
 *   commands until this context is removed (at which point the
 *   previous contexts will be used again).
 */
export function useHotkeyContext({
  id: _id,
  commands,
  updateStrategy = "merge",
  priority = 0,
  deps = [],
}: {
  id?: string;
  commands: () => IHotkeyCommand[];
  /**
   * **IMPORTANT!** `updateStrategy` is immutable.
   */
  updateStrategy?: "merge" | "replace";
  priority?: number;
  /**
   * The dependencies for the `commands` factory function. The
   * commands are only rebuild when the deps change.
   */
  deps?: unknown[];
}): void {
  useAssertPropIsImmutable("updateStrategy", updateStrategy);

  const id = useConstant(() => _id || uid());
  const contextId = useRef<string>();

  useEffect(() => {
    if (updateStrategy === "merge") {
      contextId.current = getCurrentHotkeyContextId();
      return;
    }

    createAndSwitchToNewHotkeyContext();
    contextId.current = getCurrentHotkeyContextId();

    return () => {
      const areWeDeletingTheCurrentContext =
        contextId.current === getCurrentHotkeyContextId();

      // `contextId.current` has already been set in the useEffect body
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      deleteHotkeyContext(contextId.current!);

      if (!areWeDeletingTheCurrentContext) return;

      reindexActiveHotkeys();
    };
  }, [updateStrategy]);

  useEffect(
    () => {
      const config: IHotkeyConfig = {
        id,
        priority,
        commands: commands(),
      };

      // `contextId.current` has already been set in the first useEffect body, above.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      mergeHotkeyConfig(contextId.current!, config);
    },
    // The `commands` prop doesn't need to be included because the `deps` array
    // lists it's dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, priority, ...deps],
  );

  useEffect(() => {
    // `contextId.current` has already been set in the first useEffect body, above.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return () => removeHotkeyConfig(contextId.current!, id);
  }, [id]);
}

function mergeHotkeyConfig(contextId: string, config: IHotkeyConfig) {
  const hotkeyContext = HOTKEY_CONTEXT_STORE.get(contextId);

  if (hotkeyContext === undefined) {
    throw new Error(
      stripIndent`
        The hotkey context for ${contextId} 
        cannot be found. This is a bug.
      `,
    );
  }

  hotkeyContext.set(config.id, config);

  if (contextId !== getCurrentHotkeyContextId()) return;

  // If we just updated the current hotkey context then we should also
  // reindex the currently active hotkeys.
  reindexActiveHotkeys();
}

function removeHotkeyConfig(contextId: string, configId: string) {
  const hotkeyContext = HOTKEY_CONTEXT_STORE.get(contextId);

  if (hotkeyContext === undefined) {
    // HotkeyContext will be undefined if we already deleted this context.
    // In this case, we don't need to worry about removing this config.
    return;
  }

  hotkeyContext.delete(configId);

  if (contextId !== getCurrentHotkeyContextId()) return;

  // If we just updated the current hotkey context then we should also
  // reindex the currently active hotkeys.
  reindexActiveHotkeys();
}

function reindexActiveHotkeys() {
  const hotkeyContext = HOTKEY_CONTEXT_STORE.get(getCurrentHotkeyContextId());

  if (hotkeyContext === undefined) {
    throw new Error(
      stripIndent`
        The current hotkey context cannot be found. This is a bug.
      `,
    );
  }

  // We group configs by priority while respecting the order the
  // configs were added in within each group.
  const groupedConfigs = groupBy(
    Array.from(hotkeyContext.values()),
    (config) => config.priority,
  );

  // We sort the groups in ascending order by priority then we
  // map to `[triggerString, commandCallback]` entries then we create
  // a keyBindingMap from these entries to remove duplicate triggers.
  // Because we sorted by ascending priority, triggers with
  // greater priority will take precedence. Finally, we wrap all
  // callbacks so that they preventDefault on the associated
  // KeyboardEvent.
  const commands = Object.entries(groupedConfigs)
    .sort(([a], [b]) => numberComparer(Number(a), Number(b)))
    .flatMap(([, configs]) => configs)
    .flatMap((config) => config.commands);

  const keyBindingMap = Object.fromEntries(
    commands.flatMap(mapCommandToKeyBinding),
  );

  const inputKeyBindingMap = Object.fromEntries(
    commands
      .filter((command) => command.triggerWhenInputFocused)
      .flatMap(mapCommandToKeyBinding),
  );

  console.debug(
    "hotkey keyBindingMap changed",
    keyBindingMap,
    inputKeyBindingMap,
  );

  hotkeyEventHandler = createKeybindingsHandler(keyBindingMap);
  inputHotkeyEventHandler = createKeybindingsHandler(inputKeyBindingMap);
}

export const WINDOW_EVENTS$ = fromEvent<KeyboardEvent>(window, "keydown").pipe(
  share(),
);

WINDOW_EVENTS$.subscribe((event) => {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName;

  if (
    tagName === "INPUT" ||
    tagName === "SELECT" ||
    tagName === "TEXTAREA" ||
    target?.isContentEditable
  ) {
    inputHotkeyEventHandler(event);
    return;
  }

  hotkeyEventHandler(event);
});

function mapCommandToKeyBinding(command: IHotkeyCommand) {
  return command.triggers.map((trigger) => [
    trigger,
    (event: KeyboardEvent) => {
      if (import.meta.env.MODE === "development") {
        console.log("hotkey triggered", trigger, event);
      } else if (import.meta.env.MODE === "production") {
        console.debug("hotkey triggered", trigger, event);
      }

      // At least one command does need this prevent default:
      // when you press "c" to open the compose post modal,
      // if we don't prevent default then the "to" field will
      // have a "c" in it on open.
      event.preventDefault();
      command.callback(event);
    },
  ]);
}
