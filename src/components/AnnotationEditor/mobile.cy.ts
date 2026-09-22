import { mountMobile, fireMobilePinchWheel, getStageScale, getZoomBounds } from './test-helpers'

describe('<AnnotationEditor /> - Mobile Devices', () => {
  beforeEach(() => {
    mountMobile()
  })

  it('renders the canvas on mobile viewport', () => {
    cy.get('[data-cy="canvas"]').should('exist').and('be.visible')
  })

  it('shows mobile-specific gesture hint', () => {
    cy.contains('Pinch to zoom').should('be.visible')
    cy.contains('Two fingers to pan').should('be.visible')
  })

  it('shows only real keyboard shortcuts in the Help dropdown', () => {
    cy.get('[aria-label="Help"]').should('be.visible').click()
    cy.contains('Delete / Backspace').should('be.visible')
    cy.contains('Undo').should('not.exist')
  })

  it('lists tools as standalone buttons (not a picker) and defaults to Marker active', () => {
    cy.get('[aria-label="Select"]').should('be.visible').and('not.have.class', 'btn-active')
    cy.get('[aria-label="Crop"]').should('be.visible').and('not.have.class', 'btn-active')
    cy.get('[aria-label="Box"]').should('be.visible').and('not.have.class', 'btn-active')
    cy.get('[aria-label="Marker"]').should('be.visible').and('have.class', 'btn-active')
  })

  it('can select a non-select tool directly from the mobile toolbar', () => {
    cy.get('[aria-label="Text"]').click()

    cy.get('[aria-label="Select"]').should('not.have.class', 'btn-active')
    cy.get('[aria-label="Marker"]').should('not.have.class', 'btn-active')
    cy.get('[aria-label="Text"]').should('have.class', 'btn-active')
  })

  it('shows one shared settings dropdown only for tools that support settings', () => {
    // Marker (the default active tool) supports settings.
    cy.get('[data-cy="mobile-tool-settings"]').should('exist')

    cy.get('[aria-label="Select"]').click()
    cy.get('[data-cy="mobile-tool-settings"]').should('not.exist')

    cy.get('[aria-label="Crop"]').click()
    cy.get('[data-cy="mobile-tool-settings"]').should('not.exist')

    cy.get('[aria-label="Box"]').click()
    cy.get('[data-cy="mobile-tool-settings"]').should('exist')
  })

  it("reflects the active tool's own color/size range in the shared settings dropdown", () => {
    // Marker default range is 10-40.
    cy.get('[data-cy="mobile-tool-settings"] [role="button"]').click()
    cy.get('[data-cy="mobile-tool-settings"] input[type="range"]')
      .should('have.attr', 'min', '10')
      .and('have.attr', 'max', '40')

    cy.get('[aria-label="Text"]').click()
    cy.get('[data-cy="mobile-tool-settings"] [role="button"]').click()
    cy.get('[data-cy="mobile-tool-settings"] input[type="range"]')
      .should('have.attr', 'min', '12')
      .and('have.attr', 'max', '72')
  })

  it('caps mobile zoom to dynamic bounds (min: 0.5 or fitScale*0.5, max: 3x)', () => {
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
