import { createTestImage, mountDesktop } from './test-helpers'
import type { AnnotationDocument } from '@/types/annotations'

const TWO_RECTANGLES: AnnotationDocument = {
  version: 1,
  image: { width: 1280, height: 800 },
  crop: { x: 100, y: 60, width: 980, height: 640 },
  items: [
    {
      id: 'rect-1',
      type: 'rectangle',
      x: 150,
      y: 150,
      width: 150,
      height: 100,
      stroke: '#DC2626',
      strokeWidth: 3,
    },
    {
      id: 'rect-2',
      type: 'rectangle',
      x: 500,
      y: 400,
      width: 150,
      height: 100,
      stroke: '#2563EB',
      strokeWidth: 3,
    },
  ],
}

const mountEditor = (annotationData: AnnotationDocument) => {
  mountDesktop({ annotationData, imageUrl: createTestImage() })
  cy.get('.konvajs-content').should(($content) => {
    expect($content[0].clientWidth).to.be.greaterThan(0)
  })
}

const withRectangleNodes = (callback: (rects: any[]) => void) => {
  cy.window().then((win) => {
    const stage = (win as any).Konva?.stages?.[0]
    expect(stage).to.exist
    const rects = stage.find('Rect').filter((node: any) => node.getAttr('annotationType') === 'rectangle')
    callback(rects)
  })
}

const clickRectangle = (index: number, options: Partial<Cypress.ClickOptions> = {}) => {
  withRectangleNodes((rects) => {
    const rect = rects[index]
    expect(rect).to.exist
    const clientRect = rect.getClientRect()
    cy.get('.konvajs-content').click(clientRect.x + 5, clientRect.y + 5, options)
  })
}

describe('<AnnotationEditor /> - shift-click multi-select', () => {
  it('replaces the selection on a plain click (no shift)', () => {
    mountEditor(TWO_RECTANGLES)

    clickRectangle(0)
    clickRectangle(1)

    cy.window().then((win) => {
      const transformer = (win as any).Konva.stages[0].findOne('Transformer')
      expect(transformer.nodes()).to.have.length(1)
    })
  })

  it('shift-click adds a second object to the selection instead of replacing it', () => {
    mountEditor(TWO_RECTANGLES)

    clickRectangle(0)
    clickRectangle(1, { shiftKey: true })

    cy.window().then((win) => {
      const transformer = (win as any).Konva.stages[0].findOne('Transformer')
      expect(transformer.nodes()).to.have.length(2)
    })
    cy.get('[data-tip="Delete"]').should('not.be.disabled')
  })

  it('shift-click on an already-selected object removes it from the selection', () => {
    mountEditor(TWO_RECTANGLES)

    clickRectangle(0)
    clickRectangle(1, { shiftKey: true })
    clickRectangle(1, { shiftKey: true })

    cy.window().then((win) => {
      const transformer = (win as any).Konva.stages[0].findOne('Transformer')
      expect(transformer.nodes()).to.have.length(1)
    })
  })
})
