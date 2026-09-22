<script setup lang="ts">
import Konva from 'konva'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import AnnotationToolbar from './AnnotationToolbar.vue'
import { useAnnotationTools } from './composables/useAnnotationTools'
import { useKonvaCanvas } from './composables/useKonvaCanvas'
import { usePanZoom } from './composables/usePanZoom'
import { useSelection } from './composables/useSelection'
import { useTextEditor } from './composables/useTextEditor'
import { L } from '@/i18n'
import type {
  AnnotationDocument,
  AnnotationSavePayload,
  MarkbitAction,
  Tool,
  ToolSettings,
} from '@/types/annotations'

interface Props {
  imageUrl: string
  forMobile?: boolean
  annotationData?: AnnotationDocument | null
  actions?: MarkbitAction[]
}

interface Emits {
  (e: 'close'): void
}

// forMobile: undefined (not omitted) matters - Vue casts an absent Boolean
// prop to `false` unless it has an explicit default, which would make
// `props.forMobile ?? isNarrowContainer.value` below always resolve to
// `false` (the real embed never passes forMobile at all).
const props = withDefaults(defineProps<Props>(), { actions: () => [], forMobile: undefined })
const emit = defineEmits<Emits>()

// `forMobile` is an optional override (e.g. for Cypress component tests that
// want the mobile layout without actually resizing the viewport). When it's
// not passed, the layout auto-detects from the component's own rendered
// width via ResizeObserver — using the container's width rather than
// `window.innerWidth` means this works correctly regardless of how large the
// host page lets the overlay be, not just full-viewport embeds.
const MOBILE_LAYOUT_BREAKPOINT_PX = 640
const rootRef = ref<HTMLDivElement | null>(null)
const isNarrowContainer = ref(false)
const isMobileLayout = computed(() => props.forMobile ?? isNarrowContainer.value)
let resizeObserver: ResizeObserver | null = null

const isDrawingTool = (tool: Tool | null): tool is Exclude<Tool, 'select' | 'crop'> => {
  return !!tool && tool !== 'select' && tool !== 'crop'
}

// Remembers only drawing tools (Box/Text/Marker/Pencil/Blur), not Crop/Select
// — those two are situational (Crop responds to "is there something to
// crop", Select to "is there something to select"), so persisting them would
// just reintroduce the "opens on Crop no matter what I meant to do last"
// annoyance this was built to fix.
const LAST_DRAWING_TOOL_STORAGE_KEY = 'markbit:lastDrawingTool'
const DEFAULT_NEW_TOOL: Tool = 'marker'

// localStorage can throw (Safari private browsing, storage disabled by
// policy) — a remembered-tool lookup must never break editor startup.
const readStoredDrawingTool = (): Tool | null => {
  try {
    const stored = localStorage.getItem(LAST_DRAWING_TOOL_STORAGE_KEY) as Tool | null
    return isDrawingTool(stored) ? stored : null
  } catch {
    return null
  }
}

const writeStoredDrawingTool = (tool: Tool) => {
  if (!isDrawingTool(tool)) return
  try {
    localStorage.setItem(LAST_DRAWING_TOOL_STORAGE_KEY, tool)
  } catch {
    // ignore — see readStoredDrawingTool
  }
}

const handleDefaultTool = (annotationData?: AnnotationDocument | null): Tool => {
  if (!annotationData) {
    return readStoredDrawingTool() ?? DEFAULT_NEW_TOOL
  }

  if (annotationData.crop || annotationData.items.length > 0) {
    return 'select'
  }

  return readStoredDrawingTool() ?? DEFAULT_NEW_TOOL
}

const activeTool = ref<Tool>(handleDefaultTool(props.annotationData))
watch(activeTool, (tool) => writeStoredDrawingTool(tool))

const toolSettings = ref<Record<Tool, ToolSettings>>({
  select: { lineWidth: 0, lineColor: '#000000' },
  crop: { lineWidth: 2, lineColor: '#2563EB' },
  rectangle: { lineWidth: 3, lineColor: '#DC2626' },
  text: { lineWidth: 18, lineColor: '#1F2937' },
  marker: { lineWidth: 20, lineColor: 'yellow' },
  pencil: { lineWidth: 2, lineColor: '#2563EB' },
  blur: { lineWidth: 20, lineColor: '#475569' },
})

const canvasRef = ref<HTMLDivElement | null>(null)
const cursorMode = ref<string | null>(null)

const { stage, layer, overlayLayer, transformer, selectionRectangle, backgroundImage, selectionVersion } =
  useKonvaCanvas(canvasRef, props.imageUrl, cursorMode)

const {
  scale,
  pointerToCanvas,
  constrainPan,
  zoomIn,
  zoomOut,
  fitToContainer,
  centerOnRect,
  handleWheel,
  startPan,
  updatePan,
} = usePanZoom(stage, backgroundImage, canvasRef)

const {
  selectedNodes,
  startSelection,
  updateSelection,
  endSelection,
  selectObject,
  toggleObjectSelection,
  deselectAll,
  deleteSelected,
} = useSelection(stage, transformer, selectionRectangle, backgroundImage, selectionVersion)

const { startTextEdit, destroyActiveTextarea } = useTextEditor({ stage, layer, transformer })

interface ToolPropertyAdapter {
  getColor: (node: Konva.Node) => string | undefined
  setColor: (node: Konva.Node, color: string) => void
  getWidth: (node: Konva.Node) => number
  setWidth: (node: Konva.Node, width: number) => void
}

const strokeAdapter: ToolPropertyAdapter = {
  getColor: (node) => {
    const stroke = (node as Konva.Shape).stroke()
    return typeof stroke === 'string' ? stroke : undefined
  },
  setColor: (node, color) => (node as Konva.Shape).stroke(color),
  getWidth: (node) => (node as Konva.Shape).strokeWidth(),
  setWidth: (node, width) => (node as Konva.Shape).strokeWidth(width),
}

// Blur is excluded: it bakes a rasterized blur into the image and destroys
// itself after drawing (see useAnnotationTools.ts's endTool()), so it has no
// color/width to edit afterward.
const EDITABLE_TOOL_ADAPTERS: Partial<Record<Tool, ToolPropertyAdapter>> = {
  text: {
    getColor: (node) => {
      const fill = (node as Konva.Text).fill()
      return typeof fill === 'string' ? fill : undefined
    },
    setColor: (node, color) => (node as Konva.Text).fill(color),
    getWidth: (node) => (node as Konva.Text).fontSize(),
    setWidth: (node, width) => (node as Konva.Text).fontSize(width),
  },
  rectangle: strokeAdapter,
  marker: strokeAdapter,
  pencil: strokeAdapter,
}

// Matches no swatch, so a multi-select with differing colors shows none
// highlighted instead of an arbitrary one.
const MIXED_COLOR = ''

const selectedAnnotationType = computed<Tool | null>(() => {
  if (selectedNodes.value.length === 0) return null

  const types = new Set(selectedNodes.value.map((node) => node.getAttr('annotationType') as Tool))
  if (types.size !== 1) return null

  const [type] = types
  return EDITABLE_TOOL_ADAPTERS[type] ? type : null
})

const displayToolSettings = computed<Record<Tool, ToolSettings>>(() => {
  const type = selectedAnnotationType.value
  if (!type) return toolSettings.value

  const adapter = EDITABLE_TOOL_ADAPTERS[type]!
  const [first, ...rest] = selectedNodes.value
  const firstColor = adapter.getColor(first)
  const uniformColor = firstColor !== undefined && rest.every((node) => adapter.getColor(node) === firstColor)

  return {
    ...toolSettings.value,
    [type]: {
      lineColor: uniformColor ? firstColor! : MIXED_COLOR,
      lineWidth: adapter.getWidth(first),
    },
  }
})

const movingSelection = ref<{
  start: { x: number; y: number }
  nodes: Array<{ node: Konva.Node; x: number; y: number }>
} | null>(null)

const {
  isDrawing,
  startTool,
  moveTool,
  endTool,
  cancelTool,
  setAnnotationInteractivity,
  loadAnnotationDocument,
  serializeStageToAnnotationDocument,
  generatePreviewDataUrl,
} = useAnnotationTools({
  activeTool,
  toolSettings,
  stage,
  layer,
  overlayLayer,
  transformer,
  backgroundImage,
  pointerToCanvas,
  centerOnRect,
  onTextEditRequested: startTextEdit,
})

const handleResolveSelectableNode = (node: Konva.Node | null): Konva.Node | null => {
  if (!node || !stage.value) return null
  if (node._id === stage.value._id) return null

  const parent = node.getParent()
  if (parent?.getAttr && parent.getAttr('annotationType')) {
    return parent
  }

  if (node.getAttr && node.getAttr('annotationType')) {
    return node
  }

  if (node._id === backgroundImage.value?._id) {
    return node
  }

  return null
}

const handleUpdateHoverCursor = (pointerPos?: { x: number; y: number }) => {
  if (!stage.value) return

  const container = stage.value.container()

  if (cursorMode.value === 'panning') {
    container.style.cursor = 'move'
    return
  }

  if (cursorMode.value === 'moving-selection') {
    container.style.cursor = 'grabbing'
    return
  }

  if (isDrawingTool(activeTool.value)) {
    container.style.cursor = 'crosshair'
    return
  }

  if (activeTool.value === 'crop') {
    if (!pointerPos) {
      container.style.cursor = 'default'
      return
    }

    const objectUnderCursor = stage.value.getIntersection(pointerPos)
    const cropHandleDirection = objectUnderCursor?.getAttr?.('cropHandleDirection')

    if (cropHandleDirection === 'top' || cropHandleDirection === 'bottom') {
      container.style.cursor = 'ns-resize'
      return
    }

    if (cropHandleDirection === 'left' || cropHandleDirection === 'right') {
      container.style.cursor = 'ew-resize'
      return
    }

    if (cropHandleDirection === 'topLeft' || cropHandleDirection === 'bottomRight') {
      container.style.cursor = 'nwse-resize'
      return
    }

    if (cropHandleDirection === 'topRight' || cropHandleDirection === 'bottomLeft') {
      container.style.cursor = 'nesw-resize'
      return
    }

    container.style.cursor = 'default'
    return
  }

  if (!pointerPos) {
    container.style.cursor = 'default'
    return
  }

  const objectUnderCursor = handleResolveSelectableNode(stage.value.getIntersection(pointerPos))
  container.style.cursor = objectUnderCursor ? 'grab' : 'default'
}

const handleStageDragStart = (event: Konva.KonvaEventObject<DragEvent>) => {
  if (!stage.value || activeTool.value !== 'select') return

  const draggedNode = handleResolveSelectableNode(event.target)
  if (!draggedNode) return

  cursorMode.value = 'moving-selection'
  handleUpdateHoverCursor(stage.value.getPointerPosition() || undefined)
}

const handleStageDragEnd = () => {
  if (!stage.value || cursorMode.value !== 'moving-selection') return

  if (movingSelection.value) {
    return
  }

  cursorMode.value = null
  handleUpdateHoverCursor(stage.value.getPointerPosition() || undefined)
}

const handleSelectTool = (tool: Tool) => {
  if (tool === 'select') {
    activeTool.value = 'select'
    return
  }

  activeTool.value = activeTool.value === tool ? 'select' : tool
}

const handleUpdateToolSettings = (tool: Tool, settings: Partial<ToolSettings>) => {
  // Also updates the "next new shape" default: a freshly-drawn shape
  // auto-selects itself (endTool() in useAnnotationTools.ts), so without
  // this the very next shape would revert to the hardcoded default.
  toolSettings.value[tool] = { ...toolSettings.value[tool], ...settings }

  // While a selection of this tool's own type is active, its dropdown also
  // edits those nodes directly - see displayToolSettings above.
  const adapter = EDITABLE_TOOL_ADAPTERS[tool]
  if (adapter && selectedAnnotationType.value === tool) {
    selectedNodes.value.forEach((node) => {
      if (settings.lineColor !== undefined) adapter.setColor(node, settings.lineColor)
      if (settings.lineWidth !== undefined) adapter.setWidth(node, settings.lineWidth)
    })
    // Re-assigning nodes forces the Transformer to recompute its bounding
    // box - matters for text, where fontSize changes the node's height
    // (same pattern as useTextEditor.ts's commitTextEdit).
    transformer.value?.nodes([...selectedNodes.value])
    layer.value?.batchDraw()
  }
}

const handleSetZoom = (preset: 'fit' | 50 | 100 | 300) => {
  if (!stage.value || !canvasRef.value) return

  if (preset === 'fit') {
    fitToContainer()
  } else {
    const newScale = preset / 100
    const center = {
      x: canvasRef.value.clientWidth / 2,
      y: canvasRef.value.clientHeight / 2,
    }

    const canvasCenter = pointerToCanvas(center)
    stage.value.scale({ x: newScale, y: newScale })

    const newPos = {
      x: center.x - canvasCenter.x * newScale,
      y: center.y - canvasCenter.y * newScale,
    }
    stage.value.position(constrainPan(newPos.x, newPos.y, newScale))
  }

  stage.value.batchDraw()
}

const handlePointerStart = (event: Konva.KonvaEventObject<PointerEvent>) => {
  if (!stage.value) return

  if (transformer.value && event.target?.getParent?.()?._id === transformer.value._id) {
    return
  }

  if (event.evt.button === 2) {
    cursorMode.value = 'panning'
    const pos = stage.value.getPointerPosition()
    if (pos) {
      startPan(pos)
      handleUpdateHoverCursor(pos)
    }
    return
  }

  const pointerPos = stage.value.getPointerPosition()
  if (!pointerPos) return

  if (isDrawingTool(activeTool.value)) {
    // Special handling for text tool: edit existing text if clicked on one
    if (activeTool.value === 'text') {
      const objectUnderCursor = stage.value.getIntersection(pointerPos)
      if (
        objectUnderCursor &&
        objectUnderCursor.getAttr('annotationType') === 'text' &&
        objectUnderCursor instanceof Konva.Text
      ) {
        selectObject(objectUnderCursor)
        startTextEdit(objectUnderCursor, { isNew: false })
        handleUpdateHoverCursor(pointerPos)
        return
      }
    }

    deselectAll()
    cursorMode.value = activeTool.value === 'text' ? null : 'drawing'
    startTool(pointerPos)
    handleUpdateHoverCursor(pointerPos)
    return
  }

  if (activeTool.value === 'crop') {
    deselectAll()
    handleUpdateHoverCursor(pointerPos)
    return
  }

  const objectUnderCursor = handleResolveSelectableNode(stage.value.getIntersection(pointerPos))

  if (objectUnderCursor) {
    // Shift-click adds/removes just this one object to/from the selection —
    // it never starts a move-drag, even if the object was already selected.
    if (event.evt.shiftKey) {
      toggleObjectSelection(objectUnderCursor)
      handleUpdateHoverCursor(pointerPos)
      return
    }

    const currentNodes = transformer.value?.nodes() || []
    const clickedInSelection = currentNodes.some((node) => node._id === objectUnderCursor._id)

    if (clickedInSelection && currentNodes.length > 1) {
      currentNodes.forEach((node) => node.draggable(false))
      movingSelection.value = {
        start: pointerToCanvas(pointerPos),
        nodes: currentNodes.map((node) => ({
          node,
          x: node.x(),
          y: node.y(),
        })),
      }
      cursorMode.value = 'moving-selection'
      handleUpdateHoverCursor(pointerPos)
      return
    }

    selectObject(objectUnderCursor)
    cursorMode.value = 'moving-selection'
    handleUpdateHoverCursor(pointerPos)
    return
  }

  cursorMode.value = 'selecting'
  startSelection(pointerToCanvas(pointerPos))
}

const handlePointerMove = (event: PointerEvent) => {
  if (!stage.value) return

  stage.value.setPointersPositions(event)
  const pointerPos = stage.value.getPointerPosition()
  if (!pointerPos) return

  if (cursorMode.value === 'panning') {
    updatePan(pointerPos)
    handleUpdateHoverCursor(pointerPos)
    return
  }

  if (cursorMode.value === 'moving-selection' && movingSelection.value) {
    const currentCanvasPos = pointerToCanvas(pointerPos)
    const dx = currentCanvasPos.x - movingSelection.value.start.x
    const dy = currentCanvasPos.y - movingSelection.value.start.y

    movingSelection.value.nodes.forEach(({ node, x, y }) => {
      node.position({ x: x + dx, y: y + dy })
    })

    layer.value?.batchDraw()
    handleUpdateHoverCursor(pointerPos)
    return
  }

  if (cursorMode.value === 'drawing' && isDrawingTool(activeTool.value) && isDrawing.value) {
    moveTool(pointerPos)
    handleUpdateHoverCursor(pointerPos)
    return
  }

  if (cursorMode.value === 'selecting') {
    updateSelection(pointerToCanvas(pointerPos))
    handleUpdateHoverCursor(pointerPos)
    return
  }

  handleUpdateHoverCursor(pointerPos)
}

const handlePointerEnd = (event: PointerEvent) => {
  stage.value?.setPointersPositions(event)

  if (cursorMode.value === 'panning') {
    cursorMode.value = null
  } else if (cursorMode.value === 'moving-selection') {
    movingSelection.value = null
    cursorMode.value = null
    setAnnotationInteractivity(activeTool.value)
  } else if (cursorMode.value === 'drawing' && isDrawingTool(activeTool.value)) {
    endTool()
    cursorMode.value = null
  } else if (cursorMode.value === 'selecting') {
    endSelection()
    cursorMode.value = null
  }

  handleUpdateHoverCursor(stage.value?.getPointerPosition() || undefined)
}

const handleContextMenu = (event: Event) => {
  event.preventDefault()
}

const handleDelete = () => {
  destroyActiveTextarea()
  deleteSelected()
}

const handleSelectAll = () => {
  if (!layer.value || !transformer.value) return

  const allAnnotations = layer.value.find('.annotation-shape')

  if (allAnnotations.length === 0) return

  transformer.value.nodes(allAnnotations)
  layer.value.batchDraw()
}

const isTypingInTextField = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable
}

const handleKeyDown = (event: KeyboardEvent) => {
  // This listener is on window, so it also fires while the text-annotation
  // textarea has focus - without this guard, Delete/Backspace/Cmd+A while
  // typing ran these canvas shortcuts instead of the textarea's own.
  if (isTypingInTextField(event.target)) return

  // Delete key
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    handleDelete()
    return
  }

  // Cmd+A (Mac) or Ctrl+A (Windows/Linux)
  if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
    event.preventDefault()
    handleSelectAll()
    return
  }
}

const handleRegisterEventHandlers = () => {
  if (!stage.value) return

  stage.value.on('wheel', handleWheel)
  stage.value.on('pointerdown', handlePointerStart)
  stage.value.on('dragstart', handleStageDragStart)
  stage.value.on('dragend', handleStageDragEnd)
  document.body.addEventListener('pointermove', handlePointerMove)
  document.body.addEventListener('pointerup', handlePointerEnd)
  window.addEventListener('keydown', handleKeyDown)
}

const handleUnregisterEventHandlers = () => {
  if (stage.value) {
    stage.value.off('wheel', handleWheel)
    stage.value.off('pointerdown', handlePointerStart)
    stage.value.off('dragstart', handleStageDragStart)
    stage.value.off('dragend', handleStageDragEnd)
  }

  document.body.removeEventListener('pointermove', handlePointerMove)
  document.body.removeEventListener('pointerup', handlePointerEnd)
  window.removeEventListener('keydown', handleKeyDown)
}

watch(stage, (newStage, oldStage) => {
  if (oldStage) {
    handleUnregisterEventHandlers()
  }

  if (newStage) {
    handleRegisterEventHandlers()
    handleUpdateHoverCursor()
  }
})

watch(backgroundImage, (newImage) => {
  if (newImage) {
    // Only fit to container if there's no saved image placement to restore
    if (!props.annotationData?.imagePlacement) {
      fitToContainer()
    }
    loadAnnotationDocument(props.annotationData)
    setAnnotationInteractivity(activeTool.value)
    handleUpdateHoverCursor()
  }
})

watch(
  () => props.annotationData,
  (annotationData) => {
    activeTool.value = handleDefaultTool(annotationData)

    if (!backgroundImage.value) return
    loadAnnotationDocument(annotationData)
    setAnnotationInteractivity(activeTool.value)
    handleUpdateHoverCursor(stage.value?.getPointerPosition() || undefined)
  },
)

watch(activeTool, (tool) => {
  if (tool !== 'select') {
    deselectAll()
  }

  setAnnotationInteractivity(tool)
  handleUpdateHoverCursor(stage.value?.getPointerPosition() || undefined)
})

onMounted(() => {
  if (!rootRef.value) return

  resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0
    isNarrowContainer.value = width > 0 && width < MOBILE_LAYOUT_BREAKPOINT_PX
  })
  resizeObserver.observe(rootRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  destroyActiveTextarea()
  cancelTool()
  handleUnregisterEventHandlers()
})

const buildSavePayload = (): AnnotationSavePayload => {
  const document = serializeStageToAnnotationDocument()
  return {
    annotationData: JSON.stringify(document),
    previewDataUrl: generatePreviewDataUrl(document),
  }
}

const handleActionClick = (id: string) => {
  const action = props.actions.find((candidate) => candidate.id === id)
  action?.onClick(buildSavePayload())
}

defineExpose({
  serializeStageToAnnotationDocument,
  generatePreviewDataUrl,
})
</script>

<template>
  <!--
    min-w-0: a flex container's default min-width is `auto`, which resolves to
    its content's unwrapped natural width (here, the toolbar's full button row)
    — that silently overrides the grid parent's attempt to stretch/shrink this
    to the container's actual width, so it never shrinks below whatever the
    toolbar's widest-ever unwrapped state needed, and flex-wrap on the toolbar
    row never gets a narrow-enough box to actually wrap into.
  -->
  <div ref="rootRef" class="flex flex-col min-w-0">
    <!-- as tooltips are placed under the canvas, we need to set a higher z-index for the toolbar -->
    <!--
      pr-14 (not px-4 on both sides): frame.ts's close button floats fixed at
      top:0.5rem/right:0.5rem, on top of everything, outside this component's
      control (it's injected directly into the host document, not part of
      this Vue tree). Without this reserved gutter, toolbar content pushed to
      the right edge (e.g. the copy/download buttons) renders underneath it.
    -->
    <div
      class="shrink-0 bg-base-200 border-b border-base-300 pl-4 pr-14 py-2 relative"
      style="z-index: 1"
    >
      <AnnotationToolbar
        :active-tool="activeTool"
        :tool-settings="displayToolSettings"
        :scale
        :selected-count="selectedNodes.length"
        :for-mobile="isMobileLayout"
        :actions="actions"
        @select-tool="handleSelectTool"
        @update-tool-settings="handleUpdateToolSettings"
        @delete="handleDelete"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @set-zoom="handleSetZoom"
        @action="handleActionClick"
      />
    </div>

    <div class="flex-1 overflow-hidden" @contextmenu="handleContextMenu">
      <div ref="canvasRef" class="h-full inset-0" data-cy="canvas"></div>

      <div
        v-if="isMobileLayout"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 w-auto whitespace-nowrap bg-black/50 text-white text-xs px-3 py-2 rounded-full"
      >
        {{ L('Pinch to zoom • Two fingers to pan') }}
      </div>

      <!--
        Free-tier badge (see PLAN.md's "Dual-License Feature Split Candidates"
        backlog — a future paid-tier removal toggle is deferred, not built
        here). Bottom-right avoids frame.ts's close button, which floats
        top-right. target="_blank" matters: without it, clicking inside the
        embed widget navigates the srcdoc iframe's own browsing context,
        silently blanking the overlay instead of opening a new tab.
      -->
      <a
        href="https://markbit.abcbox.kr"
        target="_blank"
        rel="noopener"
        class="absolute bottom-2 right-2 text-xs text-base-content/50 hover:text-base-content/80 no-underline select-none"
      >
        {{ L('Powered by Markbit') }}
      </a>
    </div>
  </div>
</template>
