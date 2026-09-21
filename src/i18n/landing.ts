import { ref } from 'vue'

// Landing-page-only locale support (EN default, KO supported) — deliberately
// separate from src/i18n/index.ts's L(), which stays an English-only
// passthrough for the editor UI. See that file's comment for why the split.
export type Locale = 'en' | 'ko'

const STORAGE_KEY = 'markbit-locale'

function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'ko') return stored
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts —
    // fall through to detection instead of failing the whole page.
  }
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export const locale = ref<Locale>(detectInitialLocale())

export function setLocale(next: Locale) {
  locale.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Best-effort persistence only.
  }
}

// Single words (Box, Crop, ...) still use the English word itself as the
// key — short enough that matching a template call to its entry here is
// trivial, same as the rest of the codebase's L(key) convention. Anything
// longer gets a short symbolic key instead, with its English text declared
// explicitly in `en` below: for a full sentence, eyeballing which `t(...)`
// call in LandingPage.vue's template matches which entry in this file's `ko`
// object (both holding the same long string, formatted differently) was
// error-prone — a copy edit to the English sentence in one place and not the
// other silently orphans the `ko` entry (the key stops matching, so Korean
// visitors quietly fall back to English) with nothing pointing at the typo.
const en: Record<string, string> = {
  tagline: 'Paste. Mark. Share.',
  pasteHint: 'Paste (Cmd/Ctrl+V), drop an image here, or choose a file',
  chooseFile: 'Choose a file',
  embedTitle: 'Embed on your own site',
  embedDescription:
    'Add this to any page. Press the hotkey to capture, mark up, and copy or download.',
  privacyNote: 'No account. Your screenshots never leave your browser.',
  usageNote: 'Anonymous aggregate usage counts only.',
  aboutTitle: 'About Markbit',
  aboutDescription:
    'Markbit started as an internal tool for capturing a screenshot, marking up exactly what\'s wrong, and sharing it — no more "the button on the top right, no, the other one." It\'s free and open source under the AGPL-3.0.',
  viewSource: 'View source on GitHub',
  sendFeedback: 'Send feedback',
}

const ko: Record<string, string> = {
  tagline: '붙여넣고. 표시하고. 공유하기.',
  pasteHint: '이미지를 붙여넣거나(Cmd/Ctrl+V), 끌어다 놓거나, 파일을 선택하세요',
  chooseFile: '파일 선택',
  embedTitle: '내 사이트에 넣기',
  embedDescription:
    '아무 페이지에나 추가하세요. 단축키를 누르면 화면을 캡처해 표시하고 복사하거나 다운로드할 수 있습니다.',
  privacyNote: '회원가입 없음. 스크린샷 처리는 브라우저 안에서만 이뤄집니다.',
  usageNote: '사용 횟수만 익명으로 집계됩니다.',
  aboutTitle: 'Markbit 소개',
  aboutDescription:
    'Markbit은 화면을 캡처해 문제가 되는 부분을 정확히 표시하고 공유하기 위한 사내 도구에서 시작했습니다 — 더 이상 "오른쪽 위 버튼 말이에요, 아니 그거 말고" 같은 설명을 주고받을 필요가 없죠. AGPL-3.0으로 배포되는 무료 오픈소스입니다.',
  viewSource: 'GitHub에서 소스 보기',
  sendFeedback: '피드백 보내기',
  'Copied!': '복사됨!',
  Box: '사각형',
  Text: '텍스트',
  Highlight: '강조',
  Draw: '그리기',
  Blur: '블러',
  Crop: '자르기',
}

export function t(key: string): string {
  if (locale.value === 'ko' && key in ko) {
    return ko[key]
  }
  return en[key] ?? key
}
