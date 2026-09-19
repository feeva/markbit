import { mountDesktop } from './test-helpers'
import type { AnnotationDocument } from '@/types/annotations'

describe('<AnnotationEditor /> - Rendering', () => {
  it('renders the canvas container', () => {
    mountDesktop()
    cy.get('[data-cy="canvas"]').should('exist')
  })

  it('loads existing annotation document data', () => {
    const annotationData: AnnotationDocument = {
      version: 1,
      image: { width: 1280, height: 800 },
      crop: { x: 100, y: 60, width: 980, height: 640 },
      items: [
        {
          id: 'rect-1',
          type: 'rectangle',
          x: 180,
          y: 140,
          width: 220,
          height: 120,
          stroke: '#DC2626',
          strokeWidth: 4,
        },
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

    mountDesktop({ annotationData })

    cy.window().then((win) => {
      const stage = (win as any).Konva?.stages?.[0]
      expect(stage).to.exist

      const annotations = stage.find('.annotation-shape')
      expect(annotations).to.have.length(2)

      const textNode = stage.findOne('Text')
      expect(textNode).to.exist
      expect(textNode.text()).to.equal('existing note')

      const leftHandle = stage.findOne('.crop-window-handle-left')
      expect(leftHandle).to.exist
      const cropLeft = leftHandle.x() + leftHandle.width() / 2
      expect(cropLeft).to.equal(annotationData.crop?.x)
    })
  })
})
