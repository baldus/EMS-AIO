// Shared flat ESLint config for TypeScript packages. The web app extends this with Next rules.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/generated/**",
      "app/**",
      "tests/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-explicit-any": "error",
      eqeqeq: ["error", "always"],
      "no-console": "error",
    },
  },
  {
    files: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/test/**/*.ts",
      "**/scripts/**",
      "**/*.mjs",
      // CLI entry points that print progress.
      "packages/db/src/seed.ts",
      "apps/api/src/openapi/generate.ts",
    ],
    rules: { "no-console": "off" },
  },
);
