import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prefer-const": "warn",
      "no-var": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
