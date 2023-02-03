/* 
  Explore configuration options docs https://tailwindcss.com/docs/configuration#configuration-options
  Or check the default configuration https://unpkg.com/browse/tailwindcss@latest/stubs/defaultConfig.stub.js
*/

const rawColors = require("@radix-ui/colors");

// @radix-ui/colors
// Provides two color pallets for each color: a "light" varient and
// a "dark" varient. The light varient is just named after the color
// and is intended for use with black text. The dark varient is
// suffixed with "Dark" and is intended for use with white text.
//
// Light varient colors are exported in the form:
// - `{ red: { red1: "", red2: "", ... } }`
// - `{ redA: { redA1: "", redA2: "", ... } }`
// Dark varient colors are exported in the form:
// - `{ redDark: { red1: "", red2: "", ... } }`
// - `{ redDarkA: { redA1: "", redA2: "", ... } }`
//
// For usage in tailwind, we transform the colors to be in the more ergonomic form
// - `{ red: { 1: "", 2: "", ... } }`
// - `{ redA: { 1: "", 2: "", ... } }`
// - `{ redDark: { 1: "", 2: "", ... } }`.
// - `{ redDarkA: { 1: "", 2: "", ... } }`.
const colors = Object.fromEntries(
  Object.entries(rawColors).map(([colorGroupLabel, colorGroup]) => {
    return [
      colorGroupLabel,
      Object.fromEntries(
        Object.entries(colorGroup).map(([shadeLabel, shade]) => {
          const normalizedColorGroupLabel = colorGroupLabel.replace("Dark", "");

          return [shadeLabel.replace(normalizedColorGroupLabel, ""), shade];
        }),
      ),
    ];
  }),
);

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      black: "#000000",
      white: "#ffffff",
      ...colors,
    },
  },
  plugins: [
    require("@tailwindcss/forms")({
      strategy: "class", // see https://github.com/tailwindlabs/tailwindcss-forms#using-only-global-styles-or-only-classes
    }),
  ],
};
