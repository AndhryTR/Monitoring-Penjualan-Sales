import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/**", "node_modules/**", "dev-dist/**", "*.config.js"] },

  // Base JS recommended
  js.configs.recommended,

  // React + React Hooks + React Refresh
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2022,
        // Vite PWA virtual module
        "virtual:pwa-register": "readonly",
        "virtual:pwa-register/react": "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "18.3" },
    },
    rules: {
      // React recommended rules
      ...react.configs.recommended.rules,

      // React Hooks — CRITICAL: mencegah bug aturan Hooks (Sprint 1 #4) dan
      // stale closure (Sprint 2 H2). `exhaustive-deps` "warn" supaya tidak
      // block dev tapi tetap visible di output.
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "warn",

      // React Refresh — HMR untuk dev
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Project-specific relaxations
      "react/prop-types": "off", // app tidak pakai PropTypes
      "react/react-in-jsx-scope": "off", // React 17+ JSX transform
      "react/jsx-key": "warn", // lint array-index key issues (K1/K2/K3)
      "react/no-unescaped-entities": "off", // terlalu strict untuk text "..." di JSX

      // Allow ++ on for-loops, allow short-circuit assignment
      "no-plusplus": "off",
      "no-param-reassign": "off", // utility pattern sering dipakai

      // Catch unused vars (sering kena di refactor) tapi izinkan _ prefix
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
