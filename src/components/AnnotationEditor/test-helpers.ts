import AnnotationEditor from './AnnotationEditor.vue'

export const createTestImage = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 800
  const ctx = canvas.getContext('2d')!

  // Light blue background
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, 1280, 800)

  // Full-size bordered rectangle
  ctx.strokeStyle = '#aaaaaa'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, 1280, 800)

  // Centered text
  ctx.fillStyle = '#1976d2'
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Test Image', 640, 400)

  return canvas.toDataURL('image/png')
}

export const cleanupKonva = () => {
  // Ensure complete Konva cleanup between tests to prevent intermittent failures
  cy.window().then((win) => {
    // Destroy all Konva stages
    ;(win as any).Konva?.stages?.forEach((stage: any) => {
      try {
        stage?.destroy()
      } catch (e) {
        // Ignore errors during cleanup
      }
    })
  })

  // Remove any orphaned Konva DOM elements
  cy.get('body').then(($body) => {
    $body.find('.konvajs-content')?.parent()?.remove()
  })
}

export const mountDesktop = (extraProps: Record<string, unknown> = {}) => {
  cleanupKonva()
  cy.mount(AnnotationEditor, {
    props: {
      imageUrl: createTestImage(),
      className: 'h-screen flex flex-col',
      ...extraProps,
    },
  })
  // Wait for Konva canvas to be fully initialized
  cy.get('[data-cy="canvas"]').should('exist')
  cy.wait(100) // Small delay to ensure Konva stage is ready
}

export const mountMobile = (width = 390, height = 844) => {
  cleanupKonva()
  cy.viewport(width, height)
  cy.mount(AnnotationEditor, {
    props: {
      imageUrl: createTestImage(),
      className: 'h-screen flex flex-col',
      forMobile: true,
    },
  })
  cy.get('[data-cy="canvas"]').should('exist')
  cy.wait(100)
}

export const mountMobileLandscape = () => {
  mountMobile(844, 390)
}

export const fireMobilePinchWheel = (deltaY: number) => {
  cy.window().then((win) => {
    const stage = (win as any).Konva?.stages?.[0]
    expect(stage).to.exist

    const container = stage.container()
    const rect = container.getBoundingClientRect()
    const clientX = rect.left + rect.width / 2
    const clientY = rect.top + rect.height / 2

    const pointerEvent = new win.MouseEvent('mousemove', { clientX, clientY })
    stage.setPointersPositions(pointerEvent)

    const wheelEvent = new win.WheelEvent('wheel', {
      deltaY,
      ctrlKey: true,
      clientX,
      clientY,
    })

    stage.fire('wheel', { evt: wheelEvent })
    stage.batchDraw()
  })
}

export const getStageScale = () => {
  return cy.window().then((win) => {
    const stage = (win as any).Konva?.stages?.[0]
    expect(stage).to.exist
    return stage.scaleX() as number
  })
}

export const getZoomBounds = () => {
  return cy.window().then((win) => {
    const stage = (win as any).Konva?.stages?.[0]
    expect(stage).to.exist

    const image = stage.findOne('Image')
    expect(image).to.exist

    const container = stage.container()
    const fitScale = Math.min(
      (container.clientWidth * 0.9) / image.width(),
      (container.clientHeight * 0.9) / image.height(),
    )

    return {
      minZoom: Math.min(0.5, fitScale * 0.5),
      maxZoom: 3,
    }
  })
}
