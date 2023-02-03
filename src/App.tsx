import { AppRoutes } from "./Routes";
import { PortalContext } from "~/services/portal.service";
import useConstant from "use-constant";
import { Helmet, HelmetProvider } from "react-helmet-async";

addEventListener("unhandledrejection", console.error);

export default function App() {
  const portalContainer = useConstant(() => document.body);

  return (
    <HelmetProvider>
      <PortalContext.Provider value={{ container: portalContainer }}>
        <Helmet>
          {/* 
            This acts as the default page title for the app. It is expected that
            this is overwritten by child components. It may be shown while a page
            is loading. 
          */}
          <title>Comms</title>
        </Helmet>

        <AppRoutes />
      </PortalContext.Provider>
    </HelmetProvider>
  );
}
