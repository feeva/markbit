<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon.vue'
import ToolSettingsDropdown from './ToolSettingsDropdown.vue'
import { L } from '@/i18n'
import type { Tool, ToolSettings } from '@/types/annotations'

interface Props {
  activeTool: Tool | null
  toolSettings: Record<Tool, ToolSettings>
  scale: number
  selectedCount: number
  forMobile: boolean
}

interface Emits {
  (e: 'selectTool', tool: Tool): void
  (e: 'updateToolSettings', tool: Tool, settings: Partial<ToolSettings>): void
  (e: 'delete'): void
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
  (e: 'setZoom', preset: 'fit' | 50 | 100 | 300): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const colors = ['#DC2626', 'yellow', '#0891B2', '#2563EB', '#0F766E', '#334155']
const mobileToolItems = computed<
  Array<{
    tool: Exclude<Tool, 'select'>
    label: string
    icon: string
  }>
>(() => [
  { tool: 'crop', label: L('Crop'), icon: 'border-corners' },
  { tool: 'rectangle', label: L('Box'), icon: 'rectangle' },
  { tool: 'text', label: L('Text'), icon: 'typography' },
  { tool: 'marker', label: L('Marker'), icon: 'highlight' },
  { tool: 'pencil', label: L('Pencil'), icon: 'writing' },
  { tool: 'blur', label: L('Blur'), icon: 'ripple' },
])
const toolWidthRange: Record<Tool, { min: number; max: number }> = {
  select: { min: 1, max: 1 },
  crop: { min: 1, max: 1 },
  rectangle: { min: 1, max: 20 },
  text: { min: 12, max: 72 },
  marker: { min: 10, max: 40 },
  pencil: { min: 1, max: 10 },
  blur: { min: 10, max: 50 },
}

const mobileActiveTool = computed<Exclude<Tool, 'select'>>(() => {
  if (props.activeTool && props.activeTool !== 'select') return props.activeTool
  return 'rectangle'
})

const handleToolSelect = (tool: Tool) => {
  emit('selectTool', tool)
}

const handleColorUpdate = (tool: Tool, color: string) => {
  emit('updateToolSettings', tool, { lineColor: color })
}

const handleWidthUpdate = (tool: Tool, width: number) => {
  emit('updateToolSettings', tool, { lineWidth: width })
}

const handleZoomPreset = (preset: 'fit' | 50 | 100 | 300) => {
  emit('setZoom', preset)
  // Close dropdown by removing focus
  ;(document.activeElement as HTMLElement)?.blur()
}

const handleMobileToolSelect = (tool: Exclude<Tool, 'select'>) => {
  emit('selectTool', tool)
  ;(document.activeElement as HTMLElement)?.blur()
}

const handleToolIcon = (tool: Tool | null): string => {
  if (tool === 'select') return 'pointer'
  if (tool === 'crop') return 'border-corners'
  if (tool === 'rectangle') return 'rectangle'
  if (tool === 'text') return 'typography'
  if (tool === 'marker') return 'highlight'
  if (tool === 'pencil') return 'writing'
  return 'ripple'
}

const handleShowToolSettings = (tool: Tool | null): boolean => {
  return tool !== 'select' && tool !== 'crop'
}
</script>

<template>
  <!-- Desktop Toolbar -->
  <div v-if="!forMobile" class="flex items-center gap-2 flex-wrap">
    <!-- Select Tool -->
    <button
      class="btn btn-sm tooltip tooltip-bottom"
      :class="activeTool === 'select' ? 'btn-active' : ''"
      :data-tip="L('Select')"
      @click="handleToolSelect('select')"
    >
      <Icon name="pointer" />
    </button>

    <div class="divider divider-horizontal mx-0"></div>

    <!-- Crop Tool -->
    <button
      class="btn btn-sm tooltip tooltip-bottom"
      :class="activeTool === 'crop' ? 'btn-active' : ''"
      :data-tip="L('Crop')"
      @click="handleToolSelect('crop')"
    >
      <Icon name="border-corners" />
    </button>

    <div class="divider divider-horizontal mx-0"></div>

    <!-- Rectangle Tool -->
    <div class="join">
      <button
        class="btn btn-sm join-item tooltip tooltip-bottom"
        :class="activeTool === 'rectangle' ? 'btn-active' : ''"
        :data-tip="L('Box')"
        @click="handleToolSelect('rectangle')"
      >
        <Icon name="rectangle" />
      </button>
      <ToolSettingsDropdown
        tool="rectangle"
        :line-color="toolSettings.rectangle.lineColor"
        :line-width="toolSettings.rectangle.lineWidth"
        :colors="colors"
        :min-width="1"
        :max-width="20"
        @update:line-color="handleColorUpdate('rectangle', $event)"
        @update:line-width="handleWidthUpdate('rectangle', $event)"
      >
        <template #trigger>
          <Icon name="chevron-down" class="w-3 h-3" />
        </template>
      </ToolSettingsDropdown>
    </div>

    <!-- Text Tool -->
    <div class="join">
      <button
        class="btn btn-sm join-item tooltip tooltip-bottom"
        :class="activeTool === 'text' ? 'btn-active' : ''"
        :data-tip="L('Text')"
        @click="handleToolSelect('text')"
      >
        <Icon name="typography" />
      </button>
      <ToolSettingsDropdown
        tool="text"
        :line-color="toolSettings.text.lineColor"
        :line-width="toolSettings.text.lineWidth"
        :colors="colors"
        :min-width="12"
        :max-width="72"
        @update:line-color="handleColorUpdate('text', $event)"
        @update:line-width="handleWidthUpdate('text', $event)"
      >
        <template #trigger>
          <Icon name="chevron-down" class="w-3 h-3" />
        </template>
      </ToolSettingsDropdown>
    </div>

    <!-- Marker Tool -->
    <div class="join">
      <button
        class="btn btn-sm join-item tooltip tooltip-bottom"
        :class="activeTool === 'marker' ? 'btn-active' : ''"
        :data-tip="L('Highlighter')"
        @click="handleToolSelect('marker')"
      >
        <Icon name="highlight" />
      </button>
      <ToolSettingsDropdown
        tool="marker"
        :line-color="toolSettings.marker.lineColor"
        :line-width="toolSettings.marker.lineWidth"
        :colors="colors"
        :min-width="10"
        :max-width="40"
        @update:line-color="handleColorUpdate('marker', $event)"
        @update:line-width="handleWidthUpdate('marker', $event)"
      >
        <template #trigger>
          <Icon name="chevron-down" class="w-3 h-3" />
        </template>
      </ToolSettingsDropdown>
    </div>

    <!-- Pencil Tool -->
    <div class="join">
      <button
        class="btn btn-sm join-item tooltip tooltip-bottom"
        :class="activeTool === 'pencil' ? 'btn-active' : ''"
        :data-tip="L('Pencil')"
        @click="handleToolSelect('pencil')"
      >
        <Icon name="writing" />
      </button>
      <ToolSettingsDropdown
        tool="pencil"
        :line-color="toolSettings.pencil.lineColor"
        :line-width="toolSettings.pencil.lineWidth"
        :colors="colors"
        :min-width="1"
        :max-width="10"
        @update:line-color="handleColorUpdate('pencil', $event)"
        @update:line-width="handleWidthUpdate('pencil', $event)"
      >
        <template #trigger>
          <Icon name="chevron-down" class="w-3 h-3" />
        </template>
      </ToolSettingsDropdown>
    </div>

    <!-- Blur Tool -->
    <div class="join">
      <button
        class="btn btn-sm join-item tooltip tooltip-bottom"
        :class="activeTool === 'blur' ? 'btn-active' : ''"
        :data-tip="L('Blur')"
        @click="handleToolSelect('blur')"
      >
        <Icon name="ripple" />
      </button>
      <ToolSettingsDropdown
        tool="blur"
        :line-color="toolSettings.blur.lineColor"
        :line-width="toolSettings.blur.lineWidth"
        :colors="colors"
        :min-width="10"
        :max-width="50"
        @update:line-color="handleColorUpdate('blur', $event)"
        @update:line-width="handleWidthUpdate('blur', $event)"
      >
        <template #trigger>
          <Icon name="chevron-down" class="w-3 h-3" />
        </template>
      </ToolSettingsDropdown>
    </div>

    <div class="divider divider-horizontal mx-0"></div>

    <!-- Delete Button -->
    <button
      class="btn btn-sm btn-outline btn-error tooltip tooltip-bottom"
      :data-tip="L('Delete')"
      :disabled="!selectedCount"
      @click="emit('delete')"
    >
      <Icon name="trash" />
    </button>

    <div class="divider divider-horizontal mx-0"></div>

    <!-- Zoom Controls -->
    <div class="join">
      <button
        class="btn btn-sm join-item tooltip tooltip-bottom"
        :data-tip="L('Zoom Out')"
        @click="emit('zoomOut')"
      >
        <Icon name="zoom-out" />
      </button>
      <div class="dropdown">
        <button
          class="btn btn-sm join-item tooltip tooltip-bottom"
          tabindex="0"
          :data-tip="L('Zoom Level')"
        >
          {{ Math.round(scale * 100) }}%
        </button>
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 rounded-box z-10 w-40 p-2 shadow-lg border border-base-300 mb-1"
        >
          <li>
            <a @click="handleZoomPreset('fit')">{{ L('Fit to Canvas') }}</a>
          </li>
          <li><a @click="handleZoomPreset(100)">100%</a></li>
          <li><a @click="handleZoomPreset(50)">50%</a></li>
          <li><a @click="handleZoomPreset(300)">300%</a></li>
        </ul>
      </div>
      <button
        class="btn btn-sm join-item tooltip tooltip-bottom"
        :data-tip="L('Zoom In')"
        @click="emit('zoomIn')"
      >
        <Icon name="zoom-in" />
      </button>
    </div>
  </div>

  <!-- Mobile Toolbar -->
  <div v-else class="flex items-center justify-between gap-2">
    <div class="flex items-center gap-2 overflow-visible">
      <button
        class="btn btn-sm btn-square tooltip tooltip-bottom"
        :class="activeTool === 'select' ? 'btn-active' : ''"
        :data-tip="L('Select')"
        @click="handleToolSelect('select')"
      >
        <Icon name="pointer" />
      </button>

      <div class="join">
        <div class="dropdown">
          <button
            class="btn btn-sm join-item gap-1 tooltip tooltip-bottom"
            :class="activeTool !== 'select' ? 'btn-active' : ''"
            :data-tip="L('Tools')"
            tabindex="0"
          >
            <Icon :name="handleToolIcon(mobileActiveTool)" />
            <Icon name="chevron-down" class="w-3 h-3" />
          </button>
          <ul
            tabindex="0"
            class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-2 shadow-lg border border-base-300"
          >
            <li v-for="item in mobileToolItems" :key="item.tool">
              <a @click="handleMobileToolSelect(item.tool)">
                <Icon :name="item.icon" />
                {{ item.label }}
              </a>
            </li>
          </ul>
        </div>

        <ToolSettingsDropdown
          v-if="handleShowToolSettings(mobileActiveTool)"
          :tool="mobileActiveTool"
          :line-color="toolSettings[mobileActiveTool].lineColor"
          :line-width="toolSettings[mobileActiveTool].lineWidth"
          :colors="colors"
          :min-width="toolWidthRange[mobileActiveTool].min"
          :max-width="toolWidthRange[mobileActiveTool].max"
          @update:line-color="handleColorUpdate(mobileActiveTool, $event)"
          @update:line-width="handleWidthUpdate(mobileActiveTool, $event)"
        >
          <template #trigger>
            <Icon name="chevron-down" class="w-3 h-3" />
          </template>
        </ToolSettingsDropdown>
      </div>
    </div>

    <button class="btn btn-sm btn-circle" :disabled="!selectedCount" @click="emit('delete')">
      <Icon name="trash" />
    </button>
  </div>
</template>
