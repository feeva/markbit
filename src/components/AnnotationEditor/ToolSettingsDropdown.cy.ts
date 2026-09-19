import ToolSettingsDropdown from './ToolSettingsDropdown.vue'

describe('<ToolSettingsDropdown />', () => {
  const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#1F2937']

  it('renders with rectangle tool settings', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'rectangle',
        lineColor: '#EF4444',
        lineWidth: 3,
        colors,
        minWidth: 1,
        maxWidth: 20,
      },
    })

    cy.get('.dropdown').should('exist')
    cy.get('[role="button"]').should('exist')
  })

  it('opens dropdown when trigger is clicked', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'rectangle',
        lineColor: '#EF4444',
        lineWidth: 3,
        colors,
        minWidth: 1,
        maxWidth: 20,
      },
    })

    cy.get('[role="button"]').click()
    cy.get('.dropdown-content').should('be.visible')
  })

  it('displays color picker and line width slider for rectangle tool', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'rectangle',
        lineColor: '#EF4444',
        lineWidth: 3,
        colors,
        minWidth: 1,
        maxWidth: 20,
      },
    })

    cy.get('[role="button"]').click()
    cy.contains('Color').should('be.visible')
    cy.contains('Line Width: 3px').should('be.visible')
    cy.get('.dropdown-content button').should('have.length', colors.length)
    cy.get('input[type="range"]').should('exist')
  })

  it('displays font size label for text tool', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'text',
        lineColor: '#1F2937',
        lineWidth: 24,
        colors,
        minWidth: 12,
        maxWidth: 72,
      },
    })

    cy.get('[role="button"]').click()
    cy.contains('Font Size: 24px').should('be.visible')
  })

  it('displays width label for marker tool', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'marker',
        lineColor: '#F59E0B',
        lineWidth: 20,
        colors,
        minWidth: 10,
        maxWidth: 40,
      },
    })

    cy.get('[role="button"]').click()
    cy.contains('Width: 20px').should('be.visible')
  })

  it('displays blur size label for blur tool', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'blur',
        lineColor: '#CCCCCC',
        lineWidth: 25,
        colors,
        minWidth: 10,
        maxWidth: 50,
      },
    })

    cy.get('[role="button"]').click()
    cy.contains('Blur Size: 25px').should('be.visible')
  })

  it('hides color picker for blur tool', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'blur',
        lineColor: '#CCCCCC',
        lineWidth: 25,
        colors,
        minWidth: 10,
        maxWidth: 50,
      },
    })

    cy.get('[role="button"]').click()
    cy.contains('Color').should('not.exist')
    cy.get('.dropdown-content button').should('have.length', 0)
    cy.get('input[type="range"]')
      .should('have.attr', 'min', '10')
      .and('have.attr', 'max', '50')
  })

  it('emits update:lineColor when color is selected', () => {
    const onUpdateColorSpy = cy.spy().as('updateColorSpy')
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'rectangle',
        lineColor: '#EF4444',
        lineWidth: 3,
        colors,
        minWidth: 1,
        maxWidth: 20,
        'onUpdate:lineColor': onUpdateColorSpy,
      },
    })

    cy.get('[role="button"]').click()
    cy.get('.dropdown-content button').eq(2).click() // Click green color
    cy.get('@updateColorSpy').should('have.been.calledWith', '#10B981')
  })

  it('emits update:lineWidth when slider is changed', () => {
    const onUpdateWidthSpy = cy.spy().as('updateWidthSpy')
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'rectangle',
        lineColor: '#EF4444',
        lineWidth: 3,
        colors,
        minWidth: 1,
        maxWidth: 20,
        'onUpdate:lineWidth': onUpdateWidthSpy,
      },
    })

    cy.get('[role="button"]').click()
    cy.get('input[type="range"]').invoke('val', 10).trigger('input')
    cy.get('@updateWidthSpy').should('have.been.calledWith', 10)
  })

  it('highlights selected color', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'rectangle',
        lineColor: '#10B981', // Green
        lineWidth: 3,
        colors,
        minWidth: 1,
        maxWidth: 20,
      },
    })

    cy.get('[role="button"]').click()
    cy.get('.dropdown-content button')
      .eq(2) // Green color button
      .should('have.class', 'border-primary')
      .and('have.class', 'scale-110')
  })

  it('sets correct min and max values on range slider', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'text',
        lineColor: '#1F2937',
        lineWidth: 24,
        colors,
        minWidth: 12,
        maxWidth: 72,
      },
    })

    cy.get('[role="button"]').click()
    cy.get('input[type="range"]')
      .should('have.attr', 'min', '12')
      .and('have.attr', 'max', '72')
      .and('have.value', '24')
  })

  it('uses custom width label for non-special tools', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'rectangle',
        label: 'Thickness',
        lineColor: '#EF4444',
        lineWidth: 3,
        colors,
        minWidth: 1,
        maxWidth: 20,
      },
    })

    cy.get('[role="button"]').click()
    cy.contains('Thickness: 3px').should('be.visible')
  })

  it('renders custom trigger content from slot', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'rectangle',
        lineColor: '#EF4444',
        lineWidth: 3,
        colors,
        minWidth: 1,
        maxWidth: 20,
      },
      slots: {
        trigger: '<span data-cy="custom-trigger">Custom</span>',
      },
    })

    cy.get('[data-cy="custom-trigger"]').should('exist').and('contain', 'Custom')
  })

  it('keeps dropdown open when interacting with controls inside', () => {
    cy.mount(ToolSettingsDropdown, {
      props: {
        tool: 'rectangle',
        lineColor: '#EF4444',
        lineWidth: 3,
        colors,
        minWidth: 1,
        maxWidth: 20,
      },
    })

    cy.get('[role="button"]').click()
    cy.get('.dropdown-content').should('be.visible')

    // Click color button
    cy.get('.dropdown-content button').eq(1).click()
    cy.get('.dropdown-content').should('be.visible')

    // Adjust slider
    cy.get('input[type="range"]').invoke('val', 5).trigger('input')
    cy.get('.dropdown-content').should('be.visible')
  })
})
