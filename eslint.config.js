import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["marked.min.js"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        marked: "readonly",
        Telegram: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "error", "no-empty": "off", "no-useless-escape": "off", "no-control-regex": "off"
    }
  }
];
