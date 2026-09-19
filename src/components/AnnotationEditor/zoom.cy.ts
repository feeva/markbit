import { mountDesktop } from './test-helpers'

describe('<AnnotationEditor /> - Zoom Controls', () => {
  beforeEach(() => {
    mountDesktop()
  })

  it('increases zoom when Zoom In is clicked', () => {
    cy.get('[data-tip="Zoom In"]').click()
    cy.get('[data-tip="Zoom Level"]')
      .invoke('text')
      .then((text) => {
        const zoom = parseInt(text)
        expect(zoom).to.be.greaterThan(90)
      })
  })

  it('decreases zoom when Zoom Out is clicked', () => {
    cy.get('[data-tip="Zoom In"]').click() // First zoom in
    cy.get('[data-tip="Zoom Out"]').click()
    cy.get('[data-tip="Zoom Level"]')
      .invoke('text')
      .then((text) => {
        const zoom = parseInt(text)
        expect(zoom).to.be.lessThan(110)
      })
  })

  it('sets zoom to 100% when 100% option is selected', () => {
    cy.get('[data-tip="Zoom In"]').click()
    cy.get('[data-tip="Zoom In"]').click()
    cy.get('[data-tip="Zoom Level"]').click()
    cy.contains('a', '100%').click()
    cy.get('[data-tip="Zoom Level"]').should('contain', '100%')
  })

  it('limits maximum zoom to 300%', () => {
    // Click zoom in many times
    for (let i = 0; i < 20; i++) {
      cy.get('[data-tip="Zoom In"]').click()
    }
    cy.get('[data-tip="Zoom Level"]').should('contain', '300%')
  })

  it('limits minimum zoom dynamically based on image size', () => {
    // Click zoom out many times to reach minimum
    for (let i = 0; i < 20; i++) {
      cy.get('[data-tip="Zoom Out"]').click()
    }

    // Verify zoom level is capped at minimum (additional clicks don't decrease it)
    cy.get('[data-tip="Zoom Level"]')
      .invoke('text')
      .then((firstLevel) => {
        cy.get('[data-tip="Zoom Out"]').click()
        cy.get('[data-tip="Zoom Level"]').should('have.text', firstLevel)
      })
  })
})
