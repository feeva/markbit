<script setup lang="ts">
import { computed } from 'vue'
// Trimmed local sprite (only the icons Markbit uses) instead of the full
// @tabler/icons-sprite package — see scripts/build-icon-sprite.mjs.
// No "filled-" variant support: none of Markbit's icons need it yet. If one does,
// regenerate a small filled sprite the same way and restore the branch below.
import sprite from '@/assets/icons-sprite.svg?url'

const props = defineProps<{ name: string }>()
const href = computed(() => sprite + '#tabler-' + props.name)
</script>

<template>
  <svg class="app-icon">
    <use :href />
  </svg>
</template>
