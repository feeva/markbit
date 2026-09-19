import Konva from 'konva'
import { defineComponent, ref } from 'vue'
import type { Ref } from 'vue'

import { useKonvaCanvas } from './useKonvaCanvas'

declare global {
  interface Window {
    __konvaCanvasHarness?: {
      cursorMode: Ref<string | null>
      stage: Ref<Konva.Stage | null>
      layer: Ref<Konva.Layer | null>
      overlayLayer: Ref<Konva.Layer | null>
      transformer: Ref<Konva.Transformer | null>
      selectionRectangle: Ref<Konva.Rect | null>
      backgroundImage: Ref<Konva.Image | null>
    }
  }
}

// TODO: These tests are skipped because testing composables that rely on Konva
// in isolation is complex. The functionality is tested through AnnotationEditor component tests.
describe.skip('useKonvaCanvas', () => {
  const createHarness = () =>
    defineComponent({
      name: 'KonvaCanvasHarness',
      setup() {
        const canvasRef = ref<HTMLDivElement | null>(null)
        const cursorMode = ref<string | null>(null)

        const refs = useKonvaCanvas(canvasRef, '/fake-image.png', cursorMode)

        window.__konvaCanvasHarness = {
          ...refs,
          cursorMode,
        }

        return { canvasRef }
      },
      template: '<div ref="canvasRef" style="width: 640px; height: 360px;"></div>',
    })

  it('creates stage, layer, transformer, and selection rectangle on mount', () => {
    cy.stub(Konva.Image, 'fromURL').callsFake((_url, callback) => {
      const imageInstance = new Konva.Image({
        image: new Image(),
        width: 320,
        height: 180,
      })
      callback(imageInstance)
      return imageInstance
    })

    cy.mount(createHarness())

    // Wait for canvas div to exist (selector should match the template)
    cy.get('div').should('exist')

    // Wait for harness to be populated
    cy.window()
      .then({ timeout: 10000 }, (win) => {
        return new Cypress.Promise((resolve) => {
          const checkHarness = () => {
            if (
              win.__konvaCanvasHarness?.stage.value &&
              win.__konvaCanvasHarness?.backgroundImage.value
            ) {
              resolve(win.__konvaCanvasHarness)
            } else {
              setTimeout(checkHarness, 50)
            }
          }
          checkHarness()
        })
      })
      .then((harness) => {
        expect(harness.stage.value).to.exist
        expect(harness.layer.value).to.exist
        expect(harness.overlayLayer.value).to.exist
        expect(harness.transformer.value).to.exist
        expect(harness.selectionRectangle.value).to.exist
        expect(harness.backgroundImage.value).to.exist
        expect(harness.selectionRectangle.value?.visible()).to.equal(false)
      })
  })

  it('updates cursor style on background image pointer events based on cursor mode', () => {
    cy.stub(Konva.Image, 'fromURL').callsFake((_url, callback) => {
      const imageInstance = new Konva.Image({
        image: new Image(),
        width: 320,
        height: 180,
      })
      callback(imageInstance)
      return imageInstance
    })

    cy.mount(createHarness())

    cy.get('div').should('exist')

    cy.window()
      .then({ timeout: 10000 }, (win) => {
        return new Cypress.Promise((resolve) => {
          const checkHarness = () => {
            if (
              win.__konvaCanvasHarness?.stage.value &&
              win.__konvaCanvasHarness?.backgroundImage.value
            ) {
              resolve(win.__konvaCanvasHarness)
            } else {
              setTimeout(checkHarness, 50)
            }
          }
          checkHarness()
        })
      })
      .then((harness) => {
        const stage = harness.stage.value!
        const image = harness.backgroundImage.value!

        image.fire('pointerenter')
        expect(stage.container().style.cursor).to.equal('move')

        stage.container().style.cursor = 'default'
        harness.cursorMode.value = 'selecting'
        image.fire('pointerenter')
        expect(stage.container().style.cursor).to.equal('default')

        image.fire('pointerleave')
        expect(stage.container().style.cursor).to.equal('default')
      })
  })

  it('destroys the stage on component unmount', () => {
    cy.stub(Konva.Image, 'fromURL').callsFake((_url, callback) => {
      const imageInstance = new Konva.Image({
        image: new Image(),
        width: 320,
        height: 180,
      })
      callback(imageInstance)
      return imageInstance
    })

    cy.mount(createHarness()).then(({ wrapper }: { wrapper: { unmount: () => void } }) => {
      cy.get('div').should('exist')

      cy.window()
        .then({ timeout: 10000 }, (win) => {
          return new Cypress.Promise((resolve) => {
            const checkHarness = () => {
              if (
                win.__konvaCanvasHarness?.stage.value &&
                win.__konvaCanvasHarness?.backgroundImage.value
              ) {
                resolve(win.__konvaCanvasHarness)
              } else {
                setTimeout(checkHarness, 50)
              }
            }
            checkHarness()
          })
        })
        .then((harness) => {
          const destroySpy = cy.spy(harness.stage.value!, 'destroy').as('destroySpy')

          wrapper.unmount()

          expect(destroySpy).to.have.been.calledOnce
        })
    })
  })
})
