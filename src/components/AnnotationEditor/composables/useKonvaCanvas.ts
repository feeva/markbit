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

  onMounted(() => {
    if (!canvasRef.value) return

    Konva.hitOnDragEnabled = true
    const stageInstance = new Konva.Stage({
      container: canvasRef.value,
      width: canvasRef.value.clientWidth,
      height: canvasRef.value.clientHeight,
    })
    stage.value = stageInstance

    const layerInstance = new Konva.Layer()
    layer.value = layerInstance
    stageInstance.add(layerInstance)

    const overlayLayerInstance = new Konva.Layer()
    overlayLayer.value = overlayLayerInstance
    stageInstance.add(overlayLayerInstance)

    // Create transformer for selection
    const transformerInstance = new Konva.Transformer()
    transformer.value = transformerInstance
    layerInstance.add(transformerInstance)

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
