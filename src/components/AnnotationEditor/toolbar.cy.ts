import { mountDesktop } from './test-helpers'
import type { AnnotationDocument } from '@/types/annotations'

describe('<AnnotationEditor /> - Toolbar (Desktop)', () => {
  beforeEach(() => {
    mountDesktop()
  })

  it('defaults to crop for a new screenshot', () => {
    cy.get('[data-tip="Crop"]').should('have.class', 'btn-active')
    cy.get('[data-tip="Select"]').should('not.have.class', 'btn-active')
  })

  it('defaults to select for an existing annotation document', () => {
    const annotationData: AnnotationDocument = {
      version: 1,
      image: { width: 1280, height: 800 },
      crop: { x: 100, y: 60, width: 980, height: 640 },
      items: [],
    }

    mountDesktop({ annotationData })

    cy.get('[data-tip="Select"]').should('have.class', 'btn-active')
    cy.get('[data-tip="Crop"]').should('not.have.class', 'btn-active')
  })

  it('activates a tool when clicked', () => {
    cy.viewport(1280, 720) // Desktop viewport
    cy.get('[data-tip=Box]').click()
    cy.get('[data-tip=Box]').should('have.class', 'btn-active')
  })

  it('deactivates previous tool when new tool is selected', () => {
    cy.viewport(1280, 720) // Desktop viewport
    cy.get('[data-tip=Box]').click()
    cy.get('[data-tip="Text"]').click()
    cy.get('[data-tip=Box]').should('not.have.class', 'btn-active')
    cy.get('[data-tip="Text"]').should('have.class', 'btn-active')
  })

  it('displays zoom controls', () => {
    cy.get('[data-tip="Zoom In"]').should('be.visible')
    cy.get('[data-tip="Zoom Out"]').should('be.visible')
    cy.get('[data-tip="Zoom Level"]').should('be.visible')
  })

  it('displays delete button', () => {
    cy.get('[data-tip="Delete"]').should('be.visible')
  })

  it('displays crop button', () => {
    cy.get('[data-tip="Crop"]').should('be.visible')
  })

  it('displays select button', () => {
    cy.get('[data-tip="Select"]').should('be.visible')
  })

  it('keeps delete button disabled when nothing is selected', () => {
    cy.get('[data-tip="Delete"]').should('be.disabled')
  })

  it('shows current zoom percentage', () => {
    cy.get('[data-tip="Zoom Level"]').invoke('text').should('match', /\d+%/)
  })

  it('shows only real keyboard shortcuts in the Help dropdown', () => {
    cy.get('[data-tip="Help"]').should('be.visible').click()
    cy.contains('Delete / Backspace').should('be.visible')
    cy.contains('Cmd/Ctrl + A').should('be.visible')
    cy.contains('Lock aspect ratio').should('be.visible')
    // No undo/redo, arrow-nudge, or zoom/tool hotkeys exist — don't claim they do.
    cy.contains('Undo').should('not.exist')
  })

  it('offers a feedback link in the Help dropdown that opens in a new tab', () => {
    cy.get('[data-tip="Help"]').should('be.visible').click()
    cy.contains('a', 'Send feedback')
      .should('have.attr', 'href', 'https://github.com/feeva/markbit/issues/new')
      .and('have.attr', 'target', '_blank')
  })

  it('renders no result-action buttons when none are supplied (the default)', () => {
    cy.get('[data-tip="Copy to Clipboard"]').should('not.exist')
    cy.get('[data-tip="Download PNG"]').should('not.exist')
  })

  it('renders arbitrary supplied actions and fires their onClick with a save payload', () => {
    const onClick = cy.stub().as('onClick')
    mountDesktop({ actions: [{ id: 'test', label: 'Test Action', icon: 'copy', onClick }] })

    cy.get('[data-tip="Test Action"]').should('be.visible').click()
    cy.get('@onClick')
      .should('have.been.calledOnce')
      .its('firstCall.args.0')
      .should('have.keys', ['annotationData', 'previewDataUrl'])
  })
})
