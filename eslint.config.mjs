import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default [
  ...coreWebVitals,
  ...typescript,
  {
    settings: {
      react: {
        version: "18.3.0",
      },
    },
  },
];
