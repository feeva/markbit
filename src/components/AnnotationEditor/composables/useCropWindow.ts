import Konva from 'konva'
import { ref, shallowRef, type Ref } from 'vue'

import type { CropRect } from '@/types/annotations'

interface UseCropWindowOptions {
  overlayLayer: Ref<Konva.Layer | null>
  backgroundImage: Ref<Konva.Image | null>
  stage: Ref<Konva.Stage | null>
}

type CropHandleDirection =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'topLeft'
  | 'topRight'
  | 'bottomRight'
  | 'bottomLeft'
type CropMaskDirection = 'top' | 'right' | 'bottom' | 'left'

interface CropNodes {
  masks: Record<CropMaskDirection, Konva.Rect>
  border: Konva.Rect
  handles: Record<CropHandleDirection, Konva.Rect>
  markers: Record<CropHandleDirection, Konva.Line>
}

const MASK_EXTENT = 1_000_000
const MIN_CROP_SIZE = 24
const EDGE_HANDLE_THICKNESS = 16
const MARKER_EDGE_LENGTH = 26
const MARKER_CORNER_LENGTH = 14
const MARKER_COLOR = '#111827'
const DIM_COLOR = 'rgba(128, 128, 128, .7)'
const RESIZE_CURSOR: Record<
  CropHandleDirection,
  'ns-resize' | 'ew-resize' | 'nwse-resize' | 'nesw-resize'
> = {
  top: 'ns-resize',
  right: 'ew-resize',
  bottom: 'ns-resize',
  left: 'ew-resize',
  topLeft: 'nwse-resize',
  topRight: 'nesw-resize',
  bottomRight: 'nwse-resize',
  bottomLeft: 'nesw-resize',
}

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < 0.0001
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

export function useCropWindow({ overlayLayer, backgroundImage, stage }: UseCropWindowOptions) {
  const cropRect = ref<CropRect | null>(null)
  const isEditable = ref(false)
  const nodes = shallowRef<CropNodes | null>(null)

  const getImageBounds = (): CropRect | null => {
    if (!backgroundImage.value) return null

    return {
      x: backgroundImage.value.x(),
      y: backgroundImage.value.y(),
      width: backgroundImage.value.width() * backgroundImage.value.scaleX(),
      height: backgroundImage.value.height() * backgroundImage.value.scaleY(),
    }
  }

  const buildMask = (direction: CropMaskDirection) => {
    return new Konva.Rect({
      fill: DIM_COLOR,
      listening: false,
      name: `crop-window-mask crop-window-mask-${direction}`,
    })
  }

  const buildBorder = () => {
    return new Konva.Rect({
      strokeEnabled: false,
      fillEnabled: false,
      listening: false,
      name: 'crop-window-border',
    })
  }

  const buildHandle = (direction: CropHandleDirection) => {
    const cursor = RESIZE_CURSOR[direction]
    const handle = new Konva.Rect({
      fill: 'rgba(0,0,0,0)',
      strokeEnabled: false,
      visible: false,
      draggable: true,
      listening: false,
      name: `crop-window-handle crop-window-handle-${direction}`,
    })

    handle.setAttr('cropHandleDirection', direction)
    handle.on('pointerdown mousedown touchstart', (event) => {
      event.cancelBubble = true
    })
    handle.on('dragstart', (event) => {
      event.cancelBubble = true
      const container = overlayLayer.value?.getStage()?.container()
      if (container) {
        container.style.cursor = cursor
      }
    })
    handle.on('mouseenter', () => {
      const container = overlayLayer.value?.getStage()?.container()
      if (container && isEditable.value) {
        container.style.cursor = cursor
      }
    })
    handle.on('mouseleave', () => {
      const container = overlayLayer.value?.getStage()?.container()
      if (container && isEditable.value) {
        container.style.cursor = 'default'
      }
    })
    handle.on('dragend', (event) => {
      event.cancelBubble = true
      const container = overlayLayer.value?.getStage()?.container()
      if (container && isEditable.value) {
        container.style.cursor = cursor
      }
    })

    return handle
  }

  const buildMarker = (direction: CropHandleDirection) => {
    return new Konva.Line({
      points: [0, 0, 0, 0],
      stroke: MARKER_COLOR,
      strokeWidth: 3,
      strokeScaleEnabled: false,
      lineCap: 'square',
      lineJoin: 'miter',
      listening: false,
      visible: false,
      shadowColor: '#ffffff',
      shadowBlur: 1,
      shadowOpacity: 0.9,
      name: `crop-window-marker crop-window-marker-${direction}`,
    })
  }

  const ensureNodes = () => {
    if (!overlayLayer.value) return null
    if (nodes.value) return nodes.value

    const nextNodes: CropNodes = {
      masks: {
        top: buildMask('top'),
        right: buildMask('right'),
        bottom: buildMask('bottom'),
        left: buildMask('left'),
      },
      border: buildBorder(),
      handles: {
        top: buildHandle('top'),
        right: buildHandle('right'),
        bottom: buildHandle('bottom'),
        left: buildHandle('left'),
        topLeft: buildHandle('topLeft'),
        topRight: buildHandle('topRight'),
        bottomRight: buildHandle('bottomRight'),
        bottomLeft: buildHandle('bottomLeft'),
      },
      markers: {
        top: buildMarker('top'),
        right: buildMarker('right'),
        bottom: buildMarker('bottom'),
        left: buildMarker('left'),
        topLeft: buildMarker('topLeft'),
        topRight: buildMarker('topRight'),
        bottomRight: buildMarker('bottomRight'),
        bottomLeft: buildMarker('bottomLeft'),
      },
    }

    Object.values(nextNodes.masks).forEach((maskNode) => overlayLayer.value?.add(maskNode))
    overlayLayer.value.add(nextNodes.border)
    Object.values(nextNodes.handles).forEach((handleNode) => overlayLayer.value?.add(handleNode))
    Object.values(nextNodes.markers).forEach((markerNode) => overlayLayer.value?.add(markerNode))

    nodes.value = nextNodes
    return nextNodes
  }

  const updateMaskNodes = (activeNodes: CropNodes, rect: CropRect) => {
    const right = rect.x + rect.width
    const bottom = rect.y + rect.height

    activeNodes.masks.top.setAttrs({
      x: -MASK_EXTENT,
      y: -MASK_EXTENT,
      width: MASK_EXTENT * 2,
      height: Math.max(0, rect.y + MASK_EXTENT),
    })
    activeNodes.masks.bottom.setAttrs({
      x: -MASK_EXTENT,
      y: bottom,
      width: MASK_EXTENT * 2,
      height: MASK_EXTENT,
    })
    activeNodes.masks.left.setAttrs({
      x: -MASK_EXTENT,
      y: rect.y,
      width: Math.max(0, rect.x + MASK_EXTENT),
      height: rect.height,
    })
    activeNodes.masks.right.setAttrs({
      x: right,
      y: rect.y,
      width: MASK_EXTENT,
      height: rect.height,
    })
  }

  const updateHandleNodes = (activeNodes: CropNodes, rect: CropRect) => {
    const scale = stage.value?.scaleX() || 1
    const edgeHalf = EDGE_HANDLE_THICKNESS / 2 / scale
    const edgeThickness = EDGE_HANDLE_THICKNESS / scale
    const cornerHalf = MARKER_CORNER_LENGTH
    const cornerSize = cornerHalf * 2

    activeNodes.handles.top.setAttrs({
      x: rect.x,
      y: rect.y - edgeHalf,
      width: rect.width,
      height: edgeThickness,
    })
    activeNodes.handles.bottom.setAttrs({
      x: rect.x,
      y: rect.y + rect.height - edgeHalf,
      width: rect.width,
      height: edgeThickness,
    })
    activeNodes.handles.left.setAttrs({
      x: rect.x - edgeHalf,
      y: rect.y,
      width: edgeThickness,
      height: rect.height,
    })
    activeNodes.handles.right.setAttrs({
      x: rect.x + rect.width - edgeHalf,
      y: rect.y,
      width: edgeThickness,
      height: rect.height,
    })

    activeNodes.handles.topLeft.setAttrs({
      x: rect.x - cornerHalf,
      y: rect.y - cornerHalf,
      width: cornerSize,
      height: cornerSize,
    })
    activeNodes.handles.topRight.setAttrs({
      x: rect.x + rect.width - cornerHalf,
      y: rect.y - cornerHalf,
      width: cornerSize,
      height: cornerSize,
    })
    activeNodes.handles.bottomRight.setAttrs({
      x: rect.x + rect.width - cornerHalf,
      y: rect.y + rect.height - cornerHalf,
      width: cornerSize,
      height: cornerSize,
    })
    activeNodes.handles.bottomLeft.setAttrs({
      x: rect.x - cornerHalf,
      y: rect.y + rect.height - cornerHalf,
      width: cornerSize,
      height: cornerSize,
    })
  }

  const updateMarkerNodes = (activeNodes: CropNodes, rect: CropRect) => {
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    const edgeMarkerLengthX = clamp(MARKER_EDGE_LENGTH, 8, Math.max(8, rect.width - 8))
    const edgeMarkerLengthY = clamp(MARKER_EDGE_LENGTH, 8, Math.max(8, rect.height - 8))
    const cornerMarkerLength = clamp(
      MARKER_CORNER_LENGTH,
      8,
      Math.max(8, Math.min(rect.width, rect.height) / 2),
    )
    const halfEdgeMarkerLengthX = edgeMarkerLengthX / 2
    const halfEdgeMarkerLengthY = edgeMarkerLengthY / 2

    activeNodes.markers.top.points([
      centerX - halfEdgeMarkerLengthX,
      rect.y,
      centerX + halfEdgeMarkerLengthX,
      rect.y,
    ])
    activeNodes.markers.bottom.points([
      centerX - halfEdgeMarkerLengthX,
      rect.y + rect.height,
      centerX + halfEdgeMarkerLengthX,
      rect.y + rect.height,
    ])
    activeNodes.markers.left.points([
      rect.x,
      centerY - halfEdgeMarkerLengthY,
      rect.x,
      centerY + halfEdgeMarkerLengthY,
    ])
    activeNodes.markers.right.points([
      rect.x + rect.width,
      centerY - halfEdgeMarkerLengthY,
      rect.x + rect.width,
      centerY + halfEdgeMarkerLengthY,
    ])

    activeNodes.markers.topLeft.points([
      rect.x + cornerMarkerLength,
      rect.y,
      rect.x,
      rect.y,
      rect.x,
      rect.y + cornerMarkerLength,
    ])
    activeNodes.markers.topRight.points([
      rect.x + rect.width - cornerMarkerLength,
      rect.y,
      rect.x + rect.width,
      rect.y,
      rect.x + rect.width,
      rect.y + cornerMarkerLength,
    ])
    activeNodes.markers.bottomRight.points([
      rect.x + rect.width,
      rect.y + rect.height - cornerMarkerLength,
      rect.x + rect.width,
      rect.y + rect.height,
      rect.x + rect.width - cornerMarkerLength,
      rect.y + rect.height,
    ])
    activeNodes.markers.bottomLeft.points([
      rect.x,
      rect.y + rect.height - cornerMarkerLength,
      rect.x,
      rect.y + rect.height,
      rect.x + cornerMarkerLength,
      rect.y + rect.height,
    ])
  }

  const updateNodeVisibility = (activeNodes: CropNodes, hasRect: boolean) => {
    activeNodes.border.visible(hasRect)
    Object.values(activeNodes.masks).forEach((maskNode) => maskNode.visible(hasRect))

    const showHandles = hasRect && isEditable.value
    Object.values(activeNodes.handles).forEach((handleNode) => {
      handleNode.visible(showHandles)
      handleNode.listening(showHandles)
      handleNode.draggable(showHandles)
    })
    Object.values(activeNodes.markers).forEach((markerNode) => {
      markerNode.visible(showHandles)
    })
  }

  const syncNodes = () => {
    const activeNodes = ensureNodes()
    if (!activeNodes) return

    if (!cropRect.value) {
      updateNodeVisibility(activeNodes, false)
      overlayLayer.value?.batchDraw()
      return
    }

    updateMaskNodes(activeNodes, cropRect.value)
    activeNodes.border.setAttrs(cropRect.value)
    updateHandleNodes(activeNodes, cropRect.value)
    updateMarkerNodes(activeNodes, cropRect.value)
    updateNodeVisibility(activeNodes, true)

    activeNodes.border.moveToTop()
    Object.values(activeNodes.handles).forEach((handleNode) => handleNode.moveToTop())
    Object.values(activeNodes.markers).forEach((markerNode) => markerNode.moveToTop())
    overlayLayer.value?.batchDraw()
  }

  const applyResizedRect = (direction: CropHandleDirection, center: { x: number; y: number }) => {
    if (!cropRect.value) return

    const rect = cropRect.value
    let nextLeft = rect.x
    let nextTop = rect.y
    let nextRight = rect.x + rect.width
    let nextBottom = rect.y + rect.height

    if (direction === 'top' || direction === 'topLeft' || direction === 'topRight') {
      nextTop = Math.min(center.y, nextBottom - MIN_CROP_SIZE)
    }

    if (direction === 'bottom' || direction === 'bottomLeft' || direction === 'bottomRight') {
      nextBottom = Math.max(center.y, nextTop + MIN_CROP_SIZE)
    }

    if (direction === 'left' || direction === 'topLeft' || direction === 'bottomLeft') {
      nextLeft = Math.min(center.x, nextRight - MIN_CROP_SIZE)
    }

    if (direction === 'right' || direction === 'topRight' || direction === 'bottomRight') {
      nextRight = Math.max(center.x, nextLeft + MIN_CROP_SIZE)
    }

    cropRect.value = {
      x: nextLeft,
      y: nextTop,
      width: nextRight - nextLeft,
      height: nextBottom - nextTop,
    }
    syncNodes()
  }

  const bindHandleResize = (direction: CropHandleDirection) => {
    const activeNodes = ensureNodes()
    if (!activeNodes) return

    const handleNode = activeNodes.handles[direction]

    handleNode.off('dragmove.crop-window')
    handleNode.on('dragmove.crop-window', (event) => {
      event.cancelBubble = true

      if (!cropRect.value) return

      const center = {
        x: handleNode.x() + handleNode.width() / 2,
        y: handleNode.y() + handleNode.height() / 2,
      }

      applyResizedRect(direction, center)
    })
  }

  const bindResizeHandlers = () => {
    bindHandleResize('top')
    bindHandleResize('right')
    bindHandleResize('bottom')
    bindHandleResize('left')
    bindHandleResize('topLeft')
    bindHandleResize('topRight')
    bindHandleResize('bottomRight')
    bindHandleResize('bottomLeft')
  }

  const initializeCropWindow = () => {
    ensureNodes()
    bindResizeHandlers()

    // Only set crop to default image bounds if not already set
    if (!cropRect.value) {
      const imageBounds = getImageBounds()
      if (imageBounds) {
        cropRect.value = imageBounds
      }
    }

    syncNodes()
  }

  const setCropEditable = (editable: boolean) => {
    isEditable.value = editable
    syncNodes()
  }

  const clearCrop = () => {
    cropRect.value = null
    syncNodes()
  }

  const setCropRect = (nextRect: CropRect | null, skipClamp = false) => {
    const imageBounds = getImageBounds()
    if (!imageBounds) return

    if (!nextRect) {
      cropRect.value = imageBounds
      syncNodes()
      return
    }

    // When restoring from saved data, skip clamping (coordinates are already relative to image)
    if (skipClamp) {
      cropRect.value = {
        x: nextRect.x,
        y: nextRect.y,
        width: nextRect.width,
        height: nextRect.height,
      }
      syncNodes()
      return
    }

    const x = clamp(nextRect.x, imageBounds.x, imageBounds.x + imageBounds.width)
    const y = clamp(nextRect.y, imageBounds.y, imageBounds.y + imageBounds.height)
    const maxWidth = imageBounds.x + imageBounds.width - x
    const maxHeight = imageBounds.y + imageBounds.height - y
    const width = clamp(nextRect.width, 0, maxWidth)
    const height = clamp(nextRect.height, 0, maxHeight)

    if (width < MIN_CROP_SIZE || height < MIN_CROP_SIZE) {
      cropRect.value = imageBounds
      syncNodes()
      return
    }

    cropRect.value = {
      x,
      y,
      width,
      height,
    }
    syncNodes()
  }

  const getCropRect = (): CropRect | null => {
    const rect = cropRect.value
    const imageBounds = getImageBounds()

    if (!rect || !imageBounds) return null

    const intersectX = Math.max(rect.x, imageBounds.x)
    const intersectY = Math.max(rect.y, imageBounds.y)
    const intersectRight = Math.min(rect.x + rect.width, imageBounds.x + imageBounds.width)
    const intersectBottom = Math.min(rect.y + rect.height, imageBounds.y + imageBounds.height)
    const intersectWidth = intersectRight - intersectX
    const intersectHeight = intersectBottom - intersectY

    if (intersectWidth < MIN_CROP_SIZE || intersectHeight < MIN_CROP_SIZE) {
      return null
    }

    const coversFullImage =
      nearlyEqual(intersectX, imageBounds.x) &&
      nearlyEqual(intersectY, imageBounds.y) &&
      nearlyEqual(intersectWidth, imageBounds.width) &&
      nearlyEqual(intersectHeight, imageBounds.height)

    if (coversFullImage) {
      return null
    }

    return {
      x: intersectX,
      y: intersectY,
      width: intersectWidth,
      height: intersectHeight,
    }
  }

  const getRawCropRect = (): CropRect | null => {
    return cropRect.value
  }

  return {
    initializeCropWindow,
    setCropEditable,
    clearCrop,
    setCropRect,
    getCropRect,
    getRawCropRect,
    syncNodes,
  }
}
