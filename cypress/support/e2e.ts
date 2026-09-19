import './commands'
// Plain cy.trigger('keydown', {...}) is unreliable for document-level shortcuts —
// it dispatches a synthetic Event object that doesn't always carry modifier state
// the way a real key press does. cypress-real-events sends actual input via the
// Chrome DevTools Protocol instead, which our document keydown listener sees the
// same way it would a real user's key press.
import 'cypress-real-events'
