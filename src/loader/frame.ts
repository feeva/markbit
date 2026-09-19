/**
 * Runs INSIDE the iframe that embed.ts creates via `srcdoc` — a genuinely
 * separate Document. @vue/runtime-dom binds to whatever `document` is global
 * at the moment it's evaluated (`const doc = document`, once, at module
 * load), so this MUST be its own <script src="frame.js"> that the iframe
 * loads and executes itself — mounting a Vue app created in the parent's
 * realm into this iframe's DOM would throw WrongDocumentError.
 *
 * (This is also why this couldn't just be the same dynamically-imported chunk
 * used for a Shadow DOM host: a shadow root shares the parent page's Document,
 * an iframe does not.)
 */
import { createApp } from 'vue'
import AnnotationEditor from '@/components/AnnotationEditor/AnnotationEditor.vue'
import type { AnnotationSavePayload } from '@/types/annotations'
import cssText from '@/assets/main.css?inline'
import iconSprite from '@/assets/icons-sprite.svg?url'

export type MarkbitMount = (
  imageUrl: string,
  onCopy: (payload: AnnotationSavePayload) => void,
  onDownload: (payload: AnnotationSavePayload) => void,
  onClose: () => void,
) => void

declare global {
  interface Window {
    __markbitMount?: MarkbitMount
  }
}

const mount: MarkbitMount = (imageUrl, onCopy, onDownload, onClose) => {
  // The <meta viewport> tag and the overflow:hidden reset are already baked
  // into embed.ts's srcdoc HTML for this iframe's document (see its comment
  // for why — a <meta> appended via JS after the fact isn't reliable on all
  // mobile browsers).
  const style = document.createElement('style')
  style.textContent = cssText
  document.head.appendChild(style)

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.setAttribute('aria-label', 'Close')
  closeButton.dataset.testid = 'markbit-close'
  closeButton.className = 'btn btn-circle btn-sm'
  // Using the same <svg><use> icon sprite as every other button (Icon.vue)
  // instead of a plain '✕' text glyph, which rendered inconsistently
  // (doubled/bold) depending on the OS's fallback font for that character.
  closeButton.innerHTML = `<svg class="app-icon"><use href="${iconSprite}#tabler-x" /></svg>`
  Object.assign(closeButton.style, {
    position: 'fixed',
    top: '0.5rem',
    right: '0.5rem',
    // AnnotationEditor's own toolbar wrapper uses z-index: 1 (see its "tooltips
    // are placed under the canvas" comment) — anything lower or equal loses the
    // DOM-order tiebreak to it, since the toolbar renders after this button.
    zIndex: '2147483647',
  })
  closeButton.addEventListener('click', onClose)
  document.body.appendChild(closeButton)

  // AnnotationEditor's root <div> (class="flex flex-col") has no explicit
  // height of its own — it expects an ancestor to establish one (starissue's
  // does via a <dialog class="modal">). `grid` gives it one for free: an
  // unsized grid item stretches to fill both axes by default (unlike flexbox,
  // where only the cross-axis stretches), without needing to touch
  // AnnotationEditor.vue itself.
  const mountPoint = document.createElement('div')
  mountPoint.className = 'h-screen w-screen grid'
  document.body.appendChild(mountPoint)

  createApp(AnnotationEditor, { imageUrl, onCopy, onDownload, onClose }).mount(mountPoint)

  // AnnotationEditor declares a `close` emit but never fires it itself
  // (starissue relied on wrapping it in a native <dialog> for Escape-to-close
  // instead) — only the explicit close button above closes the overlay.
  // Deliberately no Escape shortcut here either: it's too easy to hit by
  // accident (e.g. dismissing an unrelated dropdown) and would silently
  // discard in-progress annotations with no confirmation.
}

window.__markbitMount = mount
