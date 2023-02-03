import { IUserDoc } from "@libs/firestore-models";
import { PropsWithChildren, createContext, useContext } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { LoadingText } from "~/components/LoadingText";
import { CURRENT_USER$ } from "~/services/user.service";
import { useServerAPIVersion } from "~/services/version.service";
import { useObservable } from "~/utils/useObservable";

/**
 * A HOC which ensures that the wrapped component is only rendered
 * if the user is logged in (else redirects to the login page).
 * Also provides an `AuthGuardContext` for children.
 */
export function withAuthGuard<P extends PropsWithChildren<unknown>>(
  Component: React.ComponentType<P>,
) {
  return function GuardedRoute(props: P) {
    const currentUser = useObservable(() => CURRENT_USER$, {
      initialValue: "loading" as const,
    });

    const apiVersion = useServerAPIVersion();

    const location = useLocation();

    // undefined if we haven't yet ascertained the current auth status
    if (currentUser === "loading" || apiVersion === "loading") {
      return <LoadingText />;
    }

    if (!apiVersion.matches) {
      // Redirect them to the /maintenance page, but save the current location they were
      // trying to go to when they were redirected. This allows us to send them
      // along to that page after they maintenance, which is a nicer user experience
      // than dropping them off on the home page.
      return (
        <Navigate to={"/maintenance"} state={{ from: location }} replace />
      );
    }

    if (!currentUser) {
      return <Navigate to={"/login"} state={{ from: location }} replace />;
    }

    return (
      <AuthGuardContext.Provider value={{ currentUser }}>
        <Component {...props} />
      </AuthGuardContext.Provider>
    );
  };
}

export const AuthGuardContext = createContext<
  { currentUser: IUserDoc } | undefined
>(undefined);

export function useAuthGuardContext() {
  const context = useContext(AuthGuardContext);

  if (!context) {
    alert("Attempted to use AuthGuardContext without providing it");
    throw new Error("Attempted to use AuthGuardContext without providing it");
  }

  return context;
}
