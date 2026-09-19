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

  it('shows standalone select and tools buttons in landscape with crop active by default', () => {
    cy.get('[data-tip="Select"]').should('be.visible').and('not.have.class', 'btn-active')
    cy.get('[data-tip="Tools"]').should('be.visible').and('have.class', 'btn-active')
    cy.get('[data-tip="Tools"] use')
      .should('have.attr', 'href')
      .and('contain', '#tabler-border-corners')
  })

  it('can select a non-select tool from landscape mobile tools menu', () => {
    cy.get('[data-tip="Tools"]').click()
    cy.contains('a', 'Pencil').should('exist')
    cy.contains('a', 'Pencil').click({ force: true })
    cy.get('[data-tip="Select"]').should('not.have.class', 'btn-active')
    cy.get('[data-tip="Tools"]').should('have.class', 'btn-active')
    cy.get('[data-tip="Tools"] use').should('have.attr', 'href').and('contain', '#tabler-writing')
  })

  it('shows tool settings only for supported tools in landscape', () => {
    cy.get('[data-tip="Tools"]').closest('.join').find('.dropdown').should('have.length', 1)

    cy.get('[data-tip="Tools"]').click()
    cy.contains('a', 'Text').click({ force: true })
    cy.get('[data-tip="Tools"]').closest('.join').find('.dropdown').should('have.length', 2)
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
