/**
 * This service exists to facilitate prefetching all dynamic imports
 * in the application to support offline mode.
 */

const DYNAMIC_IMPORTS = {
  compressorjs: () => import("compressorjs").then((m) => m.default),
  parseHTMLProse: () => import("~/utils/parseHTMLProse"),
} as const;

export function importModule<T extends keyof typeof DYNAMIC_IMPORTS>(name: T) {
  return DYNAMIC_IMPORTS[name]() as ReturnType<typeof DYNAMIC_IMPORTS[T]>;
}

export function importAllModules() {
  Object.values(DYNAMIC_IMPORTS).forEach((fn) => fn());
}
