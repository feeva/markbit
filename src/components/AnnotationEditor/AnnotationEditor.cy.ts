import { createTestImage, mountDesktop } from './test-helpers'
import type { AnnotationDocument } from '@/types/annotations'

const EXISTING_TEXT_DOCUMENT: AnnotationDocument = {
  version: 1,
  image: { width: 1280, height: 800 },
  crop: { x: 100, y: 60, width: 980, height: 640 },
  items: [
    {
      id: 'text-1',
      type: 'text',
      x: 260,
      y: 240,
      text: 'existing note',
      color: '#1F2937',
      fontSize: 20,
      fontFamily: 'sans-serif',
    },
  ],
}

const mountEditor = (annotationData?: AnnotationDocument) => {
  mountDesktop({
    annotationData,
    imageUrl: createTestImage(),
  })

  cy.get('.konvajs-content').should(($content) => {
    expect($content[0].clientWidth).to.be.greaterThan(0)
    expect($content[0].clientHeight).to.be.greaterThan(0)
  })
}

const handleWithStage = (callback: (stage: any) => void) => {
  cy.window().then((win) => {
    const stage = (win as any).Konva?.stages?.[0]
    expect(stage).to.exist
    callback(stage)
  })
}

const handleStageTextNodes = (callback: (textNodes: any[]) => void) => {
  handleWithStage((stage) => {
    const textNodes = stage
      .find('Text')
      .filter((node: any) => node.getAttr('annotationType') === 'text')
    callback(textNodes)
  })
}

const handleClickTextNode = () => {
  handleWithStage((stage) => {
    const textNode = stage.findOne('Text')
    expect(textNode).to.exist

    const textRect = textNode.getClientRect()
    cy.get('.konvajs-content')
      .click(textRect.x + Math.max(8, textRect.width / 2), textRect.y + Math.max(8, textRect.height / 2))
  })
}

describe('<AnnotationEditor />', () => {
  it('opens a textarea when clicking the canvas with the text tool selected', () => {
    mountEditor()

    cy.get('[data-tip="Text"]').click()
    cy.get('.konvajs-content').click(240, 180)

    cy.get('textarea[placeholder="Type text and press Enter"]').should('exist').and('be.focused')
  })

  it('commits new text on Enter and keeps a single text annotation on the stage', () => {
    mountEditor()

    cy.get('[data-tip="Text"]').click()
    cy.get('.konvajs-content').click(240, 180)
    cy.get('textarea[placeholder="Type text and press Enter"]').type('hello world{enter}')

    cy.get('textarea[placeholder="Type text and press Enter"]').should('not.exist')
    handleStageTextNodes((textNodes) => {
      expect(textNodes).to.have.length(1)
      expect(textNodes[0].text()).to.equal('hello world')
    })
  })

  it('cancels a new empty text annotation on Escape', () => {
    mountEditor()

    cy.get('[data-tip="Text"]').click()
    cy.get('.konvajs-content').click(240, 180)
    cy.get('textarea[placeholder="Type text and press Enter"]').type('{esc}')

    cy.get('textarea[placeholder="Type text and press Enter"]').should('not.exist')
    handleStageTextNodes((textNodes) => {
      expect(textNodes).to.have.length(0)
    })
  })

  it('loads existing text into the editor and updates it without creating duplicates', () => {
    mountEditor(EXISTING_TEXT_DOCUMENT)

    cy.get('[data-tip="Text"]').click()
    handleClickTextNode()

    cy.get('textarea[placeholder="Type text and press Enter"]').should('have.value', 'existing note')
    cy.get('textarea[placeholder="Type text and press Enter"]').type(
      '{selectall}updated note{enter}',
    )
    cy.get('textarea[placeholder="Type text and press Enter"]').should('not.exist')

    handleStageTextNodes((textNodes) => {
      expect(textNodes).to.have.length(1)
      expect(textNodes[0].text()).to.equal('updated note')
    })
  })

  it('commits text edits when focus leaves the textarea', () => {
    mountEditor()

    cy.get('[data-tip="Text"]').click()
    cy.get('.konvajs-content').click(240, 180)
    cy.get('textarea[placeholder="Type text and press Enter"]').type('blur commit')
    cy.get('[data-tip="Select"]').click()

    cy.get('textarea[placeholder="Type text and press Enter"]').should('not.exist')
    handleStageTextNodes((textNodes) => {
      expect(textNodes).to.have.length(1)
      expect(textNodes[0].text()).to.equal('blur commit')
    })
  })

  it('does not select canvas shapes when Cmd+A is pressed while typing text', () => {
    mountEditor(EXISTING_TEXT_DOCUMENT)

    cy.get('[data-tip="Text"]').click()
    cy.get('.konvajs-content').click(500, 500) // a second, new text annotation
    cy.get('textarea[placeholder="Type text and press Enter"]').type('hello')
    cy.get('textarea[placeholder="Type text and press Enter"]').type('{cmd}a')

    // Bug symptom: the global handleSelectAll() would select every
    // annotation-shape on the layer (including the pre-existing text from
    // EXISTING_TEXT_DOCUMENT), which surfaces as the Delete button becoming
    // enabled while the textarea is still open and focused.
    cy.get('[data-tip="Delete"]').should('be.disabled')
    cy.get('textarea[placeholder="Type text and press Enter"]').should('have.focus')
  })

  it('deletes a character (not commit-and-close) when Backspace is pressed while typing', () => {
    mountEditor()

    cy.get('[data-tip="Text"]').click()
    cy.get('.konvajs-content').click(240, 180)
    cy.get('textarea[placeholder="Type text and press Enter"]').type('hello{backspace}')

    cy.get('textarea[placeholder="Type text and press Enter"]')
      .should('have.value', 'hell')
      .and('have.focus')
  })
})
