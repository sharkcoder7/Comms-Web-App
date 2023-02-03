import { useEffect, useRef } from "react";
import { BehaviorSubject } from "rxjs";
import { numberComparer, stringComparer } from "~/utils/comparers";
import { stripIndent } from "common-tags";
import uid from "@libs/utils/uid";
import { useObservable } from "~/utils/useObservable";
import { groupBy } from "lodash-es";
import { DialogState } from "~/dialogs/withModalDialog";
import useConstant from "use-constant";

export type KBarCommandCallback = () => void;

export interface IKBarCommand {
  id?: string;
  label: string;
  callback: KBarCommandCallback;
}

export interface IKBarConfig {
  id: string;
  priority: number;
  commands: IKBarCommand[];
}

/**
 * Array of KBar context IDs. The last ID in the array
 * is the currently active context.
 */
const KBAR_CONTEXT_ORDER: string[] = [uid()];

function getCurrentKBarContextId() {
  return KBAR_CONTEXT_ORDER[KBAR_CONTEXT_ORDER.length - 1];
}

function createAndSwitchToNewKBarContext() {
  const newContextId = uid();
  KBAR_CONTEXT_ORDER.push(newContextId);
  KBAR_CONTEXT_STORE.set(newContextId, new Map());
}

function deleteHotkeyContext(contextId: string) {
  KBAR_CONTEXT_ORDER.splice(KBAR_CONTEXT_ORDER.indexOf(contextId), 1);
  KBAR_CONTEXT_STORE.delete(contextId);
}

type IKBarContext = Map<string, IKBarConfig>;

const KBAR_CONTEXT_STORE = new Map<string, IKBarContext>([
  [getCurrentKBarContextId(), new Map()],
]);

const ACTIVE_COMMANDS$ = new BehaviorSubject(new Map<string, IKBarCommand>());

class _KBarState extends DialogState {
  /** Observable returning a map of the currently active KBar commands */
  readonly activeCommands$ = ACTIVE_COMMANDS$.asObservable();

  activeCommands() {
    return ACTIVE_COMMANDS$.getValue();
  }
}

export const KBarState = new _KBarState();

export function useKBarCommands() {
  return useObservable(() => KBarState.activeCommands$, {
    synchronous: true,
  });
}

/**
 * Updates the KBar Service with kbar commands for the current
 * context using an update strategy (default is "merge"
 * if none is specified).
 *
 * - "merge" If this context provides commands which conflict with
 *   kbar commands provided in a parent context, this context's
 *   commands will take precedence until this context is removed.
 * - "replace" This context's commands will be the only available
 *   commands until this context is removed (at which point the
 *   previous contexts will be used again).
 */
export function useKBarContext({
  id: _id,
  commands,
  updateStrategy = "merge",
  priority = 0,
  deps = [],
}: {
  id?: string;
  commands: () => IKBarCommand[];
  updateStrategy?: "merge" | "replace";
  priority?: number;
  deps?: unknown[];
}) {
  const id = useConstant(() => _id || uid());
  const contextId = useRef<string>();

  useEffect(() => {
    if (updateStrategy === "merge") {
      contextId.current = getCurrentKBarContextId();
      return;
    }

    createAndSwitchToNewKBarContext();
    contextId.current = getCurrentKBarContextId();

    return () => {
      const areWeDeletingTheCurrentContext =
        contextId.current === getCurrentKBarContextId();

      // `contextId.current` has already been set in the useEffect body.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      deleteHotkeyContext(contextId.current!);

      if (!areWeDeletingTheCurrentContext) return;

      reindexActiveCommands();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const config: IKBarConfig = {
      id,
      priority,
      commands: commands(),
    };

    // `contextId.current` has already been set in the first useEffect body, above.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    addKBarConfig(contextId.current!, config);

    // `contextId.current` has already been set in the first useEffect body, above.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return () => removeKBarConfig(contextId.current!, config.id);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

function addKBarConfig(contextId: string, config: IKBarConfig) {
  const kbarContext = KBAR_CONTEXT_STORE.get(contextId);

  if (kbarContext === undefined) {
    throw new Error(
      stripIndent`
        The hotkey context for ${contextId} 
        cannot be found. This is a bug.
      `,
    );
  }

  kbarContext.set(config.id, config);

  if (contextId !== getCurrentKBarContextId()) return;

  // If we just updated the current kbar context then we should also
  // reindex the currently active commands.
  reindexActiveCommands();
}

function removeKBarConfig(contextId: string, configId: string) {
  const kbarContext = KBAR_CONTEXT_STORE.get(contextId);

  if (kbarContext === undefined) {
    // kbarContext will be undefined if we already deleted this context.
    // In this case, we don't need to worry about removing this config.
    return;
  }

  kbarContext.delete(configId);

  if (contextId !== getCurrentKBarContextId()) return;

  // If we just updated the current kbar context then we should also
  // reindex the currently active kbarContext.
  reindexActiveCommands();
}

function reindexActiveCommands() {
  const kbarContext = KBAR_CONTEXT_STORE.get(getCurrentKBarContextId());

  if (kbarContext === undefined) {
    throw new Error(
      stripIndent`
        The current kbar context cannot be found. This is a bug.
      `,
    );
  }

  // We group configs by priority while respecting the order the
  // configs were added in within each group.
  const groupedConfigs = groupBy(
    Array.from(kbarContext.values()),
    (config) => config.priority,
  );

  // We sort the groups in ascending order by priority then we
  // map to `[commandId, command]` entries then we create
  // a Map from these entries to remove duplicate commands.
  // Because we sorted by ascending priority, commands with
  // greater priority will take precedence.
  const commandMap = Object.fromEntries(
    Object.entries(groupedConfigs)
      .sort(([a], [b]) => numberComparer(Number(a), Number(b)))
      .flatMap(([, configs]) => configs)
      .flatMap((config) => config.commands)
      .map((command) => [command.id || command.label, command]),
  );

  // We now sort the commands by label and create a Map
  // object from the entries.
  const activeCommands = new Map(
    Object.values(commandMap)
      .sort((a, b) => stringComparer(a.label, b.label))
      .map((command) => [command.id || command.label, command]),
  );

  ACTIVE_COMMANDS$.next(activeCommands);
}
