<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Icon from '@/components/Icon.vue'
import { locale, setLocale, t } from '@/i18n/landing'

const GITHUB_URL = 'https://github.com/feeva/markbit'
const GITHUB_REPO = 'feeva/markbit'

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

// Public, unauthenticated GitHub API endpoint — CORS-enabled, no token
// needed. Fails silently (rate-limited, offline, blocked by an extension):
// the badge just shows the repo name without counts, which is a fine
// degraded state rather than something worth surfacing as an error.
const stars = ref<number | null>(null)
const forks = ref<number | null>(null)

onMounted(async () => {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
    if (!response.ok) return
    const data = await response.json()
    stars.value = data.stargazers_count
    forks.value = data.forks_count
  } catch {
    // Offline/blocked — the plain GitHub link still works without counts.
  }
})

const tools = [
  { icon: 'rectangle', label: 'Box' },
  { icon: 'letter-case', label: 'Text' },
  { icon: 'highlight', label: 'Highlight' },
  { icon: 'writing', label: 'Draw' },
  { icon: 'ripple', label: 'Blur' },
  { icon: 'border-corners', label: 'Crop' },
]
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <div class="bg-gradient-to-br from-primary/10 via-base-200 to-secondary/10 px-6 pb-14 pt-8">
      <div class="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
        <a
          :href="GITHUB_URL"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2 whitespace-nowrap rounded-full border border-base-300 bg-base-100 px-3 py-1.5 text-xs shadow-sm transition-shadow hover:shadow-md sm:text-sm"
        >
          <Icon name="brand-github" />
          <span class="font-medium">{{ GITHUB_REPO }}</span>
          <span v-if="stars !== null" class="flex items-center gap-0.5 text-base-content/60">
            <Icon name="star" />{{ stars }}
          </span>
          <span v-if="forks !== null" class="flex items-center gap-0.5 text-base-content/60">
            <Icon name="git-fork" />{{ forks }}
          </span>
        </a>

        <div class="join">
          <button
            class="btn btn-xs join-item"
            :class="locale === 'en' ? 'btn-active' : ''"
            @click="setLocale('en')"
          >
            EN
          </button>
          <button
            class="btn btn-xs join-item"
            :class="locale === 'ko' ? 'btn-active' : ''"
            @click="setLocale('ko')"
          >
            한국어
          </button>
        </div>
      </div>

      <div class="mx-auto mt-10 max-w-2xl text-center">
        <h1
          class="bg-gradient-to-r from-primary to-secondary bg-clip-text text-5xl font-extrabold tracking-tight text-transparent"
        >
          Markbit
        </h1>
        <p class="mt-3 text-lg text-base-content/70">{{ t('tagline') }}</p>

        <div class="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-4 sm:gap-x-8">
          <div
            v-for="tool in tools"
            :key="tool.icon"
            class="flex flex-col items-center gap-1 text-base-content/50"
          >
            <Icon :name="tool.icon" />
            <span class="text-[11px]">{{ t(tool.label) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="mx-auto flex max-w-xl flex-col gap-8 px-6 py-12">
      <div
        class="flex flex-col items-center gap-4 rounded-box border-2 border-dashed p-12 text-center transition-colors"
        :class="isDraggingOver ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-100'"
        @drop="emit('drop', $event)"
        @dragover="emit('dragover', $event)"
        @dragleave="emit('dragleave', $event)"
      >
        <p class="text-base-content/80">
          {{ t('pasteHint') }}
        </p>
        <label class="btn btn-primary btn-sm">
          {{ t('chooseFile') }}
          <input type="file" accept="image/*" class="hidden" @change="onFileInputChange" />
        </label>
        <p v-if="error" class="text-sm text-error">{{ error }}</p>
      </div>

      <div class="overflow-hidden rounded-box border border-base-300 shadow-sm">
        <div class="bg-base-100 p-4">
          <h2 class="mb-1 font-semibold">{{ t('embedTitle') }}</h2>
          <p class="text-sm text-base-content/70">
            {{ t('embedDescription') }}
          </p>
        </div>
        <div class="flex items-center gap-2 bg-neutral p-4 text-neutral-content">
          <!--
            min-w-0 is load-bearing: a flex child defaults to min-width: auto,
            which refuses to shrink below its content's intrinsic width. Without
            it, this non-wrapping <pre> forces the whole page wider than the
            viewport on mobile instead of scrolling internally via
            overflow-x-auto (a classic flexbox overflow bug).
          -->
          <pre class="min-w-0 flex-1 overflow-x-auto text-xs"><code>{{ EMBED_SNIPPET }}</code></pre>
          <button class="btn btn-sm shrink-0" @click="copySnippet">
            <Icon name="copy" />
            {{ copied ? t('Copied!') : '' }}
          </button>
        </div>
      </div>

      <p class="text-center text-xs text-base-content/60">
        {{ t('privacyNote') }}
        <br />
        <span class="text-[11px] text-base-content/40">{{ t('usageNote') }}</span>
      </p>

      <div class="rounded-box bg-base-100 p-6 shadow-sm">
        <h2 class="mb-2 font-semibold">{{ t('aboutTitle') }}</h2>
        <p class="text-sm text-base-content/70">
          {{ t('aboutDescription') }}
        </p>
      </div>

      <footer class="mt-2 flex flex-col items-center gap-2 text-xs text-base-content/60">
        <a
          href="https://github.com/feeva/markbit/issues/new"
          target="_blank"
          rel="noopener"
          class="underline hover:text-base-content"
        >
          {{ t('sendFeedback') }}
        </a>
        <p>© {{ new Date().getFullYear() }} Markbit — MPL-2.0</p>
      </footer>
    </div>
  </div>
</template>
