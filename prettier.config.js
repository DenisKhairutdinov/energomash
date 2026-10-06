export default {
  semi: true,
  singleQuote: true,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  endOfLine: "auto",
  plugins: ["prettier-plugin-jinja-template"],
  overrides: [
    {
      files: ["**/*.njk", "**/*.html"],
      options: {
        parser: "jinja-template",
      },
    },
  ],
};
