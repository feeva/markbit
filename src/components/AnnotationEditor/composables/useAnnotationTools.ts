import Konva from 'konva'
import { ref, watch, type Ref } from 'vue'

import { useCropWindow } from './useCropWindow'
import type {
  AnnotationDocument,
  AnnotationItem,
  BlurAnnotation,
  CropRect,
  MarkerAnnotation,
  PencilAnnotation,
  RectangleAnnotation,
  TextAnnotation,
  Tool,
  ToolSettings,
} from '@/types/annotations'

interface UseAnnotationToolsOptions {
  activeTool: Ref<Tool | null>
  toolSettings: Ref<Record<Tool, ToolSettings>>
  stage: Ref<Konva.Stage | null>
  layer: Ref<Konva.Layer | null>
  overlayLayer: Ref<Konva.Layer | null>
  transformer: Ref<Konva.Transformer | null>
  backgroundImage: Ref<Konva.Image | null>
  pointerToCanvas: (pointerPos: { x: number; y: number }) => { x: number; y: number }
  centerOnRect: (rect: { x: number; y: number; width: number; height: number }) => void
  onTextEditRequested?: (node: Konva.Text, options?: { isNew: boolean }) => void
}

const MIN_SIZE = 4
const MIN_TEXT_WIDTH = 40
const MIN_LINE_HIT_STROKE_WIDTH = 20
const BLUR_BACKGROUND_FILL = 'rgba(172, 172, 172, 0.15)'

const isDrawingTool = (tool: Tool | null): tool is Exclude<Tool, 'select' | 'crop'> => {
  return !!tool && tool !== 'select' && tool !== 'crop'
}

const normalizeRect = (node: Konva.Shape) => {
  const width = (node.width?.() || 0) * (node.scaleX?.() || 1)
  const height = (node.height?.() || 0) * (node.scaleY?.() || 1)

  if (node.scaleX) {
    node.scaleX(1)
  }
  if (node.scaleY) {
    node.scaleY(1)
  }

  if (node.width) {
    node.width(Math.abs(width))
  }
  if (node.height) {
    node.height(Math.abs(height))
  }

  if (width < 0 && node.x) {
    node.x(node.x() + width)
  }

  if (height < 0 && node.y) {
    node.y(node.y() + height)
  }
}

const normalizeRectAfterTransform = (node: Konva.Rect) => {
  const width = node.width() * node.scaleX()
  const height = node.height() * node.scaleY()
  node.scale({ x: 1, y: 1 })
  node.width(Math.max(1, width))
  node.height(Math.max(1, height))
}

const normalizeLineAfterTransform = (node: Konva.Line) => {
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  const points = node.points()
  const normalizedPoints = points.map((value, index) => {
    return value * (index % 2 === 0 ? scaleX : scaleY)
  })

  node.points(normalizedPoints)
  node.scale({ x: 1, y: 1 })
}

const normalizeTextAfterTransform = (node: Konva.Text) => {
  const nextWidth = node.width() * node.scaleX()

  if (nextWidth < 0) {
    node.x(node.x() + nextWidth)
  }

  node.width(Math.max(MIN_TEXT_WIDTH, Math.abs(nextWidth)))
  node.scale({ x: 1, y: 1 })
}

const normalizeBlurAfterTransform = (
  node: Konva.Group,
  backgroundImage: Ref<Konva.Image | null>,
) => {
  if (!backgroundImage.value) return

  const newWidth = node.width() * node.scaleX()
  const newHeight = node.height() * node.scaleY()
  const srcX = node.x() - backgroundImage.value.x()
  const srcY = node.y() - backgroundImage.value.y()

  const blurredImage = node.getAttr('blurredImage') as Konva.Image
  if (blurredImage) {
    blurredImage.crop({ x: srcX, y: srcY, width: newWidth, height: newHeight })
    blurredImage.size({ width: newWidth, height: newHeight })
    blurredImage.cache()
  }

  const background = node.getAttr('background') as Konva.Rect
  if (background) background.size({ width: newWidth, height: newHeight })

  node.size({ width: newWidth, height: newHeight })
  node.scale({ x: 1, y: 1 })
}

const bindTransformNormalization = (
  node: Konva.Shape | Konva.Text | Konva.Line | Konva.Image | Konva.Group,
  normalizer: (node: any) => void,
  onDraw: () => void,
) => {
  let isNormalizing = false

  const handleNormalize = () => {
    if (isNormalizing) return
    isNormalizing = true
    normalizer(node)
    onDraw()
    isNormalizing = false
  }

  node.on('transform', handleNormalize)
  node.on('transformend', handleNormalize)

  // For blur nodes, also handle dragging
  if (node instanceof Konva.Group && node.getAttr('annotationType') === 'blur') {
    node.on('dragmove', handleNormalize)
    node.on('dragend', handleNormalize)
  }
}

const normalizeAnnotationItemRect = (item: {
  x: number
  y: number
  width: number
  height: number
}) => {
  const width = Math.abs(item.width)
  const height = Math.abs(item.height)
  const x = item.width < 0 ? item.x + item.width : item.x
  const y = item.height < 0 ? item.y + item.height : item.y

  return { x, y, width, height }
}

export function useAnnotationTools({
  activeTool,
  toolSettings,
  stage,
  layer,
  overlayLayer,
  transformer,
  backgroundImage,
  pointerToCanvas,
  centerOnRect,
  onTextEditRequested,
}: UseAnnotationToolsOptions) {
  const currentNode = ref<Konva.Rect | Konva.Line | Konva.Group | null>(null)
  const drawStart = ref<{ x: number; y: number } | null>(null)
  const isDrawing = ref(false)

  const cropWindow = useCropWindow({ overlayLayer, backgroundImage, stage })

  const createAnnotationId = (type: string) => {
    return `${type}-${Date.now()}-${Math.round(Math.random() * 99999)}`
  }

  const createBlurredRegion = (
    x: number,
    y: number,
    width: number,
    height: number,
    blurRadius: number,
  ) => {
    if (!backgroundImage.value) return null

    const bgImage = backgroundImage.value.image() as HTMLImageElement | HTMLCanvasElement
    if (!bgImage) return null

    const srcX = x - backgroundImage.value.x()
    const srcY = y - backgroundImage.value.y()

    const blurGroup = new Konva.Group({ x, y, width, height, draggable: false })

    const background = new Konva.Rect({
      width,
      height,
      fill: BLUR_BACKGROUND_FILL,
      listening: false,
    })

    const blurredImage = new Konva.Image({
      image: bgImage,
      crop: { x: srcX, y: srcY, width, height },
      width,
      height,
    })
    blurredImage.filters([Konva.Filters.Blur])
    blurredImage.blurRadius(blurRadius)
    blurredImage.cache()

    blurGroup.add(blurredImage)
    blurGroup.add(background)
    blurGroup.setAttr('background', background)
    blurGroup.setAttr('blurredImage', blurredImage)

    return blurGroup
  }

  const setAnnotationAttrs = (node: Konva.Node, type: Exclude<Tool, 'select'>) => {
    node.setAttr('annotationType', type)
    node.setAttr('annotationId', createAnnotationId(type))
  }

  const setAnnotationAttrsFromItem = (
    node: Konva.Node,
    type: Exclude<Tool, 'select'>,
    annotationId?: string,
  ) => {
    node.setAttr('annotationType', type)
    node.setAttr('annotationId', annotationId || createAnnotationId(type))
  }

  const setAnnotationInteractivity = (tool: Tool | null) => {
    const selectMode = !tool || tool === 'select'

    layer.value?.find('.annotation-shape').forEach((node) => {
      node.draggable(selectMode)

      if (node instanceof Konva.Shape) {
        node.strokeScaleEnabled(true)
      }
    })

    backgroundImage.value?.draggable(selectMode)
    cropWindow.setCropEditable(tool === 'crop')

    if (!selectMode && tool !== 'crop') {
      transformer.value?.nodes([])
    }

    layer.value?.batchDraw()
    overlayLayer.value?.batchDraw()
  }

  const startTool = (pointerPos: { x: number; y: number }) => {
    if (!layer.value || !isDrawingTool(activeTool.value)) return

    const canvasPos = pointerToCanvas(pointerPos)
    const settings = toolSettings.value[activeTool.value]

    if (activeTool.value === 'text') {
      const textNode = new Konva.Text({
        x: canvasPos.x,
        y: canvasPos.y,
        text: '',
        width: 240,
        padding: 8,
        fontSize: settings.lineWidth,
        fill: settings.lineColor,
        fontFamily: 'sans-serif',
        draggable: false,
      })

      textNode.name('annotation-shape')
      setAnnotationAttrs(textNode, 'text')
      textNode.on('dblclick dbltap', () => onTextEditRequested?.(textNode, { isNew: false }))
      bindTransformNormalization(textNode, normalizeTextAfterTransform, () =>
        layer.value?.batchDraw(),
      )

      layer.value.add(textNode)
      layer.value.batchDraw()
      transformer.value?.nodes([textNode])
      onTextEditRequested?.(textNode, { isNew: true })
      return
    }

    if (activeTool.value === 'rectangle') {
      const rect = new Konva.Rect({
        x: canvasPos.x,
        y: canvasPos.y,
        width: 0,
        height: 0,
        stroke: settings.lineColor,
        strokeWidth: Math.max(1, settings.lineWidth),
        strokeScaleEnabled: true,
        fill: 'transparent',
        draggable: false,
      })
      rect.name('annotation-shape')
      setAnnotationAttrs(rect, 'rectangle')
      bindTransformNormalization(rect, normalizeRectAfterTransform, () => layer.value?.batchDraw())

      currentNode.value = rect
      drawStart.value = canvasPos
      isDrawing.value = true
      layer.value.add(rect)
      return
    }

    if (activeTool.value === 'blur') {
      const blurRect = new Konva.Rect({
        x: canvasPos.x,
        y: canvasPos.y,
        width: 0,
        height: 0,
        fill: BLUR_BACKGROUND_FILL,
        strokeEnabled: false,
        draggable: false,
      })
      blurRect.name('annotation-shape')
      setAnnotationAttrs(blurRect, 'blur')
      blurRect.setAttr('pixelSize', settings.lineWidth)

      currentNode.value = blurRect
      drawStart.value = canvasPos
      isDrawing.value = true
      layer.value.add(blurRect)
      return
    }

    if (activeTool.value === 'marker' || activeTool.value === 'pencil') {
      drawStart.value = canvasPos
      isDrawing.value = true
      return
    }
  }

  const moveTool = (pointerPos: { x: number; y: number }) => {
    if (!isDrawing.value || !isDrawingTool(activeTool.value)) return

    const canvasPos = pointerToCanvas(pointerPos)

    if (!drawStart.value || !layer.value) return

    if (currentNode.value instanceof Konva.Rect) {
      currentNode.value.width(canvasPos.x - drawStart.value.x)
      currentNode.value.height(canvasPos.y - drawStart.value.y)
      layer.value.batchDraw()
      return
    }

    if (currentNode.value instanceof Konva.Line) {
      const points = currentNode.value.points().concat([canvasPos.x, canvasPos.y])
      currentNode.value.points(points)
      layer.value.batchDraw()
      return
    }

    if (
      (activeTool.value === 'marker' || activeTool.value === 'pencil') &&
      !currentNode.value &&
      (drawStart.value.x !== canvasPos.x || drawStart.value.y !== canvasPos.y)
    ) {
      const settings = toolSettings.value[activeTool.value]
      const line = new Konva.Line({
        points: [drawStart.value.x, drawStart.value.y, canvasPos.x, canvasPos.y],
        stroke: settings.lineColor,
        strokeWidth: settings.lineWidth,
        hitStrokeWidth: Math.max(settings.lineWidth, MIN_LINE_HIT_STROKE_WIDTH),
        strokeScaleEnabled: true,
        lineCap: 'round',
        lineJoin: 'round',
        tension: 0,
        draggable: false,
        opacity: activeTool.value === 'marker' ? 0.5 : 1,
      })
      line.name('annotation-shape')
      setAnnotationAttrs(line, activeTool.value)
      bindTransformNormalization(line, normalizeLineAfterTransform, () => layer.value?.batchDraw())

      currentNode.value = line
      layer.value.add(line)
      layer.value.batchDraw()
    }
  }

  const endTool = () => {
    if (!isDrawingTool(activeTool.value)) return

    if (currentNode.value instanceof Konva.Rect) {
      normalizeRect(currentNode.value)

      if (currentNode.value.width() < MIN_SIZE || currentNode.value.height() < MIN_SIZE) {
        currentNode.value.destroy()
        currentNode.value = null
        drawStart.value = null
        isDrawing.value = false
        layer.value?.batchDraw()
        return
      }

      // Convert blur rectangle preview to actual blurred image
      if (currentNode.value.getAttr('annotationType') === 'blur') {
        const pixelSize = currentNode.value.getAttr('pixelSize') || 20
        const blurredRegion = createBlurredRegion(
          currentNode.value.x(),
          currentNode.value.y(),
          currentNode.value.width(),
          currentNode.value.height(),
          pixelSize,
        )

        if (blurredRegion) {
          // Copy annotation attributes
          blurredRegion.name('annotation-shape')
          blurredRegion.setAttr('annotationType', 'blur')
          blurredRegion.setAttr('annotationId', currentNode.value.getAttr('annotationId'))
          blurredRegion.setAttr('pixelSize', pixelSize)

          // Bind transform normalization
          bindTransformNormalization(
            blurredRegion,
            (node) => normalizeBlurAfterTransform(node, backgroundImage),
            () => layer.value?.batchDraw(),
          )

          // Add and position the blur region just above the background image
          layer.value?.add(blurredRegion)
          if (backgroundImage.value) {
            blurredRegion.moveToTop()
            blurredRegion.moveDown()
            // Move it to be just above the background image
            const bgIndex = backgroundImage.value.index
            if (bgIndex !== undefined) {
              blurredRegion.zIndex(bgIndex + 1)
            }
          }
          currentNode.value.destroy()
          currentNode.value = blurredRegion
        }
      }
    }

    if (currentNode.value instanceof Konva.Line) {
      const points = currentNode.value.points()
      if (points.length < 4) {
        currentNode.value.destroy()
        currentNode.value = null
      }
    }

    if (currentNode.value && transformer.value) {
      transformer.value.nodes([currentNode.value as unknown as Konva.Node])
    }

    currentNode.value = null
    drawStart.value = null
    isDrawing.value = false
    layer.value?.batchDraw()
  }

  const cancelTool = () => {
    if (currentNode.value) {
      currentNode.value.destroy()
      currentNode.value = null
    }

    drawStart.value = null
    isDrawing.value = false
    layer.value?.batchDraw()
  }

  const serializeStageToAnnotationDocument = (): AnnotationDocument => {
    const imageWidth = backgroundImage.value?.width() || 0
    const imageHeight = backgroundImage.value?.height() || 0

    // Capture image placement (position, displayed size, rotation)
    const imagePlacement = backgroundImage.value
      ? {
          x: backgroundImage.value.x(),
          y: backgroundImage.value.y(),
          width: backgroundImage.value.width() * backgroundImage.value.scaleX(),
          height: backgroundImage.value.height() * backgroundImage.value.scaleY(),
          rotation: backgroundImage.value.rotation(),
        }
      : undefined

    if (!layer.value) {
      return {
        version: 1,
        image: { width: imageWidth, height: imageHeight },
        crop: cropWindow.getCropRect(),
        imagePlacement,
        items: [],
      }
    }

    const items: AnnotationItem[] = []

    layer.value.find('.annotation-shape').forEach((node) => {
      const annotationType = node.getAttr('annotationType') as Tool | undefined
      const annotationId =
        (node.getAttr('annotationId') as string | undefined) || createAnnotationId('annotation')

      if (!annotationType || annotationType === 'crop' || annotationType === 'select') {
        return
      }

      if (annotationType === 'rectangle' && node instanceof Konva.Rect) {
        const strokeColor = node.stroke()
        items.push({
          id: annotationId,
          type: 'rectangle',
          x: node.x(),
          y: node.y(),
          width: node.width() * node.scaleX(),
          height: node.height() * node.scaleY(),
          stroke: typeof strokeColor === 'string' ? strokeColor : '#DC2626',
          strokeWidth: node.strokeWidth(),
          rotation: node.rotation(),
        } satisfies RectangleAnnotation)
        return
      }

      if (annotationType === 'text' && node instanceof Konva.Text) {
        const fillColor = node.fill()
        items.push({
          id: annotationId,
          type: 'text',
          x: node.x(),
          y: node.y(),
          text: node.text(),
          color: typeof fillColor === 'string' ? fillColor : '#1F2937',
          fontSize: node.fontSize(),
          fontFamily: node.fontFamily() || 'sans-serif',
          rotation: node.rotation(),
        } satisfies TextAnnotation)
        return
      }

      if (annotationType === 'marker' && node instanceof Konva.Line) {
        const markerColor = node.stroke()
        items.push({
          id: annotationId,
          type: 'marker',
          points: node.points(),
          color: typeof markerColor === 'string' ? markerColor : 'yellow',
          width: node.strokeWidth(),
          opacity: node.opacity(),
          rotation: node.rotation(),
        } satisfies MarkerAnnotation)
        return
      }

      if (annotationType === 'pencil' && node instanceof Konva.Line) {
        const pencilColor = node.stroke()
        items.push({
          id: annotationId,
          type: 'pencil',
          points: node.points(),
          color: typeof pencilColor === 'string' ? pencilColor : '#334155',
          width: node.strokeWidth(),
          rotation: node.rotation(),
        } satisfies PencilAnnotation)
        return
      }

      if (annotationType === 'blur' && node instanceof Konva.Group) {
        items.push({
          id: annotationId,
          type: 'blur',
          x: node.x(),
          y: node.y(),
          width: node.width() * node.scaleX(),
          height: node.height() * node.scaleY(),
          pixelSize: Number(node.getAttr('pixelSize') || 20),
          rotation: node.rotation(),
        } satisfies BlurAnnotation)
      }
    })

    // Convert crop coordinates from absolute to relative (relative to image position)
    // Always save raw crop coordinates to preserve exact placement
    const rawCrop = cropWindow.getRawCropRect()
    let relativeCrop: CropRect | null = null

    if (rawCrop && backgroundImage.value) {
      const imgX = backgroundImage.value.x()
      const imgY = backgroundImage.value.y()
      relativeCrop = {
        x: rawCrop.x - imgX,
        y: rawCrop.y - imgY,
        width: rawCrop.width,
        height: rawCrop.height,
      }
    }

    return {
      version: 1,
      image: { width: imageWidth, height: imageHeight },
      crop: relativeCrop,
      imagePlacement,
      items,
    }
  }

  const loadAnnotationDocument = (annotationDocument: AnnotationDocument | null | undefined) => {
    const annotationLayer = layer.value
    const annotationOverlayLayer = overlayLayer.value
    const imageNode = backgroundImage.value
    if (!annotationLayer || !imageNode) return

    annotationLayer.find('.annotation-shape').forEach((node) => node.destroy())
    transformer.value?.nodes([])

    // Restore image placement (position, scale, rotation)
    if (annotationDocument?.imagePlacement) {
      const placement = annotationDocument.imagePlacement
      imageNode.position({ x: placement.x, y: placement.y })
      // Calculate scale from displayed vs intrinsic dimensions
      const scaleX = placement.width / imageNode.width()
      const scaleY = placement.height / imageNode.height()
      imageNode.scale({ x: scaleX, y: scaleY })
      imageNode.rotation(placement.rotation)
    }

    // Convert crop coordinates from relative to absolute (relative to restored image position)
    if (annotationDocument?.crop) {
      const imgX = imageNode.x()
      const imgY = imageNode.y()
      const absoluteCrop: CropRect = {
        x: annotationDocument.crop.x + imgX,
        y: annotationDocument.crop.y + imgY,
        width: annotationDocument.crop.width,
        height: annotationDocument.crop.height,
      }
      // Set crop rect before initializing (so initializeCropWindow won't reset it)
      cropWindow.setCropRect(absoluteCrop, true) // skipClamp = true when restoring saved data
    }

    // Initialize crop window nodes (will preserve existing cropRect if set above)
    cropWindow.initializeCropWindow()

    if (!annotationDocument?.items?.length) {
      annotationLayer.batchDraw()
      annotationOverlayLayer?.batchDraw()

      // Center viewport on crop window even when there are no annotations
      const cropRect = cropWindow.getRawCropRect()
      if (cropRect) {
        centerOnRect(cropRect)
      }
      return
    }

    annotationDocument.items.forEach((item) => {
      if (item.type === 'rectangle') {
        const normalizedRect = normalizeAnnotationItemRect(item)
        const rect = new Konva.Rect({
          x: normalizedRect.x,
          y: normalizedRect.y,
          width: normalizedRect.width,
          height: normalizedRect.height,
          stroke: item.stroke,
          strokeWidth: Math.max(1, item.strokeWidth),
          strokeScaleEnabled: true,
          fill: 'transparent',
          draggable: false,
          rotation: item.rotation || 0,
        })
        rect.name('annotation-shape')
        setAnnotationAttrsFromItem(rect, 'rectangle', item.id)
        bindTransformNormalization(rect, normalizeRectAfterTransform, () =>
          layer.value?.batchDraw(),
        )
        annotationLayer.add(rect)
        return
      }

      if (item.type === 'text') {
        const textNode = new Konva.Text({
          x: item.x,
          y: item.y,
          text: item.text,
          width: Math.max(MIN_TEXT_WIDTH, item.text.length > 0 ? 240 : MIN_TEXT_WIDTH),
          padding: 8,
          fontSize: item.fontSize,
          fill: item.color,
          fontFamily: item.fontFamily || 'sans-serif',
          draggable: false,
          rotation: item.rotation || 0,
        })
        textNode.name('annotation-shape')
        setAnnotationAttrsFromItem(textNode, 'text', item.id)
        textNode.on('dblclick dbltap', () => onTextEditRequested?.(textNode, { isNew: false }))
        bindTransformNormalization(textNode, normalizeTextAfterTransform, () =>
          layer.value?.batchDraw(),
        )
        annotationLayer.add(textNode)
        return
      }

      if (item.type === 'marker' || item.type === 'pencil') {
        const line = new Konva.Line({
          points: item.points,
          stroke: item.color,
          strokeWidth: item.width,
          hitStrokeWidth: Math.max(item.width, MIN_LINE_HIT_STROKE_WIDTH),
          strokeScaleEnabled: true,
          lineCap: 'round',
          lineJoin: 'round',
          tension: 0,
          draggable: false,
          opacity: item.type === 'marker' ? item.opacity : 1,
          rotation: item.rotation || 0,
        })
        line.name('annotation-shape')
        setAnnotationAttrsFromItem(line, item.type, item.id)
        bindTransformNormalization(line, normalizeLineAfterTransform, () =>
          layer.value?.batchDraw(),
        )
        annotationLayer.add(line)
        return
      }

      if (item.type === 'blur') {
        const normalizedRect = normalizeAnnotationItemRect(item)
        const blurGroup = createBlurredRegion(
          normalizedRect.x,
          normalizedRect.y,
          normalizedRect.width,
          normalizedRect.height,
          item.pixelSize,
        )
        if (!blurGroup) return

        blurGroup.name('annotation-shape')
        setAnnotationAttrsFromItem(blurGroup, 'blur', item.id)
        blurGroup.setAttr('pixelSize', item.pixelSize)
        blurGroup.rotation(item.rotation || 0)
        bindTransformNormalization(
          blurGroup,
          (node) => normalizeBlurAfterTransform(node, backgroundImage),
          () => layer.value?.batchDraw(),
        )
        annotationLayer.add(blurGroup)

        const bgIndex = imageNode.index
        if (bgIndex !== undefined) {
          blurGroup.zIndex(bgIndex + 1)
        }
      }
    })

    annotationLayer.batchDraw()
    annotationOverlayLayer?.batchDraw()

    // Center viewport on crop window
    const cropRect = cropWindow.getRawCropRect()
    if (cropRect) {
      centerOnRect(cropRect)
    }
  }

  const generatePreviewDataUrl = (annotationDocument: AnnotationDocument): string => {
    if (!stage.value || !backgroundImage.value) return ''

    // Clear transformer to avoid capturing selection handles in preview
    transformer.value?.nodes([])
    layer.value?.batchDraw()

    // Capture at a pixel ratio that compensates for both the current zoom
    // level and the display's device pixel ratio. Without this, at
    // pixelRatio 1 the capture only has as many pixels as the *on-screen,
    // possibly zoomed-out* view — e.g. at 50% zoom it has half the source
    // image's pixel density — but the crop below is still drawn out to the
    // image's native (zoom-independent) size, so drawImage() ends up
    // upscaling a low-res capture and the result looks soft/blurry (the "like
    // it was saved as a low-quality jpg" symptom, even though the output is
    // a lossless PNG). captureRatio keeps the source at (at minimum) native
    // resolution regardless of zoom, and matches Retina/HiDPI displays too.
    const captureRatio = (1 / stage.value.scaleX()) * (window.devicePixelRatio || 1)
    const sourceCanvas = stage.value.toCanvas({ pixelRatio: captureRatio })
    const exportCanvas = window.document.createElement('canvas')
    const context = exportCanvas.getContext('2d')

    if (!context) return ''

    // Convert crop from relative to absolute coordinates
    let absoluteCropRect: CropRect
    if (annotationDocument.crop) {
      const imgX = backgroundImage.value.x()
      const imgY = backgroundImage.value.y()
      absoluteCropRect = {
        x: annotationDocument.crop.x + imgX,
        y: annotationDocument.crop.y + imgY,
        width: annotationDocument.crop.width,
        height: annotationDocument.crop.height,
      }
    } else {
      // No crop: use full displayed image bounds
      absoluteCropRect = {
        x: backgroundImage.value.x(),
        y: backgroundImage.value.y(),
        width: backgroundImage.value.width() * backgroundImage.value.scaleX(),
        height: backgroundImage.value.height() * backgroundImage.value.scaleY(),
      }
    }

    // Transform crop rect from layer coordinates to stage viewport coordinates,
    // then into sourceCanvas's actual pixel grid (captureRatio pixels per
    // stage viewport CSS pixel, not 1:1 — see captureRatio above).
    const stagePos = stage.value.position()
    const stageScale = stage.value.scaleX()

    const cropRectInStage = {
      x: (absoluteCropRect.x * stageScale + stagePos.x) * captureRatio,
      y: (absoluteCropRect.y * stageScale + stagePos.y) * captureRatio,
      width: absoluteCropRect.width * stageScale * captureRatio,
      height: absoluteCropRect.height * stageScale * captureRatio,
    }

    exportCanvas.width = Math.max(1, Math.round(absoluteCropRect.width))
    exportCanvas.height = Math.max(1, Math.round(absoluteCropRect.height))

    context.drawImage(
      sourceCanvas,
      cropRectInStage.x,
      cropRectInStage.y,
      cropRectInStage.width,
      cropRectInStage.height,
      0,
      0,
      exportCanvas.width,
      exportCanvas.height,
    )

    return exportCanvas.toDataURL('image/png')
  }

  const updateAllBlurRegions = () => {
    if (!layer.value || !backgroundImage.value) return

    layer.value.find('.annotation-shape').forEach((node) => {
      if (node instanceof Konva.Group && node.getAttr('annotationType') === 'blur') {
        const blurredImage = node.getAttr('blurredImage') as Konva.Image
        if (blurredImage) {
          const srcX = node.x() - backgroundImage.value!.x()
          const srcY = node.y() - backgroundImage.value!.y()
          blurredImage.crop({ x: srcX, y: srcY, width: node.width(), height: node.height() })
          blurredImage.cache()
        }
      }
    })

    layer.value.batchDraw()
  }

  let lastBlurUpdateTime = 0
  const throttledUpdateBlurRegions = () => {
    const now = Date.now()
    if (now - lastBlurUpdateTime >= 70) {
      lastBlurUpdateTime = now
      updateAllBlurRegions()
    }
  }

  watch(
    backgroundImage,
    (nextImage, prevImage) => {
      if (prevImage) {
        prevImage.off('dragmove.blur')
        prevImage.off('dragend.blur')
      }

      if (!nextImage) return

      // Don't initialize crop window here - let loadAnnotationDocument handle it
      // Only set up event handlers for blur updates
      cropWindow.setCropEditable(activeTool.value === 'crop')

      nextImage.on('dragmove.blur', throttledUpdateBlurRegions)
      nextImage.on('dragend.blur', updateAllBlurRegions)
    },
    { immediate: true },
  )

  watch(
    () => stage.value?.scaleX(),
    () => {
      cropWindow.syncNodes()
    },
  )

  return {
    isDrawing,
    startTool,
    moveTool,
    endTool,
    cancelTool,
    setAnnotationInteractivity,
    loadAnnotationDocument,
    serializeStageToAnnotationDocument,
    generatePreviewDataUrl,
  }
}
