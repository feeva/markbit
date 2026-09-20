<script setup lang="ts">
import AnnotationEditor from './components/AnnotationEditor/AnnotationEditor.vue'
import LandingPage from './components/LandingPage.vue'
import { useImageSource } from './composables/useImageSource'
import { copyToClipboard, downloadDataUrl } from './utils/clipboard'
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

function onCopy(payload: AnnotationSavePayload) {
  void copyToClipboard(payload.previewDataUrl).catch((err) =>
    console.error('[markbit] clipboard copy failed', err),
  )
}

function onDownload(payload: AnnotationSavePayload) {
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
