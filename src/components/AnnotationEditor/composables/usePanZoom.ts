import Konva from 'konva'
import { computed, ref, type Ref } from 'vue'

export function usePanZoom(
  stage: Ref<Konva.Stage | null>,
  backgroundImage: Ref<Konva.Image | null>,
  containerRef: Ref<HTMLDivElement | null>,
) {
  const LINE_HEIGHT_PIXELS = 16
  const WHEEL_ZOOM_SENSITIVITY = 0.0015
  const MAX_WHEEL_DELTA_PIXELS = 240
  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 3
  const panStart = ref({ x: 0, y: 0 })

  const scale = computed(() => stage.value?.scaleX() || 1)

  // Calculate scale to fit image to 90% of container
  const getFitScale = (): number | null => {
    if (!containerRef.value || !backgroundImage.value) return null

    const containerWidth = containerRef.value.clientWidth
    const containerHeight = containerRef.value.clientHeight
    const imgWidth = backgroundImage.value.width()
    const imgHeight = backgroundImage.value.height()

    if (containerWidth === 0 || containerHeight === 0 || imgWidth === 0 || imgHeight === 0)
      return null

    const scaleX = (containerWidth * 0.9) / imgWidth
    const scaleY = (containerHeight * 0.9) / imgHeight

    return Math.min(scaleX, scaleY)
  }

  const calculateFitScale = (): number => {
    return getFitScale() ?? 1
  }

  const getZoomBounds = (): { minZoom: number; maxZoom: number } => {
    const fitScale = getFitScale()

    // Default fallback if fitScale cannot be calculated
    if (!fitScale || fitScale <= 0) {
      return {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      }
    }

    // Min zoom: dynamic based on fit scale
    const minZoom = Math.min(MIN_ZOOM, fitScale * MIN_ZOOM)

    // Max zoom: 3× original image size
    const maxZoom = 3

    return {
      minZoom,
      maxZoom,
    }
  }

  const clampScale = (value: number): number => {
    const { minZoom, maxZoom } = getZoomBounds()
    return Math.max(minZoom, Math.min(maxZoom, value))
  }

  const fitToContainer = () => {
    if (!stage.value || !containerRef.value || !backgroundImage.value) return

    const fitScale = calculateFitScale()
    stage.value.scale({ x: fitScale, y: fitScale })

    // Center the image
    const containerWidth = containerRef.value.clientWidth
    const containerHeight = containerRef.value.clientHeight
    const scaledImageWidth = backgroundImage.value.width() * fitScale
    const scaledImageHeight = backgroundImage.value.height() * fitScale

    const x = (containerWidth - scaledImageWidth) / 2
    const y = (containerHeight - scaledImageHeight) / 2

    stage.value.position({ x, y })
  }

  // Coordinate transformation utilities
  const pointerToCanvas = (pointerPos: { x: number; y: number }) => {
    if (!stage.value) return pointerPos

    const stagePos = stage.value.position()
    const currentScale = scale.value
    return {
      x: (pointerPos.x - stagePos.x) / currentScale,
      y: (pointerPos.y - stagePos.y) / currentScale,
    }
  }

  const zoomToPoint = (point: { x: number; y: number }, newScale: number) => {
    if (!stage.value) return

    const canvasPoint = pointerToCanvas(point)
    const newPos = {
      x: point.x - canvasPoint.x * newScale,
      y: point.y - canvasPoint.y * newScale,
    }
    stage.value.scale({ x: newScale, y: newScale })
    stage.value.position(constrainPan(newPos.x, newPos.y, newScale))
  }

  // Constrain panning within bounds
  const constrainPan = (x: number, y: number, atScale = scale.value): { x: number; y: number } => {
    if (!containerRef.value || !backgroundImage.value || !stage.value) return { x, y }

    const container = containerRef.value
    const img = backgroundImage.value

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const imgWidth = img.width() * atScale
    const imgHeight = img.height() * atScale

    // Allow free panning as long as some part of the image remains visible.
    // Visible overlap condition on each axis:
    //   x < containerWidth && x + imgWidth > 0
    //   y < containerHeight && y + imgHeight > 0
    const minX = -imgWidth + 1
    const maxX = containerWidth - 1
    const minY = -imgHeight + 1
    const maxY = containerHeight - 1

    const constrainedX = Math.min(maxX, Math.max(minX, x))
    const constrainedY = Math.min(maxY, Math.max(minY, y))

    return { x: constrainedX, y: constrainedY }
  }

  const zoomIn = () => {
    if (!stage.value) return

    const center = {
      x: stage.value.width() / 2,
      y: stage.value.height() / 2,
    }
    const newScale = clampScale(scale.value * 1.2)
    zoomToPoint(center, newScale)
  }

  const zoomOut = () => {
    if (!stage.value) return

    const center = {
      x: stage.value.width() / 2,
      y: stage.value.height() / 2,
    }
    const newScale = clampScale(scale.value / 1.2)
    zoomToPoint(center, newScale)
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (!stage.value) return

    e.evt.preventDefault()

    const pointer = stage.value.getPointerPosition()!
    const deltaMode = e.evt.deltaMode
    const pageHeight = containerRef.value?.clientHeight || stage.value.height() || 800

    const deltaInPixels =
      deltaMode === WheelEvent.DOM_DELTA_LINE
        ? e.evt.deltaY * LINE_HEIGHT_PIXELS
        : deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? e.evt.deltaY * pageHeight
          : e.evt.deltaY

    const directionAdjustedDelta = e.evt.ctrlKey ? -deltaInPixels : deltaInPixels
    const clampedDelta = Math.max(
      -MAX_WHEEL_DELTA_PIXELS,
      Math.min(MAX_WHEEL_DELTA_PIXELS, directionAdjustedDelta),
    )

    const scaleFactor = Math.exp(-clampedDelta * WHEEL_ZOOM_SENSITIVITY)
    const newScale = clampScale(scale.value * scaleFactor)
    zoomToPoint(pointer, newScale)
  }

  const startPan = (pointerPos: { x: number; y: number }) => {
    panStart.value = { x: pointerPos.x, y: pointerPos.y }
  }

  const updatePan = (pointerPos: { x: number; y: number }) => {
    if (!stage.value) return

    const dx = pointerPos.x - panStart.value.x
    const dy = pointerPos.y - panStart.value.y

    const currentPos = stage.value.position()
    const newPos = constrainPan(currentPos.x + dx, currentPos.y + dy)
    stage.value.position(newPos)

    panStart.value = { x: pointerPos.x, y: pointerPos.y }
  }

  const centerOnRect = (rect: { x: number; y: number; width: number; height: number }) => {
    if (!stage.value || !containerRef.value) return

    const containerWidth = containerRef.value.clientWidth
    const containerHeight = containerRef.value.clientHeight

    // Calculate scale to fit rect to 90% of container
    const scaleX = (containerWidth * 0.9) / rect.width
    const scaleY = (containerHeight * 0.9) / rect.height
    const fitScale = clampScale(Math.min(scaleX, scaleY))

    // Set the scale
    stage.value.scale({ x: fitScale, y: fitScale })

    // Calculate the center of the rect in layer coordinates
    const rectCenterX = rect.x + rect.width / 2
    const rectCenterY = rect.y + rect.height / 2

    // Calculate stage position to center the rect in the viewport
    const x = containerWidth / 2 - rectCenterX * fitScale
    const y = containerHeight / 2 - rectCenterY * fitScale

    stage.value.position(constrainPan(x, y, fitScale))
    stage.value.batchDraw()
  }

  return {
    scale,
    pointerToCanvas,
    zoomToPoint,
    constrainPan,
    zoomIn,
    zoomOut,
    fitToContainer,
    centerOnRect,
    handleWheel,
    startPan,
    updatePan,
  }
}
