import { useLocation, Navigate, Location } from "react-router-dom";
import { ComponentType } from "react";
import { Helmet } from "react-helmet-async";
import { useServerAPIVersion } from "~/services/version.service";
import { LoadingText } from "~/components/LoadingText";

export const MaintenanceView: ComponentType<{}> = () => {
  const apiVersion = useServerAPIVersion();

  const location = useLocation();

  const redirectTo = attemptToGetRedirectLocation(location);

  // undefined if we haven't yet ascertained the current auth status
  if (apiVersion === "loading") {
    return <LoadingText />;
  }

  if (apiVersion.matches) {
    return (
      <Navigate
        to={
          !redirectTo || redirectTo.pathname.startsWith("/maintenance")
            ? "/inbox"
            : redirectTo
        }
        replace
      />
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen flex-col space-y-10">
      <Helmet>
        <title>Maintenance | Comms</title>
      </Helmet>

      <h1 className="text-4xl font-bold">Down for Maintenance</h1>

      <div className="flex px-8 py-4 items-center">
        <p>
          {apiVersion.server?.message || "Comms is currently being updated."}
        </p>
      </div>
    </div>
  );
};

/**
 * If the user was attempting to navigate to a protected page in
 * our app, the `withAuthGuard` wrapper would redirect them to
 * the login page but save the location they were attempting to
 * navigate to in `location.state.from`.
 */
function attemptToGetRedirectLocation({ state }: Location) {
  if (typeof state !== "object" || !state) return;

  const { from } = state as { from?: Location };

  return from;
}
