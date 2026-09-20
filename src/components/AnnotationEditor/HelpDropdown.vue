<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import { L } from '@/i18n'

defineProps<{ forMobile: boolean }>()

// Only real shortcuts — see AnnotationEditor.vue's handleKeyDown,
// composables/useKonvaCanvas.ts, and composables/useTextEditor.ts. No
// undo/redo, arrow-key nudging, or zoom/tool hotkeys exist yet; don't list
// shortcuts that don't work.
const shortcuts = [
  { keys: 'Delete / Backspace', description: 'Delete selection' },
  { keys: 'Cmd/Ctrl + A', description: 'Select all' },
  { keys: 'Shift (hold while resizing)', description: 'Lock aspect ratio' },
  { keys: 'Enter', description: 'Finish text edit' },
  { keys: 'Escape', description: 'Cancel text edit' },
]
</script>

<template>
  <div class="dropdown dropdown-end">
    <button
      v-if="!forMobile"
      tabindex="0"
      class="btn btn-sm tooltip tooltip-bottom"
      :data-tip="L('Help')"
    >
      <Icon name="question-mark" />
    </button>
    <button v-else tabindex="0" class="btn btn-sm btn-circle" :aria-label="L('Help')">
      <Icon name="question-mark" />
    </button>

    <div
      tabindex="-1"
      class="dropdown-content z-10 mt-1 p-3 shadow-lg bg-base-100 rounded-lg border border-base-300"
      :class="forMobile ? 'w-64' : 'w-80'"
    >
      <p class="mb-2 text-sm">
        {{ L('Pick a tool, draw on the image, then Copy or Download.') }}
      </p>
      <ul class="space-y-1 text-xs">
        <li v-for="shortcut in shortcuts" :key="shortcut.keys" class="flex justify-between gap-2">
          <span class="text-base-content/70">{{ L(shortcut.description) }}</span>
          <kbd class="font-mono">{{ shortcut.keys }}</kbd>
        </li>
      </ul>
    </div>
  </div>
</template>
