import { createContext, useContext } from "react";

export const PortalContext = createContext<{
  container: HTMLElement | null;
}>({
  container: null,
});

export function usePortalContext() {
  const context = useContext(PortalContext);

  if (!context.container) {
    alert(`Attempted to access PortalContext without providing container`);

    throw new Error(
      `Attempted to access PortalContext without providing container`,
    );
  }

  return context as { container: HTMLElement };
}
