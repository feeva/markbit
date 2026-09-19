import { defineConfig } from 'cypress'

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
  },

  viewportHeight: 800,
  viewportWidth: 1200,

  e2e: {
    // Runs against the production build (`npm run build && npm run preview`), not
    // the dev server — this is meant to replace manual loader-test.html-style
    // testing of the real, bundled loader.js/embed.js/AnnotationEditor.js chunks.
    baseUrl: 'http://localhost:4173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
})
