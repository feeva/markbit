import Konva from 'konva'
import { computed, ref, type Ref } from 'vue'

export function useSelection(
  stage: Ref<Konva.Stage | null>,
  transformer: Ref<Konva.Transformer | null>,
  selectionRectangle: Ref<Konva.Rect | null>,
  backgroundImage: Ref<Konva.Image | null>,
) {
  const selectionCoords = ref<Record<string, number>>({})

  const selectedNodes = computed(() => {
    const nodes = transformer.value?.nodes() || []
    // Exclude the background image from selected nodes count
    return nodes.filter((node) => node._id !== backgroundImage.value?._id)
  })

  const startSelection = (canvasPos: { x: number; y: number }) => {
    if (!selectionRectangle.value || !transformer.value) return

    // Deselect all
    transformer.value.nodes([])

    selectionCoords.value = {
      x1: canvasPos.x,
      y1: canvasPos.y,
      x2: canvasPos.x,
      y2: canvasPos.y,
    }

    selectionRectangle.value.setAttrs({
      x: selectionCoords.value.x1,
      y: selectionCoords.value.y1,
      width: 0,
      height: 0,
      visible: true,
    })
    selectionRectangle.value.moveToTop()
  }

  const updateSelection = (canvasPos: { x: number; y: number }) => {
    if (!selectionRectangle.value || !transformer.value || !stage.value) return

    selectionCoords.value.x2 = canvasPos.x
    selectionCoords.value.y2 = canvasPos.y

    selectionRectangle.value.setAttrs({
      x: Math.min(selectionCoords.value.x1 || 0, selectionCoords.value.x2 || 0),
      y: Math.min(selectionCoords.value.y1 || 0, selectionCoords.value.y2 || 0),
      width: Math.abs((selectionCoords.value.x2 || 0) - (selectionCoords.value.x1 || 0)),
      height: Math.abs((selectionCoords.value.y2 || 0) - (selectionCoords.value.y1 || 0)),
    })

    // Select annotations plus background image within selection rectangle
    const shapes = stage.value.find('Shape').filter((shape) => {
      return (
        shape !== selectionRectangle.value &&
        shape.parent !== transformer.value &&
        (shape._id === backgroundImage.value?._id || shape.hasName('annotation-shape'))
      )
    })
    const box = selectionRectangle.value.getClientRect()
    const selected = shapes.filter((shape) =>
      Konva.Util.haveIntersection(box, shape.getClientRect()),
    )
    transformer.value.nodes(selected)
  }

  const endSelection = () => {
    if (!selectionRectangle.value || !stage.value) return

    // Hide selection rectangle
    setTimeout(() => {
      selectionRectangle.value!.visible(false)
    })

    stage.value.container().style.cursor = 'default'
  }

  const selectObject = (object: Konva.Node) => {
    if (!transformer.value) return

    if (object._id !== backgroundImage.value?._id && !object.hasName('annotation-shape')) {
      transformer.value.nodes([])
      return
    }

    transformer.value.nodes([object])
  }

  const deselectAll = () => {
    if (!transformer.value) return
    transformer.value.nodes([])
  }

  const deleteSelected = () => {
    if (!transformer.value || !stage.value) return

    const nodesToDelete = transformer.value
      .nodes()
      .filter((node) => node._id !== backgroundImage.value?._id)
    nodesToDelete.forEach((node) => node.destroy())
    transformer.value.nodes([])
    stage.value.draw()
  }

  return {
    selectedNodes,
    startSelection,
    updateSelection,
    endSelection,
    selectObject,
    deselectAll,
    deleteSelected,
  }
}
