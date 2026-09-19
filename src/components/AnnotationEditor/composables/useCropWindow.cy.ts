import Konva from 'konva'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { useCropWindow } from './useCropWindow'

type HandleDirection =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'topLeft'
  | 'topRight'
  | 'bottomRight'
  | 'bottomLeft'

const createCropWindowContext = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const stage = new Konva.Stage({ container, width: 800, height: 600 })
  const contentLayer = new Konva.Layer()
  const overlayLayer = new Konva.Layer()

  const backgroundImage = new Konva.Image({
    image: new Image(),
    x: 0,
    y: 0,
    width: 500,
    height: 300,
  })

  stage.add(contentLayer)
  stage.add(overlayLayer)
  contentLayer.add(backgroundImage)

  const cropWindow = useCropWindow({
    overlayLayer: ref(overlayLayer) as unknown as Ref<Konva.Layer | null>,
    backgroundImage: ref(backgroundImage) as unknown as Ref<Konva.Image | null>,
    stage: ref(stage) as unknown as Ref<Konva.Stage | null>,
  })

  cropWindow.initializeCropWindow()

  const getHandle = (direction: HandleDirection) =>
    overlayLayer.findOne(`.crop-window-handle-${direction}`) as Konva.Rect

  const getBorder = () => overlayLayer.findOne('.crop-window-border') as Konva.Rect

  const resizeHandle = (direction: HandleDirection, center: { x: number; y: number }) => {
    const handle = getHandle(direction)
    handle.x(center.x - handle.width() / 2)
    handle.y(center.y - handle.height() / 2)
    handle.fire('dragmove')
  }

  return {
    stage,
    contentLayer,
    overlayLayer,
    cropWindow,
    getHandle,
    getBorder,
    resizeHandle,
    cleanup: () => {
      stage.destroy()
      container.remove()
    },
  }
}

describe('useCropWindow', () => {
  it('initializes a full-image crop window and serializes as null', () => {
    const ctx = createCropWindowContext()
    const border = ctx.getBorder()

    expect(border.x()).to.equal(0)
    expect(border.y()).to.equal(0)
    expect(border.width()).to.equal(500)
    expect(border.height()).to.equal(300)
    expect(border.strokeEnabled()).to.equal(false)
    expect(ctx.cropWindow.getCropRect()).to.equal(null)

    ctx.cleanup()
  })

  it('resizes from left edge and serializes the cropped intersection', () => {
    const ctx = createCropWindowContext()
    ctx.cropWindow.setCropEditable(true)

    ctx.resizeHandle('left', { x: 120, y: 150 })

    const border = ctx.getBorder()
    expect(border.x()).to.equal(120)
    expect(border.width()).to.equal(380)
    expect(ctx.cropWindow.getCropRect()).to.deep.equal({ x: 120, y: 0, width: 380, height: 300 })

    ctx.cleanup()
  })

  it('allows window expansion outside image while saving only the image intersection', () => {
    const ctx = createCropWindowContext()
    ctx.cropWindow.setCropEditable(true)

    ctx.resizeHandle('right', { x: 260, y: 150 })
    ctx.resizeHandle('top', { x: 130, y: -50 })

    const border = ctx.getBorder()
    expect(border.y()).to.equal(-50)
    expect(border.width()).to.equal(260)
    expect(ctx.cropWindow.getCropRect()).to.deep.equal({ x: 0, y: 0, width: 260, height: 300 })

    ctx.cleanup()
  })

  it('enforces minimum crop size when handles are dragged too far', () => {
    const ctx = createCropWindowContext()
    ctx.cropWindow.setCropEditable(true)

    ctx.resizeHandle('left', { x: 498, y: 150 })

    const border = ctx.getBorder()
    expect(border.x()).to.equal(476)
    expect(border.width()).to.equal(24)
    expect(ctx.cropWindow.getCropRect()).to.deep.equal({ x: 476, y: 0, width: 24, height: 300 })

    ctx.cleanup()
  })

  it('supports diagonal resizing through corner handles', () => {
    const ctx = createCropWindowContext()
    ctx.cropWindow.setCropEditable(true)

    ctx.resizeHandle('topRight', { x: 420, y: -40 })

    const border = ctx.getBorder()
    expect(border.width()).to.equal(420)
    expect(border.y()).to.equal(-40)
    expect(ctx.cropWindow.getCropRect()).to.deep.equal({ x: 0, y: 0, width: 420, height: 300 })

    ctx.cleanup()
  })
})
