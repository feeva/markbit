import Konva from 'konva'
import type { Ref } from 'vue'

import { L } from '@/i18n'

interface UseTextEditorOptions {
  stage: Ref<Konva.Stage | null>
  layer: Ref<Konva.Layer | null>
  transformer: Ref<Konva.Transformer | null>
}

export function useTextEditor({ stage, layer, transformer }: UseTextEditorOptions) {
  let activeTextarea: HTMLTextAreaElement | null = null

  const getTextareaHost = () => {
    if (!stage.value) {
      return document.body
    }

    return stage.value.container().closest('dialog[open]') || document.body
  }

  const createTextarea = (
    textNode: Konva.Text,
    stageRect: DOMRect,
    options: { isNew: boolean; previousText: string },
  ): HTMLTextAreaElement => {
    const { isNew, previousText } = options
    const absoluteTransform = textNode.getAbsoluteTransform().copy()
    const textPosition = absoluteTransform.point({ x: 0, y: 0 })
    const absoluteScale = textNode.getAbsoluteScale()
    const effectiveScaleX = Math.max(0.0001, Math.abs(absoluteScale.x))
    const effectiveScaleY = Math.max(0.0001, Math.abs(absoluteScale.y))
    const textFill = textNode.fill()
    const areaPosition = {
      x: stageRect.left + textPosition.x,
      y: stageRect.top + textPosition.y,
    }

    const textarea = document.createElement('textarea')
    textarea.value = isNew ? '' : previousText
    textarea.placeholder = L('Type text and press Enter')
    textarea.style.position = 'fixed'
    textarea.style.top = `${areaPosition.y}px`
    textarea.style.left = `${areaPosition.x}px`
    textarea.style.width = `${Math.max(180, (textNode.width() - textNode.padding() * 2) * effectiveScaleX)}px`
    textarea.style.height = 'auto'
    textarea.style.minHeight = '1.5rem'
    textarea.style.padding = `${Math.max(2, textNode.padding() * effectiveScaleX)}px`
    textarea.style.margin = '0px'
    textarea.style.border = '1px solid #3B82F6'
    textarea.style.background = '#FFFFFF'
    textarea.style.color = typeof textFill === 'string' ? textFill : '#1F2937'
    textarea.style.outline = 'none'
    textarea.style.resize = 'none'
    textarea.style.overflow = 'hidden'
    textarea.style.whiteSpace = 'pre-wrap'
    textarea.style.fontFamily = textNode.fontFamily()
    textarea.style.lineHeight = `${textNode.lineHeight()}`
    textarea.style.textAlign = textNode.align()
    textarea.style.fontSize = `${Math.max(12, textNode.fontSize() * effectiveScaleY)}px`
    textarea.style.transformOrigin = 'left top'
    if (textNode.rotation()) {
      textarea.style.transform = `rotateZ(${textNode.rotation()}deg)`
    }
    textarea.style.zIndex = '9999'

    return textarea
  }

  const resizeTextarea = (textarea: HTMLTextAreaElement, minHeight = 0) => {
    textarea.style.height = 'auto'
    const contentHeight = textarea.scrollHeight + 2
    textarea.style.height = `${Math.max(contentHeight, minHeight)}px`
  }

  const commitTextEdit = (
    textarea: HTMLTextAreaElement,
    textNode: Konva.Text,
    effectiveScaleX: number,
    previousText: string,
    isNew: boolean,
  ) => {
    const nextText = textarea.value.trim()

    if (!nextText && isNew) {
      textNode.destroy()
    } else if (!nextText && !isNew) {
      textNode.text(previousText)
      textNode.show()
      transformer.value?.nodes([textNode])
    } else {
      textNode.text(nextText)
      textNode.width(Math.max(180, textarea.offsetWidth / effectiveScaleX + textNode.padding() * 2))
      textNode.show()
      transformer.value?.nodes([textNode])
    }

    layer.value?.batchDraw()
  }

  const cancelTextEdit = (textNode: Konva.Text, previousText: string, isNew: boolean) => {
    if (isNew && !previousText.trim()) {
      textNode.destroy()
    } else {
      textNode.text(previousText)
      textNode.show()
    }
    layer.value?.batchDraw()
  }

  const destroyActiveTextarea = () => {
    if (!activeTextarea) return

    const textareaWithCommit = activeTextarea as HTMLTextAreaElement & {
      __commit?: () => void
    }

    if (textareaWithCommit.__commit) {
      textareaWithCommit.__commit()
      return
    }

    activeTextarea.remove()
    activeTextarea = null
  }

  const startTextEdit = (textNode: Konva.Text, options?: { isNew: boolean }) => {
    if (!stage.value) return

    destroyActiveTextarea()

    const isNew = !!options?.isNew
    const previousText = textNode.text()
    const stageRect = stage.value.container().getBoundingClientRect()
    const absoluteScale = textNode.getAbsoluteScale()
    const effectiveScaleX = Math.max(0.0001, Math.abs(absoluteScale.x))
    const effectiveScaleY = Math.max(0.0001, Math.abs(absoluteScale.y))

    const textarea = createTextarea(textNode, stageRect, { isNew, previousText })
    let isClosing = false

    const cleanup = () => {
      if (!textarea.parentNode) return

      if (activeTextarea === textarea) {
        activeTextarea = null
      }
      textarea.remove()
    }

    const handleCommit = () => {
      if (isClosing) return
      isClosing = true
      commitTextEdit(textarea, textNode, effectiveScaleX, previousText, isNew)
      cleanup()
    }

    const handleCancel = () => {
      if (isClosing) return
      isClosing = true
      cancelTextEdit(textNode, previousText, isNew)
      cleanup()
    }

    // Attach commit method for external access
    ;(textarea as HTMLTextAreaElement & { __commit?: () => void }).__commit = handleCommit

    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleCancel()
        return
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleCommit()
      }
    })

    textarea.addEventListener('input', () => resizeTextarea(textarea))
    textarea.addEventListener('blur', handleCommit)

    textNode.hide()
    transformer.value?.nodes([])
    layer.value?.batchDraw()

    getTextareaHost().appendChild(textarea)
    activeTextarea = textarea

    requestAnimationFrame(() => {
      if (!textarea.parentNode) return

      const initialHeight = Math.max(0, textNode.height() * effectiveScaleY + 2)
      resizeTextarea(textarea, initialHeight)

      textarea.focus()
      textarea.select()
    })
  }

  return {
    startTextEdit,
    destroyActiveTextarea,
  }
}
