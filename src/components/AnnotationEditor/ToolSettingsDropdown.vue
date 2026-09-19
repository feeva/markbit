<script setup lang="ts">
import { computed } from 'vue'

import { L } from '@/i18n'

interface Props {
  tool: string
  lineColor: string
  lineWidth: number
  colors: string[]
  label?: string
  minWidth?: number
  maxWidth?: number
}

interface Emits {
  (e: 'update:lineColor', color: string): void
  (e: 'update:lineWidth', width: number): void
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Line Width',
  minWidth: 1,
  maxWidth: 20,
})

const emit = defineEmits<Emits>()

const widthLabel = computed(() => {
  if (props.tool === 'text') return L('Font Size')
  if (props.tool === 'marker') return L('Width')
  if (props.tool === 'blur') return L('Blur Size')
  if (props.tool === 'crop') return L('Border')
  return L(props.label)
})

const showColorPicker = computed(() => props.tool !== 'blur' && props.tool !== 'crop')
</script>

<template>
  <div class="dropdown">
    <div tabindex="0" role="button" class="btn btn-sm join-item px-1">
      <slot name="trigger">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </slot>
    </div>
    <div
      tabindex="-1"
      class="dropdown-content z-10 mt-1 p-3 shadow-lg bg-base-100 rounded-lg border border-base-300 w-48"
    >
      <div class="space-y-3">
        <div v-if="showColorPicker">
          <label class="label-text text-xs">{{ L('Color') }}</label>
          <div class="flex gap-1 mt-1">
            <button
              v-for="color in colors"
              :key="color"
              class="w-6 h-6 rounded border-2"
              :class="lineColor === color ? 'border-primary scale-110' : 'border-base-300'"
              :style="{ backgroundColor: color }"
              @click="emit('update:lineColor', color)"
            ></button>
          </div>
        </div>
        <div>
          <label class="label-text text-xs">{{ L('{0}: {1}px', widthLabel, lineWidth) }}</label>
          <input
            type="range"
            :min="minWidth"
            :max="maxWidth"
            :value="lineWidth"
            class="range range-xs mt-1"
            @input="emit('update:lineWidth', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </div>
  </div>
</template>
