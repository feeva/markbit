import './commands'

import { mount } from 'cypress/vue'

import '@/assets/main.css'

// Unlike starissue, AnnotationEditor has no Pinia store, router, or i18n-plugin
// dependency (L() is a plain function import, not provide/inject) — so cy.mount
// here is just Cypress's default component mount with no extra global plugins.

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}

Cypress.Commands.add('mount', mount)
