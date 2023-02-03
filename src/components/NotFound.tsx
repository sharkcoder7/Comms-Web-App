import { ComponentType } from "react";
import { Helmet } from "react-helmet-async";

export const NotFound: ComponentType<{ title?: string }> = ({
  title = "Not Found",
}) => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Helmet>
        <title>{title} | Comms</title>
      </Helmet>

      <h1 className="text-3xl text-slate-9">{title}</h1>
    </div>
  );
};
