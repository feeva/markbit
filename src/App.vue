<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import AnnotationEditor from './components/AnnotationEditor/AnnotationEditor.vue'
import LandingPage from './components/LandingPage.vue'
import { useImageSource } from './composables/useImageSource'
import { copyToClipboard, downloadDataUrl } from './utils/clipboard'
import { canShareFile, shareDataUrl } from './utils/share'
import { hasUsedMarkbitBefore, markHasUsedMarkbit, track } from './utils/track'
import type { MarkbitAction } from './types/annotations'

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

onMounted(() => {
  track('pageview')
  if (hasUsedMarkbitBefore()) track('returning_visit')
})
watch(imageUrl, (url, previous) => {
  if (url && !previous) {
    track('image_loaded')
    markHasUsedMarkbit()
  }
})

// Copy/Download/Share are this page's own sample actions, not something
// AnnotationEditor hardcodes — see src/types/annotations.ts's MarkbitAction.
// Share is a demo of the new extensibility (native OS share sheet via
// navigator.share()); it's unrelated to PLAN.md's Phase 3 hosted Share URL
// feature, see the 2026-09-20 Decision Log entry.
const actions = computed<MarkbitAction[]>(() => {
  const list: MarkbitAction[] = [
    {
      id: 'copy',
      label: 'Copy to Clipboard',
      icon: 'copy',
      onClick: (payload) => {
        track('copy')
        void copyToClipboard(payload.previewDataUrl).catch((err) =>
          console.error('[markbit] clipboard copy failed', err),
        )
      },
    },
    {
      id: 'download',
      label: 'Download PNG',
      icon: 'download',
      onClick: (payload) => {
        track('download')
        downloadDataUrl(payload.previewDataUrl)
      },
    },
  ]

  // Only rendered when the browser actually supports file sharing (e.g. no
  // desktop Firefox) — a button that silently fails is worse than no button.
  if (canShareFile()) {
    list.push({
      id: 'share',
      label: 'Share',
      icon: 'share',
      onClick: (payload) => {
        track('share')
        void shareDataUrl(payload.previewDataUrl).catch((err) =>
          console.error('[markbit] share failed', err),
        )
      },
    })
  }

  return list
})
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
    <AnnotationEditor :image-url="imageUrl" :actions="actions" @close="reset" />
  </div>
</template>
