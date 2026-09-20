<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/Icon.vue'
import { L } from '@/i18n'

defineProps<{
  isDraggingOver: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'file-picked', file: File): void
  (e: 'drop', event: DragEvent): void
  (e: 'dragover', event: DragEvent): void
  (e: 'dragleave', event: DragEvent): void
}>()

// Escaped like embed.ts's srcdoc template — writing the closing script tag
// literally here would terminate this SFC's own script block early.
const EMBED_SNIPPET =
  '<script type="module" src="https://markbit.abcbox.kr/loader.js" data-hotkey="ctrl+shift+m"><\/script>'

const copied = ref(false)
let copiedTimeout: ReturnType<typeof setTimeout> | undefined

async function copySnippet() {
  await navigator.clipboard.writeText(EMBED_SNIPPET)
  copied.value = true
  clearTimeout(copiedTimeout)
  copiedTimeout = setTimeout(() => (copied.value = false), 2000)
}

function onFileInputChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) emit('file-picked', file)
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center gap-8 bg-base-200 px-6 py-16">
    <div class="text-center">
      <h1 class="text-3xl font-bold">Markbit</h1>
      <p class="mt-1 text-base-content/70">{{ L('Paste. Mark. Share.') }}</p>
    </div>

    <div
      class="flex w-full max-w-xl flex-col items-center gap-4 rounded-box border-2 border-dashed p-12 text-center transition-colors"
      :class="isDraggingOver ? 'border-primary bg-primary/5' : 'border-base-300'"
      @drop="emit('drop', $event)"
      @dragover="emit('dragover', $event)"
      @dragleave="emit('dragleave', $event)"
    >
      <p class="text-base-content/80">
        {{ L('Paste (Cmd/Ctrl+V), drop an image here, or choose a file') }}
      </p>
      <label class="btn btn-primary btn-sm">
        {{ L('Choose a file') }}
        <input type="file" accept="image/*" class="hidden" @change="onFileInputChange" />
      </label>
      <p v-if="error" class="text-sm text-error">{{ error }}</p>
    </div>

    <div class="w-full max-w-xl rounded-box bg-base-100 p-6">
      <h2 class="mb-2 font-semibold">{{ L('Embed on your own site') }}</h2>
      <p class="mb-3 text-sm text-base-content/70">
        {{ L('Add this to any page. Press the hotkey to capture, mark up, and copy or download.') }}
      </p>
      <div class="join w-full">
        <pre
          class="join-item flex-1 overflow-x-auto rounded-l bg-base-300 p-3 text-xs"
        ><code>{{ EMBED_SNIPPET }}</code></pre>
        <button class="btn btn-sm join-item" @click="copySnippet">
          <Icon name="copy" />
          {{ copied ? L('Copied!') : '' }}
        </button>
      </div>
    </div>

    <p class="max-w-xl text-center text-xs text-base-content/60">
      {{ L('No account. No upload unless you share. Everything runs in your browser.') }}
    </p>
  </div>
</template>
