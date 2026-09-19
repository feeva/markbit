<script setup lang="ts">
// Phase 0 harness — proves AnnotationEditor runs standalone, outside starissue.
// Not the Phase 1 product UX (no paste/drop, no clipboard copy, no download yet).
import { ref } from 'vue'
import AnnotationEditor from './components/AnnotationEditor/AnnotationEditor.vue'
import type { AnnotationSavePayload } from './types/annotations'

const imageUrl = ref<string | null>(null)
const lastSavePayload = ref<AnnotationSavePayload | null>(null)

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  imageUrl.value = URL.createObjectURL(file)
  lastSavePayload.value = null
}

function onSave(payload: AnnotationSavePayload) {
  lastSavePayload.value = payload
  // eslint-disable-next-line no-console
  console.log('[markbit] save payload', payload)
}

function onClose() {
  imageUrl.value = null
}
</script>

<template>
  <div class="min-h-screen bg-base-200 p-6">
    <h1 class="mb-4 text-xl font-semibold">Markbit — Phase 0 harness</h1>

    <div v-if="!imageUrl" class="flex flex-col gap-2">
      <p class="text-sm opacity-70">이미지를 선택해서 AnnotationEditor가 독립 실행되는지 확인하세요.</p>
      <input type="file" accept="image/*" class="file-input" @change="onFileChange" />
    </div>

    <AnnotationEditor v-else :image-url="imageUrl" @save="onSave" @close="onClose" />

    <pre v-if="lastSavePayload" class="mt-4 max-w-2xl overflow-auto rounded bg-base-300 p-3 text-xs">{{
      JSON.stringify(lastSavePayload, null, 2)
    }}</pre>
  </div>
</template>
