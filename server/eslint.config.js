import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["src/uploads/**"] },
  {
    files: ["src/**/*.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^(request|response|next)$" },
      ],
    },
  },
];
