import { createTestImage, mountDesktop } from './test-helpers'
import type { AnnotationDocument } from '@/types/annotations'

// Proves EDITABLE_TOOL_ADAPTERS' generic selected-object editing (built for
// text, see text-properties.cy.ts) also works for a stroke/strokeWidth-based
// shape, not just Konva.Text's fill/fontSize. Kept deliberately lean (not a
// full parallel of every text-properties.cy.ts case) since it's the same
// code path underneath.
const RED = '#DC2626'
const BLUE = '#2563EB'

const ONE_RECTANGLE: AnnotationDocument = {
  version: 1,
  image: { width: 1280, height: 800 },
  crop: { x: 100, y: 60, width: 980, height: 640 },
  items: [
    {
      id: 'rect-1',
      type: 'rectangle',
      x: 200,
      y: 200,
      width: 300,
      height: 200,
      stroke: RED,
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

const withRectangleNode = (callback: (rect: any) => void) => {
  cy.window().then((win) => {
    const stage = (win as any).Konva?.stages?.[0]
    expect(stage).to.exist
    const rect = stage.find('Rect').filter((node: any) => node.getAttr('annotationType') === 'rectangle')[0]
    expect(rect).to.exist
    callback(rect)
  })
}

const clickRectangleNode = () => {
  withRectangleNode((rect) => {
    const clientRect = rect.getClientRect()
    cy.get('.konvajs-content').click(clientRect.x + 5, clientRect.y + 5)
  })
}

const boxDropdownTrigger = () => cy.get('[data-tip="Box"]').parent().find('[role="button"]')
const boxDropdownContent = () => cy.get('[data-tip="Box"]').parent().find('.dropdown-content')

describe('<AnnotationEditor /> - selected rectangle annotation properties', () => {
  it("reflects the selected rectangle's stroke color and width in the Box tool dropdown", () => {
    mountEditor(ONE_RECTANGLE)
    clickRectangleNode()

    boxDropdownTrigger().click()
    boxDropdownContent().contains('Line Width: 3px').should('be.visible')
    boxDropdownContent().find('button').eq(0).should('have.class', 'border-primary') // RED is swatch index 0
  })

  it('updates the selected rectangle stroke color when a swatch is picked', () => {
    mountEditor(ONE_RECTANGLE)
    clickRectangleNode()

    boxDropdownTrigger().click()
    boxDropdownContent().find('button').eq(3).click() // BLUE is swatch index 3

    withRectangleNode((rect) => {
      expect(rect.stroke()).to.equal(BLUE)
    })
  })

  it('updates the selected rectangle stroke width when the slider changes', () => {
    mountEditor(ONE_RECTANGLE)
    clickRectangleNode()

    boxDropdownTrigger().click()
    boxDropdownContent().find('input[type="range"]').invoke('val', 12).trigger('input')

    withRectangleNode((rect) => {
      expect(rect.strokeWidth()).to.equal(12)
    })
  })

  it('sticks a width change made via a selected rectangle as the next-new-rectangle default too', () => {
    mountEditor(ONE_RECTANGLE)
    clickRectangleNode()
    boxDropdownTrigger().click()
    boxDropdownContent().find('input[type="range"]').invoke('val', 12).trigger('input')

    cy.get('.konvajs-content').click(20, 20) // empty area - clears selection

    // Not the original toolSettings.rectangle default (3px) - a freshly
    // drawn rectangle auto-selects itself (endTool()), so without this a
    // "draw, tweak its width, draw another" flow silently reverted every
    // subsequent rectangle back to the hardcoded default.
    boxDropdownTrigger().click()
    boxDropdownContent().contains('Line Width: 12px').should('be.visible')
  })
})
