import { ComponentType } from "react";
import {
  useNavigate,
  NavigateOptions,
  NavigateFunction,
  Location,
} from "react-router-dom";
import { createBrowserHistory, type Update } from "history";
import { Subject } from "rxjs";

export const history = createBrowserHistory({ window });

const _NAVIGATION_EVENTS = new Subject<BeforeNavigation>();

/**
 * Observable of browser navigation events. Currently just emits
 * `BeforeNavigation` events right before React Router navigation
 * begins.
 */
export const NAVIGATION_EVENTS = _NAVIGATION_EVENTS.asObservable();

export class BeforeNavigation {
  constructor(public update: Update) {}
}

// Here we register a history event listener before passing the history
// object to ReactRouter. This ensures that this callback is triggered
// before react router navigates.
// See https://github.com/remix-run/react-router/issues/8617#issuecomment-1021623058
history.listen((update) => {
  _NAVIGATION_EVENTS.next(new BeforeNavigation(update));
});

let navigate: NavigateFunction;

export const NavigateServiceInitializer: ComponentType<{}> = () => {
  navigate = useNavigate();
  return null;
};

/**
 * Allows navigation outside of React's context. The "to" argument must be a
 * full route path. Relative routing is not supported.
 */
export function navigateService(
  to: string | Location,
  options?: NavigateOptions,
) {
  if (typeof to === "string" && !to.startsWith("/")) {
    const msg =
      "The navigate service doesn't support relative routing. Routes must begin with '/'";

    alert(msg);
    console.error(msg);
  }

  navigate(to, options);
}
