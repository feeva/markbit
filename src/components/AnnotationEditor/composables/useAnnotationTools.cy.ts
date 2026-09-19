import Konva from 'konva'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { useAnnotationTools } from './useAnnotationTools'
import type { AnnotationDocument, Tool, ToolSettings } from '@/types/annotations'

const createToolsContext = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const stage = new Konva.Stage({ container, width: 800, height: 600 })
  const layer = new Konva.Layer()
  const overlayLayer = new Konva.Layer()
  const transformer = new Konva.Transformer({ rotateEnabled: false })

  const backgroundImage = new Konva.Image({
    image: new Image(),
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  })

  stage.add(layer)
  stage.add(overlayLayer)
  layer.add(backgroundImage)
  layer.add(transformer)

  const activeTool = ref<Tool | null>(null)
  const toolSettings = ref<Record<Tool, ToolSettings>>({
    select: { lineWidth: 0, lineColor: '#000000' },
    crop: { lineWidth: 2, lineColor: '#2563EB' },
    rectangle: { lineWidth: 3, lineColor: '#EF4444' },
    text: { lineWidth: 16, lineColor: '#1F2937' },
    marker: { lineWidth: 18, lineColor: '#F59E0B' },
    pencil: { lineWidth: 2, lineColor: '#1F2937' },
    blur: { lineWidth: 20, lineColor: '#6B7280' },
  })

  const centerOnRectSpy = cy.spy().as('centerOnRect')

  const tools = useAnnotationTools({
    activeTool,
    toolSettings,
    stage: ref(stage) as unknown as Ref<Konva.Stage | null>,
    layer: ref(layer) as unknown as Ref<Konva.Layer | null>,
    overlayLayer: ref(overlayLayer) as unknown as Ref<Konva.Layer | null>,
    transformer: ref(transformer) as unknown as Ref<Konva.Transformer | null>,
    backgroundImage: ref(backgroundImage) as unknown as Ref<Konva.Image | null>,
    pointerToCanvas: (point) => point,
    centerOnRect: centerOnRectSpy,
  })

  return {
    stage,
    layer,
    overlayLayer,
    transformer,
    backgroundImage,
    activeTool,
    tools,
    centerOnRectSpy,
    cleanup: () => {
      stage.destroy()
      container.remove()
    },
  }
}

describe('useAnnotationTools', () => {
  it('creates rectangle annotations through drag lifecycle', () => {
    const ctx = createToolsContext()

    ctx.activeTool.value = 'rectangle'
    ctx.tools.startTool({ x: 40, y: 50 })
    ctx.tools.moveTool({ x: 180, y: 200 })
    ctx.tools.endTool()

    const rects = ctx.layer
      .find('Rect')
      .filter((node) => node.getAttr('annotationType') === 'rectangle')
    expect(rects).to.have.length(1)
    expect(rects[0]?.width()).to.equal(140)
    expect(rects[0]?.height()).to.equal(150)

    ctx.cleanup()
  })

  it('creates pencil and marker freehand lines', () => {
    const ctx = createToolsContext()

    ctx.activeTool.value = 'pencil'
    ctx.tools.startTool({ x: 10, y: 10 })
    ctx.tools.moveTool({ x: 30, y: 30 })
    ctx.tools.moveTool({ x: 50, y: 40 })
    ctx.tools.endTool()

    ctx.activeTool.value = 'marker'
    ctx.tools.startTool({ x: 60, y: 60 })
    ctx.tools.moveTool({ x: 100, y: 90 })
    ctx.tools.endTool()

    const lines = ctx.layer.find('Line')
    const pencil = lines.find((node) => node.getAttr('annotationType') === 'pencil')
    const marker = lines.find((node) => node.getAttr('annotationType') === 'marker')

    expect(pencil).to.exist
    expect(marker).to.exist
    expect((marker as Konva.Line).opacity()).to.equal(0.5)

    ctx.cleanup()
  })

  it('serializes annotation document and includes crop + blur entries', () => {
    const ctx = createToolsContext()

    // Initialize crop window to default (full image bounds)
    ctx.tools.loadAnnotationDocument(null)

    ctx.activeTool.value = 'blur'
    ctx.tools.setAnnotationInteractivity('blur')
    ctx.tools.startTool({ x: 100, y: 90 })
    ctx.tools.moveTool({ x: 180, y: 170 })
    ctx.tools.endTool()

    const document = ctx.tools.serializeStageToAnnotationDocument()

    // Crop should be full image bounds (relative to image at 0,0)
    expect(document.crop).to.deep.equal({ x: 0, y: 0, width: 800, height: 600 })
    expect(document.items.find((item) => item.type === 'blur')).to.exist

    const previewDataUrl = ctx.tools.generatePreviewDataUrl(document)
    expect(previewDataUrl).to.match(/^data:image\/png;base64,/)

    ctx.cleanup()
  })

  it('loads an existing annotation document for editing', () => {
    const ctx = createToolsContext()
    const annotationData: AnnotationDocument = {
      version: 1,
      image: { width: 800, height: 600 },
      crop: { x: 40, y: 30, width: 700, height: 500 },
      items: [
        {
          id: 'rect-existing',
          type: 'rectangle',
          x: 100,
          y: 120,
          width: 140,
          height: 90,
          stroke: '#DC2626',
          strokeWidth: 4,
        },
        {
          id: 'blur-existing',
          type: 'blur',
          x: 300,
          y: 200,
          width: 160,
          height: 120,
          pixelSize: 12,
        },
      ],
    }

    ctx.tools.loadAnnotationDocument(annotationData)
    const serialized = ctx.tools.serializeStageToAnnotationDocument()

    expect(serialized.crop).to.deep.equal(annotationData.crop)
    expect(serialized.items).to.have.length(2)
    expect(serialized.items.find((item) => item.id === 'rect-existing')).to.exist
    expect(serialized.items.find((item) => item.id === 'blur-existing')).to.exist

    ctx.cleanup()
  })

  it('saves and restores image placement (position, scale, rotation)', () => {
    const ctx = createToolsContext()

    // Modify image placement
    ctx.backgroundImage.position({ x: 50, y: 30 })
    ctx.backgroundImage.scale({ x: 1.5, y: 1.5 })
    ctx.backgroundImage.rotation(45)

    // Create an annotation
    ctx.activeTool.value = 'rectangle'
    ctx.tools.startTool({ x: 100, y: 100 })
    ctx.tools.moveTool({ x: 200, y: 200 })
    ctx.tools.endTool()

    // Serialize
    const document = ctx.tools.serializeStageToAnnotationDocument()

    expect(document.imagePlacement).to.deep.equal({
      x: 50,
      y: 30,
      width: 800 * 1.5, // width * scaleX
      height: 600 * 1.5, // height * scaleY
      rotation: 45,
    })

    // Reset image to different values
    ctx.backgroundImage.position({ x: 0, y: 0 })
    ctx.backgroundImage.scale({ x: 1, y: 1 })
    ctx.backgroundImage.rotation(0)

    // Restore
    ctx.tools.loadAnnotationDocument(document)

    // Verify restoration
    expect(ctx.backgroundImage.x()).to.equal(50)
    expect(ctx.backgroundImage.y()).to.equal(30)
    expect(ctx.backgroundImage.scaleX()).to.equal(1.5)
    expect(ctx.backgroundImage.scaleY()).to.equal(1.5)
    expect(ctx.backgroundImage.rotation()).to.equal(45)

    ctx.cleanup()
  })

  it('saves and restores crop window placement', () => {
    const ctx = createToolsContext()

    // Initialize crop window
    ctx.tools.loadAnnotationDocument(null)

    // Move image to a different position
    ctx.backgroundImage.position({ x: 100, y: 80 })

    const annotationData: AnnotationDocument = {
      version: 1,
      image: { width: 800, height: 600 },
      // Crop coordinates are relative to image position
      crop: { x: 50, y: 40, width: 600, height: 400 },
      items: [],
    }

    // Load with crop
    ctx.tools.loadAnnotationDocument(annotationData)

    // Serialize and verify crop is saved correctly (relative to image)
    const serialized = ctx.tools.serializeStageToAnnotationDocument()

    expect(serialized.crop).to.deep.equal({ x: 50, y: 40, width: 600, height: 400 })

    ctx.cleanup()
  })

  it('calls centerOnRect with crop window when loading document', () => {
    const ctx = createToolsContext()

    const annotationData: AnnotationDocument = {
      version: 1,
      image: { width: 800, height: 600 },
      crop: { x: 100, y: 80, width: 500, height: 400 },
      items: [],
    }

    // Load document (image is at 0,0)
    ctx.tools.loadAnnotationDocument(annotationData)

    // Verify centerOnRect was called with absolute crop coordinates
    expect(ctx.centerOnRectSpy).to.have.been.calledOnce
    expect(ctx.centerOnRectSpy).to.have.been.calledWith({
      x: 100, // crop.x + image.x (100 + 0)
      y: 80, // crop.y + image.y (80 + 0)
      width: 500,
      height: 400,
    })

    ctx.cleanup()
  })

  it('saves and restores annotation rotations', () => {
    const ctx = createToolsContext()

    // Create a rectangle
    ctx.activeTool.value = 'rectangle'
    ctx.tools.startTool({ x: 100, y: 100 })
    ctx.tools.moveTool({ x: 200, y: 200 })
    ctx.tools.endTool()

    // Get the created rectangle and rotate it
    const rect = ctx.layer
      .find('Rect')
      .find((node) => node.getAttr('annotationType') === 'rectangle') as Konva.Rect
    rect.rotation(30)

    // Serialize
    const document = ctx.tools.serializeStageToAnnotationDocument()
    const rectItem = document.items.find((item) => item.type === 'rectangle')

    expect(rectItem).to.exist
    expect(rectItem?.rotation).to.equal(30)

    // Clear and reload
    ctx.layer.find('.annotation-shape').forEach((node) => node.destroy())
    ctx.tools.loadAnnotationDocument(document)

    // Verify rotation was restored
    const restoredRect = ctx.layer
      .find('Rect')
      .find((node) => node.getAttr('annotationType') === 'rectangle') as Konva.Rect

    expect(restoredRect).to.exist
    expect(restoredRect.rotation()).to.equal(30)

    ctx.cleanup()
  })

  it('clears transformer selection before generating preview', () => {
    const ctx = createToolsContext()

    // Initialize and create annotation
    ctx.tools.loadAnnotationDocument(null)
    ctx.activeTool.value = 'rectangle'
    ctx.tools.startTool({ x: 100, y: 100 })
    ctx.tools.moveTool({ x: 200, y: 200 })
    ctx.tools.endTool()

    // Select the annotation (transformer should have nodes)
    const rect = ctx.layer
      .find('Rect')
      .find((node) => node.getAttr('annotationType') === 'rectangle') as Konva.Rect
    ctx.transformer.nodes([rect])
    expect(ctx.transformer.nodes()).to.have.length(1)

    // Generate preview
    const document = ctx.tools.serializeStageToAnnotationDocument()
    const preview = ctx.tools.generatePreviewDataUrl(document)

    // Verify transformer was cleared
    expect(ctx.transformer.nodes()).to.have.length(0)
    expect(preview).to.match(/^data:image\/png;base64,/)

    ctx.cleanup()
  })

  it('centers crop window when loading document without annotations', () => {
    const ctx = createToolsContext()

    const annotationData: AnnotationDocument = {
      version: 1,
      image: { width: 800, height: 600 },
      crop: { x: 50, y: 40, width: 700, height: 500 },
      items: [], // No annotations
    }

    ctx.tools.loadAnnotationDocument(annotationData)

    // centerOnRect should still be called even without annotations
    expect(ctx.centerOnRectSpy).to.have.been.calledOnce
    expect(ctx.centerOnRectSpy).to.have.been.calledWith({
      x: 50,
      y: 40,
      width: 700,
      height: 500,
    })

    ctx.cleanup()
  })
})
