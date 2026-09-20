<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AnnotationEditor from './components/AnnotationEditor/AnnotationEditor.vue'
import LandingPage from './components/LandingPage.vue'
import { useImageSource } from './composables/useImageSource'
import { copyToClipboard, downloadDataUrl } from './utils/clipboard'
import { track } from './utils/track'
import type { AnnotationSavePayload } from './types/annotations'

const {
  imageUrl,
  isDraggingOver,
  error,
  loadFromFile,
  handleDrop,
  handleDragOver,
  handleDragLeave,
  reset,
} = useImageSource()

onMounted(() => track('pageview'))
watch(imageUrl, (url, previous) => {
  if (url && !previous) track('image_loaded')
})

function onCopy(payload: AnnotationSavePayload) {
  track('copy')
  void copyToClipboard(payload.previewDataUrl).catch((err) =>
    console.error('[markbit] clipboard copy failed', err),
  )
}

function onDownload(payload: AnnotationSavePayload) {
  track('download')
  downloadDataUrl(payload.previewDataUrl)
}
</script>

<template>
  <LandingPage
    v-if="!imageUrl"
    :is-dragging-over="isDraggingOver"
    :error="error"
    @file-picked="loadFromFile"
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
  />

  <!--
    AnnotationEditor's root <div> (class="flex flex-col") has no explicit
    height of its own — same reason as loader/frame.ts's mountPoint. `grid`
    makes the single unsized child stretch to fill both axes by default.
  -->
  <div v-else class="h-screen w-screen grid">
    <AnnotationEditor :image-url="imageUrl" @copy="onCopy" @download="onDownload" @close="reset" />
  </div>
</template>
