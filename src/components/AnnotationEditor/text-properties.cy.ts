import { createTestImage, mountDesktop } from './test-helpers'
import type { AnnotationDocument } from '@/types/annotations'

// Matches AnnotationToolbar.vue's `colors` swatch list, so swatch-highlight
// assertions below line up with real button indices.
const RED = '#DC2626'
const BLUE = '#2563EB'
const TEAL = '#0F766E'

const textDocument = (items: AnnotationDocument['items']): AnnotationDocument => ({
  version: 1,
  image: { width: 1280, height: 800 },
  crop: { x: 100, y: 60, width: 980, height: 640 },
  items,
})

const ONE_TEXT = textDocument([
  {
    id: 'text-1',
    type: 'text',
    x: 260,
    y: 240,
    text: 'note',
    color: RED,
    fontSize: 20,
    fontFamily: 'sans-serif',
  },
])

const TWO_TEXT_DIFFERENT_COLORS = textDocument([
  {
    id: 'text-1',
    type: 'text',
    x: 200,
    y: 200,
    text: 'a',
    color: RED,
    fontSize: 20,
    fontFamily: 'sans-serif',
  },
  {
    id: 'text-2',
    type: 'text',
    x: 500,
    y: 400,
    text: 'b',
    color: BLUE,
    fontSize: 32,
    fontFamily: 'sans-serif',
  },
])

const mountEditor = (annotationData: AnnotationDocument) => {
  mountDesktop({ annotationData, imageUrl: createTestImage() })
  cy.get('.konvajs-content').should(($content) => {
    expect($content[0].clientWidth).to.be.greaterThan(0)
  })
}

const withStage = (callback: (stage: any) => void) => {
  cy.window().then((win) => {
    const stage = (win as any).Konva?.stages?.[0]
    expect(stage).to.exist
    callback(stage)
  })
}

const withTextNodes = (callback: (textNodes: any[]) => void) => {
  withStage((stage) => {
    const textNodes = stage.find('Text').filter((node: any) => node.getAttr('annotationType') === 'text')
    callback(textNodes)
  })
}

const clickTextNode = (index = 0) => {
  withTextNodes((textNodes) => {
    const textNode = textNodes[index]
    expect(textNode).to.exist
    const rect = textNode.getClientRect()
    cy.get('.konvajs-content').click(
      rect.x + Math.max(8, rect.width / 2),
      rect.y + Math.max(8, rect.height / 2),
    )
  })
}

// The Text tool button and its settings dropdown share a `.join` wrapper;
// scoping through it (instead of a bare `[role="button"]`) avoids matching
// the other four tools' dropdown triggers, which render at the same time.
const textDropdownTrigger = () => cy.get('[data-tip="Text"]').parent().find('[role="button"]')
const textDropdownContent = () => cy.get('[data-tip="Text"]').parent().find('.dropdown-content')

describe('<AnnotationEditor /> - selected text annotation properties', () => {
  it('reflects the selected text annotation color and font size in the Text tool dropdown', () => {
    mountEditor(ONE_TEXT)
    clickTextNode()

    textDropdownTrigger().click()
    textDropdownContent().contains('Font Size: 20px').should('be.visible')
    textDropdownContent().find('button').eq(0).should('have.class', 'border-primary') // RED is swatch index 0
  })

  it('updates the selected text node color when a swatch is picked', () => {
    mountEditor(ONE_TEXT)
    clickTextNode()

    textDropdownTrigger().click()
    textDropdownContent().find('button').eq(3).click() // BLUE is swatch index 3

    withTextNodes((textNodes) => {
      expect(textNodes[0].fill()).to.equal(BLUE)
    })
  })

  it('updates the selected text node font size when the slider changes', () => {
    mountEditor(ONE_TEXT)
    clickTextNode()

    textDropdownTrigger().click()
    textDropdownContent().find('input[type="range"]').invoke('val', 40).trigger('input')

    withTextNodes((textNodes) => {
      expect(textNodes[0].fontSize()).to.equal(40)
    })
  })

  it('shows no highlighted swatch when selected text annotations have different colors', () => {
    mountEditor(TWO_TEXT_DIFFERENT_COLORS)
    cy.get('body').type('{ctrl}a')

    textDropdownTrigger().click()
    textDropdownContent()
      .find('button')
      .each(($button) => {
        cy.wrap($button).should('not.have.class', 'border-primary')
      })
  })

  it('applies a newly picked color to every selected text annotation, overwriting their previous colors', () => {
    mountEditor(TWO_TEXT_DIFFERENT_COLORS)
    cy.get('body').type('{ctrl}a')

    textDropdownTrigger().click()
    textDropdownContent().find('button').eq(4).click() // TEAL is swatch index 4

    withTextNodes((textNodes) => {
      textNodes.forEach((node) => expect(node.fill()).to.equal(TEAL))
    })
  })

  it('sticks a size change made via a selected node as the next-new-text default too', () => {
    mountEditor(ONE_TEXT)
    clickTextNode()
    textDropdownTrigger().click()
    textDropdownContent().find('input[type="range"]').invoke('val', 40).trigger('input')

    cy.get('.konvajs-content').click(20, 20) // empty area - clears selection

    // Not the original toolSettings.text default (18px) - changing a
    // selected node's size also updates what the next brand-new text uses,
    // so a "draw, tweak, keep drawing with the same style" flow works.
    textDropdownTrigger().click()
    textDropdownContent().contains('Font Size: 40px').should('be.visible')
  })

  it('gives the in-progress text textarea a light, semi-transparent background, not solid white', () => {
    mountEditor(textDocument([]))

    cy.get('[data-tip="Text"]').click()
    cy.get('.konvajs-content').click(240, 180)

    cy.get('textarea[placeholder="Type text and press Enter"]').should(
      'have.css',
      'background-color',
      'rgba(255, 255, 255, 0.5)',
    )
  })
})
