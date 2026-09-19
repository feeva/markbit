import Konva from 'konva'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { usePanZoom } from './usePanZoom'

const createStageAndContainer = (width = 800, height = 600) => {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: width, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: height, configurable: true })
  document.body.appendChild(container)

  const stage = new Konva.Stage({
    container,
    width,
    height,
  }) as unknown as Konva.Stage

  return { stage, container }
}

const createBackgroundImage = (width = 400, height = 200) => {
  const imageElement = new Image()
  return new Konva.Image({
    image: imageElement,
    width,
    height,
  })
}

const createComposable = (stage: Konva.Stage, backgroundImage: Konva.Image, container: HTMLDivElement) =>
  usePanZoom(
    ref(stage) as unknown as Ref<Konva.Stage | null>,
    ref(backgroundImage) as unknown as Ref<Konva.Image | null>,
    ref(container) as unknown as Ref<HTMLDivElement | null>,
  )

describe('usePanZoom', () => {
  it('converts screen coordinates to canvas coordinates using stage position and scale', () => {
    const { stage, container } = createStageAndContainer()
    const backgroundImage = createBackgroundImage()

    stage.position({ x: 40, y: 20 })
    stage.scale({ x: 2, y: 2 })

    const panZoom = createComposable(stage, backgroundImage, container)

    expect(panZoom.pointerToCanvas({ x: 140, y: 220 })).to.deep.equal({ x: 50, y: 100 })

    stage.destroy()
    container.remove()
  })

  it('fits image to container and centers it', () => {
    const { stage, container } = createStageAndContainer(1000, 800)
    const backgroundImage = createBackgroundImage(500, 200)

    const panZoom = createComposable(stage, backgroundImage, container)
    panZoom.fitToContainer()

    expect(stage.scaleX()).to.be.closeTo(1.8, 0.0001)
    expect(stage.scaleY()).to.be.closeTo(1.8, 0.0001)
    expect(stage.x()).to.be.closeTo(50, 0.0001)
    expect(stage.y()).to.be.closeTo(220, 0.0001)

    stage.destroy()
    container.remove()
  })

  it('constrains panning within computed bounds', () => {
    const { stage, container } = createStageAndContainer(400, 300)
    const backgroundImage = createBackgroundImage(100, 100)

    const panZoom = createComposable(stage, backgroundImage, container)
    const constrained = panZoom.constrainPan(999, -999)

    expect(constrained).to.deep.equal({ x: 399, y: -99 })

    stage.destroy()
    container.remove()
  })

  it('caps zoom-in at 300% and zoom-out at 50%', () => {
    const { stage, container } = createStageAndContainer()
    const backgroundImage = createBackgroundImage()

    const panZoom = createComposable(stage, backgroundImage, container)

    stage.scale({ x: 2.95, y: 2.95 })
    panZoom.zoomIn()
    expect(stage.scaleX()).to.equal(3)

    stage.scale({ x: 0.51, y: 0.51 })
    panZoom.zoomOut()
    expect(stage.scaleX()).to.equal(0.5)

    stage.destroy()
    container.remove()
  })

  it('handles wheel zoom direction and ctrl-key inversion', () => {
    const { stage, container } = createStageAndContainer()
    const backgroundImage = createBackgroundImage()

    const panZoom = createComposable(stage, backgroundImage, container)

    ;(stage as unknown as { getPointerPosition: () => { x: number; y: number } }).getPointerPosition =
      () => ({ x: 200, y: 150 })

    const preventDefault = cy.stub().as('preventDefault')

    stage.scale({ x: 1, y: 1 })
    panZoom.handleWheel({ evt: { deltaY: 120, ctrlKey: false, preventDefault } } as never)
    expect(stage.scaleX()).to.be.lessThan(1)

    stage.scale({ x: 1, y: 1 })
    panZoom.handleWheel({ evt: { deltaY: 120, ctrlKey: true, preventDefault } } as never)
    expect(stage.scaleX()).to.be.greaterThan(1)
    expect(preventDefault).to.have.been.calledTwice

    stage.destroy()
    container.remove()
  })
})
