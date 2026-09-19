import Konva from 'konva'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { useSelection } from './useSelection'

const createSelectionContext = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const stage = new Konva.Stage({ container, width: 800, height: 600 }) as unknown as Konva.Stage
  const layer = new Konva.Layer()
  const transformer = new Konva.Transformer()
  const selectionRectangle = new Konva.Rect({ visible: false })

  const backgroundImage = new Konva.Image({
    image: new Image(),
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  })

  const shapeA = new Konva.Rect({
    x: 30,
    y: 30,
    width: 60,
    height: 60,
    fill: 'red',
    name: 'annotation-shape',
  })
  const shapeB = new Konva.Rect({
    x: 300,
    y: 300,
    width: 60,
    height: 60,
    fill: 'blue',
    name: 'annotation-shape',
  })

  stage.add(layer)
  layer.add(backgroundImage)
  layer.add(shapeA)
  layer.add(shapeB)
  layer.add(transformer)
  layer.add(selectionRectangle)

  const selection = useSelection(
    ref(stage) as unknown as Ref<Konva.Stage | null>,
    ref(transformer) as unknown as Ref<Konva.Transformer | null>,
    ref(selectionRectangle) as unknown as Ref<Konva.Rect | null>,
    ref(backgroundImage) as unknown as Ref<Konva.Image | null>,
  )

  return {
    stage,
    layer,
    transformer,
    selectionRectangle,
    backgroundImage,
    shapeA,
    shapeB,
    selection,
    cleanup: () => {
      stage.destroy()
      container.remove()
    },
  }
}

describe('useSelection', () => {
  it('excludes background image from selectedNodes', () => {
    const ctx = createSelectionContext()

    ctx.transformer.nodes([ctx.backgroundImage, ctx.shapeA])

    expect(ctx.selection.selectedNodes.value).to.deep.equal([ctx.shapeA])

    ctx.cleanup()
  })

  it('starts selection by clearing nodes and showing selection rectangle', () => {
    const ctx = createSelectionContext()

    ctx.transformer.nodes([ctx.shapeA])
    ctx.selection.startSelection({ x: 10, y: 20 })

    expect(ctx.transformer.nodes()).to.have.length(0)
    expect(ctx.selectionRectangle.visible()).to.equal(true)
    expect(ctx.selectionRectangle.x()).to.equal(10)
    expect(ctx.selectionRectangle.y()).to.equal(20)
    expect(ctx.selectionRectangle.width()).to.equal(0)
    expect(ctx.selectionRectangle.height()).to.equal(0)

    ctx.cleanup()
  })

  it('updates selection box and selects intersecting shapes', () => {
    const ctx = createSelectionContext()

    ctx.selection.startSelection({ x: 0, y: 0 })
    ctx.selection.updateSelection({ x: 120, y: 120 })

    expect(ctx.selectionRectangle.width()).to.equal(120)
    expect(ctx.selectionRectangle.height()).to.equal(120)
    expect(ctx.selection.selectedNodes.value).to.deep.equal([ctx.shapeA])

    ctx.cleanup()
  })

  it('selects and deselects a single object', () => {
    const ctx = createSelectionContext()

    ctx.selection.selectObject(ctx.shapeB)
    expect(ctx.transformer.nodes()).to.deep.equal([ctx.shapeB])

    ctx.selection.deselectAll()
    expect(ctx.transformer.nodes()).to.have.length(0)

    ctx.cleanup()
  })

  it('deletes selected shapes but preserves background image', () => {
    const ctx = createSelectionContext()

    const drawSpy = cy.spy(ctx.stage, 'draw').as('drawSpy')

    ctx.transformer.nodes([ctx.backgroundImage, ctx.shapeA, ctx.shapeB])
    ctx.selection.deleteSelected()

    expect(ctx.shapeA.getStage()).to.equal(null)
    expect(ctx.shapeB.getStage()).to.equal(null)
    expect(ctx.backgroundImage.getStage()).to.equal(ctx.stage)
    expect(ctx.transformer.nodes()).to.have.length(0)
    expect(drawSpy).to.have.been.calledOnce

    ctx.cleanup()
  })

  it('ends selection, hides rectangle, and sets cursor when object is under pointer', () => {
    const ctx = createSelectionContext()

    ctx.selectionRectangle.visible(true)
    ;(
      ctx.stage as unknown as { getPointerPosition: () => { x: number; y: number } }
    ).getPointerPosition = () => ({ x: 40, y: 40 })
    ;(
      ctx.stage as unknown as {
        getIntersection: () => Konva.Node | null
      }
    ).getIntersection = () => ctx.shapeA

    ctx.selection.endSelection()
    expect(ctx.stage.container().style.cursor).to.equal('default')

    cy.wait(10).then(() => {
      expect(ctx.selectionRectangle.visible()).to.equal(false)
      ctx.cleanup()
    })
  })

  it('sets default cursor when nothing is under pointer at selection end', () => {
    const ctx = createSelectionContext()

    ;(
      ctx.stage as unknown as { getPointerPosition: () => { x: number; y: number } }
    ).getPointerPosition = () => ({ x: 10, y: 10 })
    ;(ctx.stage as unknown as { getIntersection: () => Konva.Node | null }).getIntersection = () =>
      null

    ctx.selection.endSelection()

    expect(ctx.stage.container().style.cursor).to.equal('default')

    ctx.cleanup()
  })
})
