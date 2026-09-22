import {
  mountMobileLandscape,
  fireMobilePinchWheel,
  getStageScale,
  getZoomBounds,
} from './test-helpers'

describe('<AnnotationEditor /> - Mobile Devices (Landscape)', () => {
  beforeEach(() => {
    mountMobileLandscape()
  })

  it('renders the canvas on mobile landscape viewport', () => {
    cy.get('[data-cy="canvas"]').should('exist').and('be.visible')
  })

  it('lists tools as standalone buttons in landscape and defaults to Marker active', () => {
    cy.get('[aria-label="Select"]').should('be.visible').and('not.have.class', 'btn-active')
    cy.get('[aria-label="Marker"]').should('be.visible').and('have.class', 'btn-active')
  })

  it('can select a non-select tool directly from the landscape mobile toolbar', () => {
    cy.get('[aria-label="Pencil"]').click()

    cy.get('[aria-label="Select"]').should('not.have.class', 'btn-active')
    cy.get('[aria-label="Marker"]').should('not.have.class', 'btn-active')
    cy.get('[aria-label="Pencil"]').should('have.class', 'btn-active')
  })

  it('shows one shared settings dropdown only for tools that support settings in landscape', () => {
    // Marker (the default active tool) supports settings.
    cy.get('[data-cy="mobile-tool-settings"]').should('exist')

    cy.get('[aria-label="Crop"]').click()
    cy.get('[data-cy="mobile-tool-settings"]').should('not.exist')

    cy.get('[aria-label="Text"]').click()
    cy.get('[data-cy="mobile-tool-settings"]').should('exist')
  })

  it('caps landscape mobile zoom to dynamic bounds (min: 0.5 or fitScale*0.5, max: 3x)', () => {
    let minZoom = 0
    let maxZoom = 0

    getZoomBounds().then((bounds) => {
      minZoom = bounds.minZoom
      maxZoom = bounds.maxZoom
    })

    for (let i = 0; i < 30; i++) {
      fireMobilePinchWheel(120)
    }

    getStageScale().then((currentScale) => {
      expect(currentScale).to.be.closeTo(maxZoom, 0.05)
    })

    for (let i = 0; i < 40; i++) {
      fireMobilePinchWheel(-120)
    }

    getStageScale().then((currentScale) => {
      expect(currentScale).to.be.closeTo(minZoom, 0.05)
    })
  })
})
