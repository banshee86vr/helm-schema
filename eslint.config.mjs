import parser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 9,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
  },
];
