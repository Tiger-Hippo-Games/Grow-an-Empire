// ESLint flat config (CODING_STANDARDS §39). Run with `pnpm lint`; `pnpm check` runs it too.
// Type-checking itself is left to `tsc --noEmit`; these rules catch the mistakes tsc allows.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "release/", "node_modules/", ".pnpm-store/", ".tmp/", "art-tools/", "Assets/", "public/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: { globals: globals.browser },
    rules: {
      // Unused imports and variables are dead code (CODING_STANDARDS §42). `_name` marks a deliberate skip.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      // The portal forbids blocking dialogs (SUBMISSION_GUIDE §15; the bundle validator checks this too).
      "no-alert": "error",
      // console.info/debug are for local debugging; warnings and errors are how failures are reported.
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
    },
  },
  {
    files: ["src/**/__tests__/**/*.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    files: ["Tools/**/*.mjs", "vite.config.ts", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
);
