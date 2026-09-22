<script setup lang="ts">
import { computed } from 'vue'

import Icon from '@/components/Icon.vue'
import HelpDropdown from './HelpDropdown.vue'
import ToolSettingsDropdown from './ToolSettingsDropdown.vue'
import { L } from '@/i18n'
import type { MarkbitAction, Tool, ToolSettings } from '@/types/annotations'

interface Props {
  activeTool: Tool | null
  toolSettings: Record<Tool, ToolSettings>
  scale: number
  selectedCount: number
  forMobile: boolean
  actions: MarkbitAction[]
}

interface Emits {
  (e: 'selectTool', tool: Tool): void
  (e: 'updateToolSettings', tool: Tool, settings: Partial<ToolSettings>): void
  (e: 'delete'): void
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
  (e: 'setZoom', preset: 'fit' | 50 | 100 | 300): void
  (e: 'action', id: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const colors = ['#DC2626', 'yellow', '#0891B2', '#2563EB', '#0F766E', '#334155']
// Select/Crop render as their own buttons in the template; this list is
// only the tools that get a settings dropdown.
const mobileToolItems = computed<
  Array<{
    tool: Exclude<Tool, 'select' | 'crop'>
    label: string
    icon: string
  }>
>(() => [
  { tool: 'rectangle', label: L('Box'), icon: 'rectangle' },
  { tool: 'text', label: L('Text'), icon: 'letter-case' },
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

// Falls back to 'select' only for typing (activeTool is never actually null
// in the app); handleShowToolSettings hides the dropdown for 'select' anyway.
const mobileSettingsTool = computed<Tool>(() => props.activeTool ?? 'select')

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
        <Icon name="letter-case" />
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

    <div v-if="actions.length" class="join ml-auto">
      <button
        v-for="action in actions"
        :key="action.id"
        class="btn btn-sm join-item tooltip tooltip-bottom"
        :data-tip="L(action.label)"
        @click="emit('action', action.id)"
      >
        <Icon :name="action.icon" />
      </button>
    </div>

    <HelpDropdown :for-mobile="false" />
  </div>

  <!-- Mobile Toolbar -->
  <div v-else class="flex flex-col gap-2 min-w-0">
    <!--
      Tools get their own row so Delete/actions/Help (below) don't crowd
      their horizontal scroll space. No tooltip/data-tip here (unlike
      desktop): touch has no :hover, so a hover tooltip is dead weight -
      worse, its popup was rendering inside this scrolling row, and
      overflow-x-auto forces overflow-y to compute to 'auto' too (CSS
      Overflow spec), which clipped it into an unwanted vertical scrollbar.
      The settings dropdown avoids that by sitting outside the scrolling div,
      as its own sibling.
    -->
    <div class="flex items-center gap-1 min-w-0">
      <div class="flex items-center gap-1 overflow-x-auto flex-nowrap min-w-0 py-0.5">
        <button
          class="btn btn-sm btn-square shrink-0"
          :class="activeTool === 'select' ? 'btn-active' : ''"
          :aria-label="L('Select')"
          @click="handleToolSelect('select')"
        >
          <Icon name="pointer" />
        </button>
        <button
          class="btn btn-sm btn-square shrink-0"
          :class="activeTool === 'crop' ? 'btn-active' : ''"
          :aria-label="L('Crop')"
          @click="handleToolSelect('crop')"
        >
          <Icon name="border-corners" />
        </button>
        <button
          v-for="item in mobileToolItems"
          :key="item.tool"
          class="btn btn-sm btn-square shrink-0"
          :class="activeTool === item.tool ? 'btn-active' : ''"
          :aria-label="item.label"
          @click="handleToolSelect(item.tool)"
        >
          <Icon :name="item.icon" />
        </button>
      </div>

      <ToolSettingsDropdown
        v-if="handleShowToolSettings(mobileSettingsTool)"
        :tool="mobileSettingsTool"
        :line-color="toolSettings[mobileSettingsTool].lineColor"
        :line-width="toolSettings[mobileSettingsTool].lineWidth"
        :colors="colors"
        :min-width="toolWidthRange[mobileSettingsTool].min"
        :max-width="toolWidthRange[mobileSettingsTool].max"
        class="shrink-0"
        data-cy="mobile-tool-settings"
        @update:line-color="handleColorUpdate(mobileSettingsTool, $event)"
        @update:line-width="handleWidthUpdate(mobileSettingsTool, $event)"
      >
        <template #trigger>
          <Icon name="chevron-down" class="w-3 h-3" />
        </template>
      </ToolSettingsDropdown>
    </div>

    <div class="flex items-center gap-2">
      <button class="btn btn-sm btn-circle" :disabled="!selectedCount" @click="emit('delete')">
        <Icon name="trash" />
      </button>
      <button
        v-for="action in actions"
        :key="action.id"
        class="btn btn-sm btn-circle"
        :aria-label="L(action.label)"
        @click="emit('action', action.id)"
      >
        <Icon :name="action.icon" />
      </button>
      <HelpDropdown :for-mobile="true" />
    </div>
  </div>
</template>
