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
  { keys: 'Shift (resizing)', description: 'Lock aspect ratio' },
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
      :class="forMobile ? 'w-72' : 'w-96'"
    >
      <p class="mb-2 text-sm">
        {{ L('Pick a tool, draw on the image, then Copy or Download.') }}
      </p>
      <!--
        Grid, not flex justify-between: each column wraps independently
        within its own width instead of both sides wrapping unpredictably
        next to each other, which looked ragged for the longer rows (e.g.
        "Lock aspect ratio" / "Shift (resizing)").
      -->
      <ul class="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 text-xs">
        <template v-for="shortcut in shortcuts" :key="shortcut.keys">
          <li class="text-base-content/70">{{ L(shortcut.description) }}</li>
          <li class="text-right">
            <kbd class="font-mono whitespace-nowrap">{{ shortcut.keys }}</kbd>
          </li>
        </template>
      </ul>

      <div class="divider my-2"></div>

      <!--
        This is the only feedback path reachable from inside the embed
        widget itself (the "Powered by Markbit" badge on AnnotationEditor.vue
        links to the landing page, not directly to feedback) — someone using
        Markbit via a <script> embed on a third-party site may never see the
        landing page's own feedback link at all. target="_blank" matters
        here for the same reason as that badge: a plain click would navigate
        the srcdoc iframe's own browsing context and blank the overlay
        instead of opening a new tab.
      -->
      <a
        href="https://github.com/feeva/markbit/issues/new"
        target="_blank"
        rel="noopener"
        class="text-xs underline hover:text-base-content"
      >
        {{ L('Send feedback') }}
      </a>
    </div>
  </div>
</template>
