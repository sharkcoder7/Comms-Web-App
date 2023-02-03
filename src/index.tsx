import { StrictMode } from "react";
import { render } from "react-dom";
import "tailwindcss/tailwind.css";
import App from "./App";
import "./index.scss";

if (import.meta.env.VITE_FIREBASE_EMULATORS === "true") {
  // Add "Emulator Mode" warning banner

  const div = document.createElement("div");

  div.innerText = "EMULATOR MODE";

  div.classList.add(
    ..."absolute w-screen bottom-0 flex justify-center".split(" "),
    ..."p-2 text-white font-bold".split(" "),
    ..."hover:opacity-0 pointer-events-auto".split(" "),
  );

  div.style.zIndex = "9999";

  div.style.backgroundColor = "rgba(255,0,0, .5)";

  document.body.append(div);
}

render(
  <StrictMode>
    <App />
  </StrictMode>,
  document.getElementById("root"),
);
