import Konva from 'konva'
import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export interface KonvaCanvasRefs {
  stage: Ref<Konva.Stage | null>
  layer: Ref<Konva.Layer | null>
  overlayLayer: Ref<Konva.Layer | null>
  transformer: Ref<Konva.Transformer | null>
  selectionRectangle: Ref<Konva.Rect | null>
  backgroundImage: Ref<Konva.Image | null>
}

export function useKonvaCanvas(
  canvasRef: Ref<HTMLDivElement | null>,
  imageUrl: string,
  _cursorMode: Ref<string | null>,
): KonvaCanvasRefs {
  const stage = ref<Konva.Stage | null>(null)
  const layer = ref<Konva.Layer | null>(null)
  const overlayLayer = ref<Konva.Layer | null>(null)
  const transformer = ref<Konva.Transformer | null>(null)
  const selectionRectangle = ref<Konva.Rect | null>(null)
  const backgroundImage = ref<Konva.Image | null>(null)
  let handleShiftKeyChange: ((event: KeyboardEvent) => void) | null = null
  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    if (!canvasRef.value) return

    Konva.hitOnDragEnabled = true
    const stageInstance = new Konva.Stage({
      container: canvasRef.value,
      width: canvasRef.value.clientWidth,
      height: canvasRef.value.clientHeight,
    })
    stage.value = stageInstance

    // The stage's pixel size is otherwise only ever set here, at mount — it
    // never tracks the container div's own size afterwards, so resizing the
    // window (or the mobile/desktop toolbar switching height) left the canvas
    // stuck at whatever size it happened to be created at.
    resizeObserver = new ResizeObserver(() => {
      if (!canvasRef.value) return
      stageInstance.width(canvasRef.value.clientWidth)
      stageInstance.height(canvasRef.value.clientHeight)
      stageInstance.batchDraw()
    })
    resizeObserver.observe(canvasRef.value)

    const layerInstance = new Konva.Layer()
    layer.value = layerInstance
    stageInstance.add(layerInstance)

    const overlayLayerInstance = new Konva.Layer()
    overlayLayer.value = overlayLayerInstance
    stageInstance.add(overlayLayerInstance)

    // Create transformer for selection
    const transformerInstance = new Konva.Transformer({
      // Default anchorSize (10px) — the earlier bump to 16px was compensating
      // for the z-order bug below (shape covering most of the anchor's hit
      // area), not the anchor being genuinely too small. Now that the
      // transformer always re-raises above the shape it's attached to, the
      // default size's hit area is usable across its whole visible square.
      // Free resize by default (independent width/height), matching crop and
      // the usual convention (PowerPoint, Figma, Illustrator, ...) — hold
      // Shift to constrain proportions, wired below.
      keepRatio: false,
    })
    transformer.value = transformerInstance
    layerInstance.add(transformerInstance)

    // The transformer is added to the layer once, here, at mount — but every
    // shape drawn afterwards (rectangle, text, ...) gets added to the layer
    // *later*, which makes it sit above the transformer in the layer's child
    // order. Where an anchor visually overlaps the shape it's resizing, the
    // shape wins hit-testing there, so that part of the anchor shows the
    // shape's own cursor/drag behavior instead of a resize cursor — it only
    // "works" in the sliver of the anchor that falls outside the shape's own
    // bounds. `nodes()` is how every selection path in this codebase (click
    // select, drag-box select, auto-select right after drawing) attaches the
    // transformer to a shape, so wrapping it here — instead of adding
    // `moveToTop()` at each call site individually — guarantees the
    // transformer re-raises above whatever it's currently attached to.
    // Konva's own nodes() dispatches on arguments.length (0 = getter, 1 =
    // setter — see Factory.addOverloadedGetterSetter), not on whether the
    // value is undefined. `selectedNodes` in useSelection.ts calls
    // `transformer.value.nodes()` with *zero* arguments to just read the
    // current selection; an optional-parameter wrapper like
    // `(nextNodes?: Konva.Node[]) => rawSetNodes(nextNodes)` still passes one
    // argument (undefined) through to the original, which Konva's arity check
    // treats as a setter call — so every read silently cleared the selection.
    // That's what actually broke both the resize handles and (via whatever
    // reactive churn that triggered) the crop overlay. Using `arguments`
    // preserves the real call arity.
    const rawNodes = transformerInstance.nodes.bind(transformerInstance)
    transformerInstance.nodes = function (this: Konva.Transformer, ...args: [Konva.Node[]] | []) {
      const result = args.length ? rawNodes(args[0]) : rawNodes()
      if (args.length && args[0].length > 0) {
        transformerInstance.moveToTop()
      }
      return result
    } as Konva.Transformer['nodes']

    // Konva re-reads keepRatio() on every resize tick, so toggling it live
    // while Shift is held works mid-drag, not just at drag start.
    handleShiftKeyChange = (event: KeyboardEvent) => {
      if (event.key !== 'Shift') return
      transformerInstance.keepRatio(event.type === 'keydown')
    }
    window.addEventListener('keydown', handleShiftKeyChange)
    window.addEventListener('keyup', handleShiftKeyChange)

    // Create selection rectangle
    const rectInstance = new Konva.Rect({
      fill: 'rgba(0,150,255,0.1)',
      stroke: 'rgba(0,150,255,1)',
      strokeWidth: 1,
      strokeScaleEnabled: true,
      visible: false,
    })
    selectionRectangle.value = rectInstance
    layerInstance.add(rectInstance)

    // Load image
    Konva.Image.fromURL(imageUrl, (imageInstance) => {
      if (!stageInstance || !layerInstance) return

      backgroundImage.value = imageInstance
      layerInstance.add(imageInstance)

      imageInstance.draggable(false)
      imageInstance.moveToBottom()

      // Move transformer to top so handles appear above all shapes
      selectionRectangle.value?.moveToTop()
      transformerInstance?.moveToTop()
    })
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
    if (handleShiftKeyChange) {
      window.removeEventListener('keydown', handleShiftKeyChange)
      window.removeEventListener('keyup', handleShiftKeyChange)
    }
    stage.value?.destroy()
  })

  return {
    stage: stage as Ref<Konva.Stage | null>,
    layer: layer as Ref<Konva.Layer | null>,
    overlayLayer: overlayLayer as Ref<Konva.Layer | null>,
    transformer: transformer as Ref<Konva.Transformer | null>,
    selectionRectangle: selectionRectangle as Ref<Konva.Rect | null>,
    backgroundImage: backgroundImage as Ref<Konva.Image | null>,
  }
}
