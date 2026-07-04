import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const banTsCommentConfig = {
  "ts-expect-error": "allow-with-description",
  "ts-ignore": "allow-with-description",
  "ts-nocheck": true,
  "ts-check": false,
  minimumDescriptionLength: 3,
};

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
      "@typescript-eslint/ban-ts-comment": ["error", banTsCommentConfig],
    },
  },
  {
    // CommonJS config files legitimately need require().
    // Setup scripts may use console for human-facing output.
    files: [
      "*.config.{js,cjs,mjs,ts}",
      "next.config.{js,ts}",
      "sentry.*.config.{js,ts}",
      "scripts/**/*.{js,ts}",
      "__tests__/**/*.{js,ts,tsx}",
      "proxy.ts",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },
];
