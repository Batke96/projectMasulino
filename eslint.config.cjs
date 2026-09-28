const next = require("eslint-config-next");

module.exports = [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/.data/**",
      "**/dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    settings: {
      next: {
        rootDir: "apps/web/",
      },
    },
  },
  ...next,
];
