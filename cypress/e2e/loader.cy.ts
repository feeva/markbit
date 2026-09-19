// Replaces manual clicking-around in a loader-test.html-style page: this runs
// the real, bundled loader.js/embed.js/frame.js against a plain host page and
// drives the hotkey the way a human would, instead of testing AnnotationEditor
// as an isolated component (that's what the .cy.ts component tests already
// cover).
//
// Uses cy.realPress (cypress-real-events) instead of cy.trigger('keydown', {...}):
// trigger() dispatches a synthetic Event object that doesn't reliably carry
// modifier-key state to a document-level keydown listener the way a real key
// press does. realPress sends actual input via the Chrome DevTools Protocol —
// which means this spec must run under `--browser chrome` (see the
// cypress:run:e2e / cypress:open:e2e scripts). Cypress's default Electron
// browser doesn't expose CDP input dispatch the same way, so realPress's
// modifier-key combos silently don't reach the page under Electron.
//
// #markbit-host is now a real <iframe> (blank + injected <script>, not Shadow
// DOM — see the 2026-09-19 Decision Log entry in PLAN.md), so there's no
// .shadow() to pierce. Cypress has no built-in iframe-content command, but
// .its('0.contentDocument.body') + .find(...) retries like any other command
// chain, which is enough here without pulling in a plugin like cypress-iframe.

// A plain cy.get('body').click()/.focus() is not enough here: <body> isn't a
// focusable element, so it doesn't actually change document.activeElement, and
// realPress's CDP-level key dispatch needs the AUT itself (not Cypress's
// runner UI) to hold real OS-level focus — see
// https://github.com/dmtrKovalenko/cypress-real-events/issues/196, which hits
// this exact "global shortcut, keydown listener never fires" symptom. The
// documented workaround is a *real* CDP click (realClick), not a synthetic one,
// pinned to a corner so it can't land on unrelated page content.
const openMarkbit = () => {
  cy.get('body').realClick({ position: 'topLeft' })
  cy.realPress(['Control', 'Shift', 'M'])
}

const markbitFrameBody = () =>
  cy.get('#markbit-host', { timeout: 15000 }).its('0.contentDocument.body')

const markbitCloseButton = () =>
  markbitFrameBody().find('[data-testid="markbit-close"]', { timeout: 15000 })

describe('Markbit loader (embed-test.html)', () => {
  beforeEach(() => {
    cy.visit('/embed-test.html')
  })

  it('initializes window.Markbit without loading the heavy editor bundle', () => {
    cy.window().should('have.property', 'Markbit')
    cy.get('#markbit-host').should('not.exist')
  })

  it('opens the annotation editor overlay on the configured hotkey', () => {
    openMarkbit()

    // First press triggers capture (html2canvas) + dynamic import of
    // Vue/Konva/AnnotationEditor, so give it more than the default timeout.
    cy.get('#markbit-host', { timeout: 15000 }).should('exist')

    markbitCloseButton().should('be.visible')

    // The captured screenshot actually loaded onto the Konva canvas — this is
    // the bug where the editor opened but the canvas area stayed empty
    // (AnnotationEditor's root has no explicit height without a container
    // that stretches it; frame.ts's mountPoint uses `grid` for that).
    markbitFrameBody()
      .find('[data-cy="canvas"] canvas', { timeout: 15000 })
      .should(($canvas) => {
        expect($canvas.width(), 'canvas width').to.be.greaterThan(0)
        expect($canvas.height(), 'canvas height').to.be.greaterThan(0)
      })
  })

  it('closes via the close button', () => {
    openMarkbit()
    cy.get('#markbit-host', { timeout: 15000 }).should('exist')

    markbitCloseButton().click()
    cy.get('#markbit-host').should('not.exist')
  })

  it('re-opening after a hotkey press does not re-download the editor bundle', () => {
    cy.intercept('GET', '**/AnnotationEditor-*.js').as('editorChunk')

    openMarkbit()
    cy.wait('@editorChunk')
    cy.get('#markbit-host', { timeout: 15000 }).should('exist')

    markbitCloseButton().click()
    cy.get('#markbit-host').should('not.exist')

    // Second open: same session, frame.js/AnnotationEditor.js are already
    // fetched by the browser — no second request for the editor chunk.
    openMarkbit()
    cy.get('#markbit-host', { timeout: 15000 }).should('exist')
    cy.get('@editorChunk.all').should('have.length', 1)
  })
})
