import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: "vue",
      bundler: "vite",
    },
  },

  viewportHeight: 800,
  viewportWidth: 1200,

  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
